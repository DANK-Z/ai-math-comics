import asyncio
import json
from fractions import Fraction

import pytest
from fastapi.testclient import TestClient
from test_generation import REQUEST, DeterministicImages, DeterministicText, story_for

from app.config import Settings
from app.fraction_context import CONTEXTS, context_prompt
from app.main import create_app
from app.problems import Problem
from app.schemas import JobRequest
from app.worker import Worker


@pytest.mark.parametrize("selected", ["lemonade", "ribbon", "water"])
def test_selected_resource_reaches_both_languages_art_and_answer_check(
    tmp_path, monkeypatch, selected
):
    def make_choices(_request):
        return json.dumps({"available_contexts": {selected: CONTEXTS[selected].art}})

    monkeypatch.setattr("app.worker.context_prompt", make_choices)
    problem = Problem(("5/6", "3/8"), 4)
    monkeypatch.setattr("app.storage.choose_problem", lambda _: problem)
    app = create_app(Settings(data_dir=tmp_path))
    api = TestClient(app)
    text, images = DeterministicText(), DeterministicImages()
    job = api.post("/api/comic-jobs", json=REQUEST | {"difficulty": "advanced"}).json()
    assert asyncio.run(Worker(app.state.store, text, images, app.state.settings).run_once())
    status = api.get(f"/api/comic-jobs/{job['jobId']}").json()
    assert status["status"] == "ready"
    assert text.contexts == [selected]
    props = CONTEXTS[selected]
    assert len(images.calls) == 6
    for prompt, _ in images.calls:
        assert props.art in prompt
        assert all(value not in prompt for value in ("5/6", "3/8", "29/96", "pizza"))

    for lang, subject in (("ru", props.resource_ru), ("kk", props.resource_kk)):
        comic = api.get(f"/api/comics/{status['comicId']}?lang={lang}").json()
        exercise = comic["exercise"]
        assert comic["panels"][3]["text"] == exercise["prompt"]
        assert "5/6 + 3/8" in exercise["prompt"] and subject in exercise["prompt"]
        assert all(subject in item["prompt"] for item in comic["boss"]["rounds"])
        base = f"/api/exercises/{exercise['id']}"
        assert problem.expected == Fraction(29, 96)
        for answer, expected_status in (("1/2", "incorrect"), ("29/96", "correct")):
            checked = api.post(f"{base}/check", json={"answer": answer, "lang": lang})
            assert checked.json()["status"] == expected_status
        for step in (1, 2):
            assert "29/96" not in api.get(f"{base}/hints?lang={lang}&step={step}").json()["text"]


def test_context_menu_excludes_pizza_except_for_an_explicit_premise():
    assert "pizza" not in json.loads(context_prompt(JobRequest(**REQUEST)))["available_contexts"]
    story = {
        "heroes": ["pifik"],
        "style": "comic",
        "setting": "school",
        "premise": "Испечём пиццу.",
    }
    data = json.loads(context_prompt(JobRequest(**REQUEST, story=story)))
    assert "pizza" in data["available_contexts"]
    assert "expected" not in data and "fixed_problem_inputs" not in data


def test_context_choice_rejects_unoffered_valid_id_before_story(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.worker.context_prompt", lambda _: '{"available_contexts":{"water":"water"}}'
    )
    settings = Settings(data_dir=tmp_path, text_attempts=1)
    app = create_app(settings)
    api = TestClient(app)

    class WrongContext:
        async def generate(self, prompt, schema):
            assert schema["properties"]["context"]["enum"] == ["water"]
            return {"context": "ribbon"}

    job = api.post("/api/comic-jobs", json=REQUEST).json()
    images = DeterministicImages()
    assert asyncio.run(Worker(app.state.store, WrongContext(), images, settings).run_once())
    assert (
        api.get(f"/api/comic-jobs/{job['jobId']}").json()["errorCode"] == "invalid_provider_output"
    )
    assert not images.calls


def test_old_pizza_checkpoint_still_uses_its_original_illustration_context(tmp_path):
    from app.story import LIVE_SCENES, ScenePanel, image_prompt, text_prompt

    options = Settings(data_dir=tmp_path)
    app = create_app(options)
    api = TestClient(app)
    request = JobRequest(**REQUEST)
    job = api.post("/api/comic-jobs", json=REQUEST).json()
    store = app.state.store
    claim = store.claim(60)
    problem = Problem.from_dict(json.loads(claim["problem"]))
    raw = story_for(text_prompt(request, problem))
    comic_id = job["jobId"]
    store.begin_panels(claim, 6, live_storyboard=(comic_id, json.dumps(raw)))
    images = DeterministicImages(fail_at=2)
    panels = [
        ScenePanel.model_validate({k: p[k] for k in ("id", "scene", "text")})
        for p in raw["ru"]["panels"]
    ]
    worker = Worker(store, DeterministicText(), images, options)
    from app.providers import ProviderError

    with pytest.raises(ProviderError):
        asyncio.run(worker.render_live_images(claim, comic_id, panels))
    store.fail(claim, "image_generation_failed")
    status = api.get(f"/api/comic-jobs/{job['jobId']}").json()
    assert store.resume(job["jobId"], status["resumeToken"])
    text = DeterministicText()
    finishing = DeterministicImages()
    assert asyncio.run(Worker(store, text, finishing, options).run_once())
    assert store.job(job["jobId"]).status == "ready"
    assert not text.contexts and not text.calls
    assert [prompt for prompt, _ in finishing.calls] == [
        image_prompt(scene) for scene in LIVE_SCENES[1:]
    ]
