"""Equations topic, the panel-four boss rounds and storyboard retries."""

import asyncio
import json
from fractions import Fraction
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from test_generation import DeterministicImages, DeterministicText, story_for

from app.config import Settings
from app.main import create_app
from app.problems import EquationProblem, boss_rounds, choose_problem, problem_from_dict
from app.providers import ProviderError
from app.storage import Store
from app.story import image_prompt, text_prompt
from app.worker import Worker

EQUATIONS = {"grade": 5, "topic": "equations", "lang": "ru", "difficulty": "advanced"}
FRACTIONS = {"grade": 6, "topic": "fractions", "lang": "kk", "difficulty": "advanced"}


def run(tmp_path, request, text=None, art_mode="live", attempts=3):
    settings = Settings(
        data_dir=tmp_path,
        art_mode=art_mode,
        public_base_url="http://testserver",
        text_attempts=attempts,
    )
    api = TestClient(create_app(settings))
    job_id = api.post("/api/comic-jobs", json=request).json()["jobId"]
    text = text or DeterministicText()
    images = DeterministicImages() if art_mode == "live" else None
    assert asyncio.run(Worker(Store(tmp_path), text, images, settings).run_once())
    return api, text, api.get(f"/api/comic-jobs/{job_id}").json(), Store(tmp_path)


@pytest.mark.parametrize("grade", [5, 6])
@pytest.mark.parametrize("difficulty", ["basic", "intermediate", "advanced"])
def test_equation_templates_have_positive_whole_answers(grade, difficulty):
    request = SimpleNamespace(grade=grade, difficulty=difficulty, topic="equations")
    for _ in range(200):
        problem = choose_problem(request)
        assert isinstance(problem, EquationProblem)
        assert problem.expected.denominator == 1 and problem.expected > 0
        assert problem_from_dict(json.loads(json.dumps(problem.to_dict()))) == problem
        for lang in ("ru", "kk"):
            assert problem.equation in problem.prompt(lang)
            assert len(problem.hints(lang)) == 2
            # Hints explain the method but never give the answer away.
            assert all(str(problem.expected) not in hint for hint in problem.hints(lang))


@pytest.mark.parametrize(
    "data",
    [
        {"kind": "mul", "a": 4, "b": 10},  # 10 / 4 is not whole
        {"kind": "add", "a": 9, "b": 5},  # negative answer
        {"kind": "pow", "a": 2, "b": 8},
    ],
)
def test_stored_equations_are_validated(data):
    with pytest.raises(ValueError):
        problem_from_dict(data)


def test_boss_rounds_are_distinct_server_problems():
    request = SimpleNamespace(grade=6, difficulty="intermediate", topic="equations")
    main = choose_problem(request)
    rounds = boss_rounds(request, main)
    prompts = {p.prompt("ru") for p in [main, *rounds]}
    assert len(rounds) == 2 and len(prompts) == 3


def test_equation_prompts_use_riddle_scenes_without_pizza():
    problem = EquationProblem("mul_add", 3, 5, 26)
    request = SimpleNamespace(**EQUATIONS)
    prompt = json.loads(text_prompt(request, problem))
    assert "equations" in prompt["task"]
    assert "pizza" not in json.dumps(prompt["scene_actions"]).lower()
    assert prompt["trusted_content"]["ru"]["exercise"].count("3 · x + 5 = 26") == 1
    assert "7" not in json.dumps(prompt, ensure_ascii=False)  # the answer is never sent
    for scene in prompt["scenes"]:
        drawn = image_prompt(scene, "equations")
        assert "pizza" not in drawn.lower() and "26" not in drawn


def test_equations_comic_has_x_master_boss_and_whole_number_checks(tmp_path):
    api, _, status, store = run(tmp_path, EQUATIONS)
    assert status["status"] == "ready", status
    comics = {
        lang: api.get(f"/api/comics/{status['comicId']}?lang={lang}").json()
        for lang in ("ru", "kk")
    }
    exercise = comics["ru"]["exercise"]
    assert exercise["id"].startswith("equations-") and exercise["answerFormat"] == "whole-number"
    for lang, comic in comics.items():
        boss = comic["boss"]
        assert boss["kind"] == "x-master" and boss["maxHp"] == 90 and len(boss["rounds"]) == 3
        assert boss["rounds"][0]["prompt"] == comic["exercise"]["prompt"]
        assert all(r["answerFormat"] == "whole-number" for r in boss["rounds"])
        assert all(
            r["prompt"].endswith(("целым числом.", "бүтін санмен жаз.")) for r in boss["rounds"]
        )
    assert [r["exerciseId"] for r in comics["ru"]["boss"]["rounds"]] == [
        r["exerciseId"] for r in comics["kk"]["boss"]["rounds"]
    ]

    for round_ in comics["ru"]["boss"]["rounds"]:
        rid = round_["exerciseId"]
        expected = int(Fraction(store.exercise(rid)["expected"]))
        check = lambda answer: api.post(  # noqa: E731
            f"/api/exercises/{rid}/check", json={"answer": answer, "lang": "ru"}
        ).json()
        assert check(str(expected))["status"] == "correct"
        assert check(f" {expected} ")["status"] == "correct"
        wrong = check(str(expected + 1))
        assert wrong["status"] == "incorrect" and "вместо x" in wrong["message"]
        assert check(f"{expected}/1")["status"] == "invalid"
        assert check("x")["status"] == "invalid"
        hint = api.get(f"/api/exercises/{rid}/hints?lang=kk&step=2").json()
        assert hint["text"] and hint["hasMore"] is False


