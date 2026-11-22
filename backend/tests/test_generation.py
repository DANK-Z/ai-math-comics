import asyncio
import copy
import io
import json
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from fractions import Fraction

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app
from app.problems import Problem
from app.providers import ProviderError
from app.schemas import JobRequest
from app.storage import Store
from app.story import LIVE_SCENES, SCENES, PreparedStory, validate_story
from app.worker import Worker, configured_providers

REQUEST = {"grade": 5, "topic": "fractions", "lang": "ru", "difficulty": "basic"}


def story_for(prompt):
    request = json.loads(prompt)
    content = request["trusted_content"]
    dialogue = {
        "ru": [
            "Как интересно!",
            "Давай обсудим задачу.",
            "Подумаем о равных долях.",
            "",
            "Не спеши, рассуждай.",
            "Ты справишься!",
        ],
        "kk": [
            "Қандай қызық!",
            "Есепті талқылайық.",
            "Тең үлестер туралы ойланайық.",
            "",
            "Асықпай ойлан.",
            "Сенің қолыңнан келеді!",
        ],
    }
    return {
        lang: {
            "title": "Друзья и пицца" if lang == "ru" else "Достар мен пицца",
            "exercise": content[lang]["exercise"],
            "hints": content[lang]["hints"],
            "panels": [
                {
                    "id": i,
                    "speaker": ("aldiyar", "aruna", "aldiyar", "pifik", "aruna", "aldiyar")[i - 1],
                    "text": content[lang]["exercise"] if i == 4 else dialogue[lang][i - 1],
                    "scene": scene,
                }
                for i, scene in enumerate(request["scenes"], 1)
            ],
        }
        for lang in ("ru", "kk")
    }


def png(color="yellow"):
    output = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(output, format="PNG")
    return output.getvalue()


class DeterministicText:
    def __init__(self, callback=None):
        self.calls = []
        self.callback = callback

    async def generate(self, prompt, schema):
        self.calls.append((prompt, schema))
        if self.callback:
            self.callback()
        return story_for(prompt)


class DeterministicImages:
    def __init__(self, fail_at=None):
        self.calls = []
        self.fail_at = fail_at

    async def generate(self, prompt, reference=None):
        self.calls.append((prompt, reference))
        if len(self.calls) == self.fail_at:
            raise ProviderError("provider_unavailable", stage="gemini_http:503")
        return png((len(self.calls) * 20, 100, 140))


@pytest.fixture
def setup(tmp_path):
    settings = Settings(data_dir=tmp_path, public_base_url="http://testserver")
    app = create_app(settings)
    with TestClient(app) as client:
        # Separate connection owner, as in the real standalone worker process.
        store = Store(tmp_path)
        yield settings, client, store


@pytest.mark.parametrize("grade", [5, 6])
@pytest.mark.parametrize("lang", ["ru", "kk"])
@pytest.mark.parametrize("difficulty", ["basic", "intermediate", "advanced"])
def test_generation_round_trip_and_restart(setup, grade, lang, difficulty):
    settings, client, store = setup
    body = REQUEST | {"grade": grade, "lang": lang, "difficulty": difficulty}
    response = client.post("/api/comic-jobs", json=body)
    assert response.status_code == 202
    accepted = response.json()
    assert set(accepted) == {"jobId", "status"}
    assert accepted["status"] == "queued"
    job_id = accepted["jobId"]
    assert client.get(f"/api/comic-jobs/{job_id}").json() == {
        "jobId": job_id,
        "status": "queued",
        "comicId": None,
        "errorCode": None,
    }

    def while_running():
        result = client.get(f"/api/comic-jobs/{job_id}").json()
        assert result["status"] == "running"
        assert result["comicId"] is result["errorCode"] is None

    text, images = DeterministicText(while_running), DeterministicImages()
    assert asyncio.run(Worker(store, text, images, settings).run_once())
    status = client.get(f"/api/comic-jobs/{job_id}").json()
    assert status["status"] == "ready" and status["errorCode"] is None
    comic_id = status["comicId"]

    # New API/store instances read persisted comics, images, job status and private answers.
    with TestClient(create_app(settings)) as restarted:
        assert restarted.get(f"/api/comic-jobs/{job_id}").json() == status
        responses = {}
        for language in ("ru", "kk"):
            response = restarted.get(f"/api/comics/{comic_id}?lang={language}")
            assert response.status_code == 200
            comic = response.json()
            responses[language] = comic
            assert set(comic) == {"id", "lang", "title", "panels", "exercise"}
            assert comic["id"] == comic_id and comic["lang"] == language
            assert [p["id"] for p in comic["panels"]] == list(range(1, 7))
            assert comic["panels"][3]["text"] == comic["exercise"]["prompt"]
            for panel in comic["panels"]:
                assert set(panel) == {
                    "id",
                    "speaker",
                    "text",
                    "imageKey",
                    "imageUrl",
                    "imageAspect",
                }
                assert panel["imageAspect"] == 1.0
                assert panel["imageUrl"].startswith("http://testserver/api/comic-images/")
                image_response = restarted.get(
                    panel["imageUrl"], headers={"Origin": "http://localhost:5173"}
                )
                assert image_response.status_code == 200
                assert image_response.headers["content-type"] == "image/png"
                assert image_response.headers["access-control-allow-origin"]
                Image.open(io.BytesIO(image_response.content)).verify()
            exercise_id = comic["exercise"]["id"]
            assert exercise_id != "pizza-share"
            expected = Fraction(store.exercise(exercise_id)["expected"])
            for answer, outcome in [
                (f"{expected.numerator}/{expected.denominator}", "correct"),
                (f"{expected.numerator * 7}/{expected.denominator * 7}", "correct"),
                ("0/1", "incorrect"),
                ("1/0", "invalid"),
                ("0.5", "invalid"),
            ]:
                checked = restarted.post(
                    f"/api/exercises/{exercise_id}/check",
                    json={"answer": answer, "lang": language},
                )
                assert checked.status_code == 200
                assert checked.json()["status"] == outcome
            for step in (1, 2):
                hint = restarted.get(
                    f"/api/exercises/{exercise_id}/hints?lang={language}&step={step}"
                ).json()
                assert hint["step"] == step and hint["hasMore"] == (step == 1)
                assert str(expected) not in hint["text"]
            serialized = json.dumps(comic)
            for private_field in ("expected", "solution", "hints", "api_key", "image_prompt"):
                assert private_field not in serialized
        assert responses["ru"]["title"] != responses["kk"]["title"]
        assert responses["ru"]["exercise"]["id"] == responses["kk"]["exercise"]["id"]

    assert len(text.calls) == 1 and len(images.calls) == 6
    reference = images.calls[0][1]
    assert reference is not None
    with Image.open(io.BytesIO(reference)) as cast:
        assert cast.size == (960, 240)
    assert all(call[1] == reference for call in images.calls)
    for prompt, _ in images.calls:
        assert "No embedded text" in prompt
        assert all(name in prompt for name in ("Aldiyar:", "Aruna:", "Pifik:"))
        assert "fixed_problem_inputs" not in prompt
    assert all("closed" in prompt for prompt, _ in images.calls[:4])
    assert "lifts the pizza-box lid" in images.calls[4][0]
    assert "enjoy their fair picnic" in images.calls[5][0]
    assert not asyncio.run(Worker(store, text, images, settings).run_once())


@pytest.mark.parametrize(
    "change",
    [
        {"grade": 4},
        {"grade": 7},
        {"grade": True},
        {"grade": 5.0},
        {"grade": "5"},
        {"topic": "algebra"},
        {"lang": "en"},
        {"difficulty": "expert"},
        {"expected": "1/2"},
        {"apiKey": "secret"},
    ],
)
def test_reject_invalid_jobs(setup, change):
    _, client, _ = setup
    assert client.post("/api/comic-jobs", json=REQUEST | change).status_code == 422