def test_fraction_boss_rounds_check_as_fractions(tmp_path):
    api, _, status, store = run(tmp_path, FRACTIONS)
    comic = api.get(f"/api/comics/{status['comicId']}?lang=kk").json()
    assert comic["boss"]["kind"] == "fraction-slime"
    assert "answerFormat" not in comic["exercise"]
    rid = comic["boss"]["rounds"][2]["exerciseId"]
    expected = Fraction(store.exercise(rid)["expected"])
    answer = f"{expected.numerator * 2}/{expected.denominator * 2}"
    response = api.post(f"/api/exercises/{rid}/check", json={"answer": answer, "lang": "kk"})
    assert response.json()["status"] == "correct"
    assert (
        api.post(f"/api/exercises/{rid}-r9/check", json={"answer": "1/2", "lang": "kk"}).status_code
        == 404
    )


def test_live_equations_draw_the_riddle_chest(tmp_path):
    settings = Settings(data_dir=tmp_path, art_mode="live", public_base_url="http://testserver")
    api = TestClient(create_app(settings))
    job_id = api.post("/api/comic-jobs", json=EQUATIONS).json()["jobId"]
    images = DeterministicImages()
    worker = Worker(Store(tmp_path), DeterministicText(), images, settings)
    assert asyncio.run(worker.run_once())
    assert api.get(f"/api/comic-jobs/{job_id}").json()["status"] == "ready"
    assert len(images.calls) == 6
    assert all("chest" in prompt and "pizza" not in prompt for prompt, _ in images.calls)


class FlakyText(DeterministicText):
    """Breaks a rule on the first answers, then behaves."""

    def __init__(self, bad_answers, error=None):
        super().__init__()
        self.bad_answers = bad_answers
        self.error = error

    async def generate(self, prompt, schema):
        self.calls.append((prompt, schema))
        if len(self.calls) <= self.bad_answers:
            if self.error:
                raise ProviderError(self.error)
            story = story_for(prompt)
            story["ru"]["panels"][0]["text"] = "Нас тут трое!"
            return story
        return story_for(prompt)


def test_rejected_storyboard_is_retried_with_the_broken_rule(tmp_path):
    text = FlakyText(bad_answers=1)
    _, _, status, _ = run(tmp_path, EQUATIONS, text=text)
    assert status["status"] == "ready", status
    assert len(text.calls) == 2
    first, retry = (json.loads(prompt) for prompt, _ in text.calls)
    assert "previous_attempt_rejected" not in first
    reason = retry["previous_attempt_rejected"]["reason"]
    assert reason == "story_application_validation:ru.panels[0].text:no_number_words"
    assert "трое" not in json.dumps(retry, ensure_ascii=False)  # no model output echoed


def test_storyboard_gives_up_after_the_configured_attempts(tmp_path):
    text = FlakyText(bad_answers=10)
    _, _, status, _ = run(tmp_path, EQUATIONS, text=text, attempts=2)
    assert status["status"] == "failed" and status["errorCode"] == "invalid_provider_output"
    assert len(text.calls) == 2


def test_timeouts_retry_but_authentication_errors_do_not(tmp_path):
    timeout = FlakyText(bad_answers=2, error="provider_timeout")
    _, _, status, _ = run(tmp_path / "timeout", EQUATIONS, text=timeout)
    assert status["status"] == "ready" and len(timeout.calls) == 3
    assert all("previous_attempt_rejected" not in json.loads(p) for p, _ in timeout.calls)

    auth = FlakyText(bad_answers=1, error="provider_authentication")
    _, _, status, _ = run(tmp_path / "auth", EQUATIONS, text=auth)
    assert status["errorCode"] == "provider_authentication" and len(auth.calls) == 1


@pytest.mark.parametrize("attempts", [0, 6])
def test_text_attempts_are_bounded(tmp_path, attempts):
    with pytest.raises(ValueError):
        Settings(data_dir=tmp_path, text_attempts=attempts)


def test_unknown_topic_is_rejected(tmp_path):
    api = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = api.post("/api/comic-jobs", json={**EQUATIONS, "topic": "geometry"})
    assert response.status_code == 422


def test_my_story_with_equations_keeps_heroes_and_gets_the_boss(tmp_path):
    from test_my_story import STORY, StoryText

    text = StoryText()
    api, _, status, _ = run(tmp_path, {**EQUATIONS, "story": STORY}, text=text)
    assert status["status"] == "ready", status
    prompt = json.loads(text.calls[0][0])
    assert "equations" in prompt["task"] and "chest" in json.dumps(prompt["scene_actions"])
    comic = api.get(f"/api/comics/{status['comicId']}?lang=ru").json()
    assert comic["boss"]["kind"] == "x-master"
    assert comic["exercise"]["answerFormat"] == "whole-number"