def test_missing_fields_unknown_resources_and_cors(setup):
    _, client, _ = setup
    assert client.post("/api/comic-jobs", json={}).status_code == 422
    assert client.post("/api/comic-jobs", content="{bad").status_code == 422
    for path in (
        "/api/comic-jobs/missing",
        "/api/comics/missing",
        "/api/comic-images/missing/1.png",
        "/api/exercises/missing/hints",
    ):
        assert client.get(path).status_code == 404
    assert client.post("/api/exercises/missing/check", json={"answer": "1/2"}).status_code == 404
    assert client.get("/api/comics/missing?lang=en").status_code == 422
    response = client.options(
        "/api/comic-jobs",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_independent_exercises_and_queued_jobs_survive_api_close(setup):
    settings, client, store = setup
    ids = [client.post("/api/comic-jobs", json=REQUEST).json()["jobId"] for _ in range(2)]
    exercises = []
    worker = Worker(Store(settings.data_dir), DeterministicText(), DeterministicImages(), settings)
    for job_id in ids:
        assert asyncio.run(worker.run_once())
        comic_id = store.job(job_id).comicId
        exercises.append(client.get(f"/api/comics/{comic_id}").json()["exercise"]["id"])
    assert len(set(exercises)) == 2


def test_queue_survives_disconnected_client(tmp_path):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        job_id = client.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    store = Store(tmp_path)
    assert store.job(job_id).status == "queued"
    asyncio.run(Worker(store, DeterministicText(), DeterministicImages(), settings).run_once())
    with TestClient(create_app(settings)) as client:
        assert client.get(f"/api/comic-jobs/{job_id}").json()["status"] == "ready"


def test_prepared_comic_reuses_art_and_never_calls_an_image_provider(setup):
    settings, client, store = setup
    settings = replace(settings, provider="gemini", art_mode="prepared")
    job_id = client.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    cast = ["pifik", "aruna", "aldiyar", "pifik", "aruna", "aldiyar"]

    class PreparedText:
        async def generate(self, prompt, schema):
            assert schema == PreparedStory.model_json_schema()
            scenes = json.loads(prompt)["prepared_panels"]
            assert [scene["speaker"] for scene in scenes] == cast
            assert [scene["scene"] for scene in scenes] == list(SCENES)
            assert "imagined situation" in prompt
            story = story_for(prompt)
            for language in story.values():
                for panel, speaker in zip(language["panels"], cast, strict=True):
                    panel["speaker"] = speaker
            return story

    async def run():
        async with configured_providers(settings) as (_, image):
            assert image is None
            await Worker(store, PreparedText(), image, settings).run_once()

    asyncio.run(run())
    status = store.job(job_id)
    assert status.status == "ready"
    assert list(store.images_dir.iterdir()) == []
    # The API is using its default live configuration and can still read this comic.
    comic = client.get(f"/api/comics/{status.comicId}?lang=kk").json()
    assert comic["artwork"] == "prepared"
    assert [panel["speaker"] for panel in comic["panels"]] == ["Пифик", "Аруна", "Алдияр"] * 2
    for idx, panel in enumerate(comic["panels"], 1):
        assert panel["imageUrl"].endswith(f"/api/prepared-art/{idx}.jpg")
        response = client.get(panel["imageUrl"])
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        Image.open(io.BytesIO(response.content)).verify()
    assert client.get("/api/prepared-art/7.jpg").status_code == 404


def test_prepared_story_rejects_a_speaker_that_does_not_match_the_art():
    from app.story import StoryRuleError, text_prompt

    problem = Problem(("5/6",), 4)
    prompt = text_prompt(JobRequest(**REQUEST), problem, prepared=True)
    story = story_for(prompt)
    for language in story.values():
        for panel, description in zip(
            language["panels"], json.loads(prompt)["prepared_panels"], strict=True
        ):
            panel["speaker"] = description["speaker"]
    story["kk"]["panels"][1]["speaker"] = "aldiyar"
    with pytest.raises(StoryRuleError, match=r"kk\.panels\[1\]\.speaker: prepared_scene_speaker"):
        validate_story(story, problem, prepared=True)


def test_image_failure_cleans_files_and_next_job_runs(setup, caplog):
    settings, client, store = setup
    first, second = [client.post("/api/comic-jobs", json=REQUEST).json()["jobId"] for _ in range(2)]
    with caplog.at_level("INFO", logger="app.worker"):
        asyncio.run(Worker(store, DeterministicText(), DeterministicImages(3), settings).run_once())
    assert f"Job {first} provider stage: image:panel_3:gemini_http:503" in caplog.text
    result = client.get(f"/api/comic-jobs/{first}").json()
    assert result == {
        "jobId": first,
        "status": "failed",
        "comicId": None,
        "errorCode": "image_generation_failed",
    }
    assert list(store.images_dir.iterdir()) == []
    assert store.comic(first) is None
    asyncio.run(Worker(store, DeterministicText(), DeterministicImages(), settings).run_once())
    assert store.job(second).status == "ready"


@pytest.mark.parametrize("failure", ["malformed", "timeout", "provider", "unexpected", "image"])
def test_safe_failures(setup, failure):
    settings, client, store = setup
    if failure == "timeout":
        settings = Settings(data_dir=settings.data_dir, job_timeout=0.01)
    job_id = client.post("/api/comic-jobs", json=REQUEST).json()["jobId"]

    class FailingText:
        async def generate(self, prompt, schema):
            if failure == "malformed":
                return {"expected": "secret"}
            if failure == "timeout":
                await asyncio.sleep(5)
            if failure == "provider":
                raise ProviderError("provider_authentication")
            if failure == "unexpected":
                raise RuntimeError("secret-key-do-not-expose")
            return story_for(prompt)

    class BadImage:
        async def generate(self, prompt, reference=None):
            return b"not an image secret"

    images = BadImage() if failure == "image" else DeterministicImages()
    asyncio.run(Worker(store, FailingText(), images, settings).run_once())
    response = client.get(f"/api/comic-jobs/{job_id}")
    result = response.json()
    assert result["status"] == "failed" and result["comicId"] is None
    assert (
        result["errorCode"]
        == {
            "malformed": "invalid_provider_output",
            "timeout": "job_timeout",
            "provider": "provider_authentication",
            "unexpected": "generation_failed",
            "image": "image_generation_failed",
        }[failure]
    )
    assert "secret" not in response.text
    assert list(store.images_dir.iterdir()) == []


def test_worker_cancellation_and_crash_recovery(setup):
    settings, client, store = setup
    job_id = client.post("/api/comic-jobs", json=REQUEST).json()["jobId"]

    class CancelText:
        async def generate(self, prompt, schema):
            raise asyncio.CancelledError()

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(Worker(store, CancelText(), DeterministicImages(), settings).run_once())
    assert store.job(job_id).errorCode == "worker_interrupted"
    job_id = store.enqueue(JobRequest(**REQUEST))
    claim = store.claim(100)
    assert claim["id"] == job_id
    assert Store(settings.data_dir).claim(100) is None  # No double claim.
    with store.connection() as db:
        db.execute("UPDATE jobs SET lease_expires=? WHERE id=?", (time.time() - 1, job_id))
    assert store.claim(100) is None
    assert store.job(job_id).errorCode == "worker_interrupted"
    with pytest.raises(RuntimeError):
        store.publish(claim, "no", {}, "no", "1/2", {})
    assert store.comic("no") is None


@pytest.mark.parametrize(
    "bad_text",
    [
        "Ответ 3/4",
        "Ответ 6 / 8",
        "три четверти",
        "төрттен үш",
        "үштен екі",
        "¾",
        "Ответ half",
        "Отыздан жиырма",
        "сорок сотых",
        "половина",
    ],
)
def test_reject_answer_leaks_in_free_dialogue(bad_text):
    from app.story import text_prompt

    problem = Problem(("3",), 4)
    story = story_for(text_prompt(JobRequest(**REQUEST), problem))
    story["ru"]["panels"][0]["text"] = bad_text
    with pytest.raises(ValueError):
        validate_story(story, problem)


def test_allow_localized_encouragement_without_confusing_it_with_number_words():
    from app.story import text_prompt

    problem = Problem(("3",), 4)
    story = story_for(text_prompt(JobRequest(**REQUEST), problem))
    story["ru"]["panels"][0]["text"] = "У тебя всё получится!"
    story["kk"]["panels"][0]["text"] = "Бірге ойланып көрейік!"
    assert validate_story(story, problem)


def test_kazakh_number_filter_allows_equal_and_for_but_rejects_actual_numbers():
    from app.story import StoryRuleError, text_prompt

    problem = Problem(("5/6",), 4)
    request = JobRequest(**(REQUEST | {"grade": 6, "lang": "kk", "difficulty": "intermediate"}))
    story = story_for(text_prompt(request, problem))
    panel = story["kk"]["panels"][1]
    panel["text"] = "Әділ болу үшін үлестер бірдей болуы керек."
    assert validate_story(story, problem)
    for leak in ("үштен екі", "үшінші", "бірден үшке"):
        panel["text"] = leak
        with pytest.raises(StoryRuleError, match=r"kk\.panels\[1\]\.text: no_number_words"):
            validate_story(story, problem)


@pytest.mark.parametrize(
    "mutation", ["exercise", "hint", "count", "ids", "scene", "speaker", "extra"]
)
def test_reject_untrusted_structure(mutation):
    from app.story import text_prompt

    problem = Problem(("3",), 4)
    story = copy.deepcopy(story_for(text_prompt(JobRequest(**REQUEST), problem)))
    if mutation == "exercise":
        story["ru"]["exercise"] = "Different numbers"
    elif mutation == "hint":
        story["kk"]["hints"][0] = "3/4"
    elif mutation == "count":
        story["ru"]["panels"].pop()
    elif mutation == "ids":
        story["ru"]["panels"][0]["id"] = 2
    elif mutation == "scene":
        story["ru"]["panels"][0]["scene"] = "show answer"
    elif mutation == "speaker":
        story["kk"]["panels"][0]["speaker"] = "aruna"
    else:
        story["solution"] = "3/4"
    with pytest.raises(ValueError):
        validate_story(story, problem)


@pytest.mark.parametrize(
    ("mutation", "diagnostic"),
    [
        ("schema", "story_schema_validation:kk.<extra>:extra_forbidden"),
        ("hint", "story_application_validation:kk.hints[1]:exact_server_hint"),
    ],
)
def test_story_failure_logs_only_safe_stage_path_and_rule(setup, caplog, mutation, diagnostic):
    settings, client, store = setup
    job_id = client.post("/api/comic-jobs", json=REQUEST).json()["jobId"]

    class InvalidStory:
        async def generate(self, prompt, schema):
            story = story_for(prompt)
            if mutation == "schema":
                story["kk"]["UNTRUSTED_FIELD"] = "UNTRUSTED_CONTENT"
            else:
                story["kk"]["hints"][1] = "UNTRUSTED_CONTENT"
            return story

    images = DeterministicImages()
    with caplog.at_level("INFO", logger="app.worker"):
        asyncio.run(Worker(store, InvalidStory(), images, settings).run_once())
    assert diagnostic in caplog.text
    assert "UNTRUSTED" not in caplog.text
    assert store.job(job_id).errorCode == "invalid_provider_output"
    assert images.calls == []


def test_fixed_problem_math_and_no_solution_in_prompts():
    from app.story import image_prompt, text_prompt

    problem = Problem(("5/6", "3/8"), 4)
    assert problem.expected == Fraction(29, 96)
    prompt = text_prompt(JobRequest(**(REQUEST | {"difficulty": "advanced"})), problem)
    assert json.loads(prompt)["fixed_problem_inputs"] == {"portions": ["5/6", "3/8"], "friends": 4}
    assert "29/96" not in prompt
    for scene in LIVE_SCENES:
        image = image_prompt(scene)
        assert "29/96" not in image and "5/6" not in image and "3/8" not in image


def test_incomplete_files_are_not_published(setup):
    _, client, store = setup
    directory = store.images_dir / "unpublished"
    directory.mkdir()
    (directory / "1.png").write_bytes(png())
    assert client.get("/api/comic-images/unpublished/1.png").status_code == 404
    assert client.get("/api/comic-images/../comics.sqlite3/1.png").status_code == 404


def test_simultaneous_workers_cannot_claim_same_job(setup):
    settings, client, store = setup
    job_id = client.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    stores = [Store(settings.data_dir) for _ in range(8)]
    with ThreadPoolExecutor(max_workers=8) as executor:
        claims = list(executor.map(lambda instance: instance.claim(100), stores))
    claimed = [claim for claim in claims if claim is not None]
    assert len(claimed) == 1 and claimed[0]["id"] == job_id
    assert store.job(job_id).status == "running"


def test_generated_exercise_uses_server_math_not_model_answers(setup):
    settings, client, store = setup
    job_id = client.post("/api/comic-jobs", json=REQUEST | {"difficulty": "advanced"}).json()[
        "jobId"
    ]
    # Fix inputs independently of the provider and random template selection.
    with store.connection() as db:
        db.execute(
            "UPDATE jobs SET problem=? WHERE id=?",
            (json.dumps({"portions": ["5/6", "3/8"], "friends": 4}), job_id),
        )
    asyncio.run(Worker(store, DeterministicText(), DeterministicImages(), settings).run_once())
    comic_id = store.job(job_id).comicId
    exercise_id = client.get(f"/api/comics/{comic_id}").json()["exercise"]["id"]
    for answer, status in [("29/96", "correct"), ("58/192", "correct"), ("3/4", "incorrect")]:
        assert (
            client.post(f"/api/exercises/{exercise_id}/check", json={"answer": answer}).json()[
                "status"
            ]
            == status
        )
