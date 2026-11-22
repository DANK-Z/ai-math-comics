import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.library_episode import LibraryStory, validate_library_story
from app.main import create_app
from app.providers import ProviderError
from app.story import StoryRuleError
from app.worker import Worker

REQUEST = {
    "sourceChapterId": "school-quest-map",
    "choiceId": "library-cabinet-key",
    "locale": "kk",
}
STORY = {
    "ru": {
        "title": "Секрет библиотечного шкафа",
        "arrival": "Ключ привёл нас сюда!",
        "discovery": "Посмотрите на закрытые коробки!",
        "ending": "Теперь соберём книги для ярмарки!",
        "firstHint": "Обрати внимание на книги рядом.",
        "secondHint": "Присмотрись к одинаковым коробкам.",
    },
    "kk": {
        "title": "Кітапхана шкафының сыры",
        "arrival": "Кілт бізді осында алып келді!",
        "discovery": "Жабық қораптарға қараңдар!",
        "ending": "Енді жәрмеңкеге кітап жинайық!",
        "firstHint": "Қораптардың жанындағы кітаптарға назар аудар.",
        "secondHint": "Қораптардың ұқсастығына қара.",
    },
}


class LibraryTextFixture:
    def __init__(self, failure=None, result=STORY):
        self.failure = failure
        self.result = result
        self.inputs = None

    async def generate(self, prompt, schema):
        assert set(schema["properties"]) == {"ru", "kk"}
        assert "question" not in schema["$defs"]["LibraryText"]["properties"]
        content = json.loads(prompt)
        assert content["branch"]["sourceChapterId"] == REQUEST["sourceChapterId"]
        assert content["branch"]["choiceId"] == REQUEST["choiceId"]
        assert content["requested_language"] in {"ru", "kk"}
        self.inputs = content["fixed_problem_inputs"]
        assert set(self.inputs) == {"boxes", "loose_books", "total_books"}
        if self.failure:
            raise ProviderError(self.failure)
        return self.result


class NoImages:
    async def generate(self, *_):
        pytest.fail("Library episodes must reuse prepared art in every art mode")


@pytest.mark.parametrize("locale", ["ru", "kk"])
def test_continuation_job_and_bilingual_reader(tmp_path, locale):
    settings = Settings(data_dir=tmp_path, art_mode="live")
    app = create_app(settings)
    client = TestClient(app)
    # Even an old provider response carrying an invalid question cannot replace
    # the server-owned exercise or fail narrative validation.
    legacy_story = STORY | {
        "ru": STORY["ru"] | {"question": "Тридцать книг?"},
        "kk": STORY["kk"] | {"question": {"unexpected": 33}},
    }
    provider = LibraryTextFixture(result=legacy_story)
    worker = Worker(app.state.store, provider, NoImages(), settings)
    accepted = client.post("/api/continuation-jobs", json=REQUEST | {"locale": locale})
    assert accepted.status_code == 202
    job_path = f"/api/comic-jobs/{accepted.json()['jobId']}"
    assert client.get(job_path).json()["status"] == "queued"
    assert asyncio.run(worker.run_once())
    status = client.get(job_path).json()
    assert status["status"] == "ready"
    comic_id = status["comicId"]
    expected = (provider.inputs["total_books"] - 6) // 3
    assert 5 <= expected <= 12
    assert list(app.state.store.images_dir.iterdir()) == []
    for lang in ("ru", "kk"):
        comic = client.get(f"/api/comics/{comic_id}?lang={lang}").json()
        assert comic["lang"] == lang
        assert comic["artwork"] == "prepared"
        assert comic["title"] == STORY[lang]["title"]
        assert comic["continuation"] == {
            "sourceChapterId": REQUEST["sourceChapterId"],
            "choiceId": REQUEST["choiceId"],
            "nextChapterId": "library-boxes",
        }
        assert [panel["imageKey"] for panel in comic["panels"]] == [
            f"library-boxes-{i}" for i in range(1, 5)
        ]
        exercise = comic["exercise"]
        assert exercise["panelId"] == 3
        assert exercise["answerFormat"] == "whole-number"
        assert set(exercise) == {"id", "panelId", "prompt", "answerFormat"}
        assert f"3 × □ + 6 = {provider.inputs['total_books']}" in exercise["prompt"]
        assert comic["panels"][2]["text"] == exercise["prompt"]
        path = f"/api/exercises/{exercise['id']}"
        for answer, result in (
            (str(expected - 1), "incorrect"),
            ("2/3", "invalid"),
            (str(expected), "correct"),
        ):
            response = client.post(f"{path}/check", json={"answer": answer, "lang": lang})
            assert response.json()["status"] == result
        for step, field in enumerate(("firstHint", "secondHint"), 1):
            hint = client.get(f"{path}/hints?lang={lang}&step={step}").json()
            assert hint["text"].startswith(STORY[lang][field])
            assert hint["hasMore"] == (step == 1)


@pytest.mark.parametrize(
    ("lang", "number_word"),
    [("ru", "тридцать"), ("kk", "отыз"), ("kk", "бір")],
)
def test_model_owned_fields_still_reject_number_words(lang, number_word):
    assert "question" not in LibraryStory.model_json_schema()["$defs"]["LibraryText"]["required"]
    response = STORY | {lang: STORY[lang] | {"firstHint": number_word}}
    with pytest.raises(StoryRuleError) as failure:
        validate_library_story(response)
    assert (failure.value.path, failure.value.rule) == (f"{lang}.firstHint", "no_number_words")


def test_provider_failure_and_output_validation_are_terminal(tmp_path, caplog):
    settings = Settings(data_dir=tmp_path, art_mode="prepared")
    app = create_app(settings)
    client = TestClient(app)
    assert (
        client.post(
            "/api/continuation-jobs",
            json=REQUEST | {"choiceId": "new-route-note"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/continuation-jobs",
            json=REQUEST | {"fixedStoryFacts": {"answer": 8}},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/continuation-jobs",
            json=REQUEST | {"sourceChapterId": "pizza-fractions"},
        ).status_code
        == 422
    )

    broken = STORY | {"kk": STORY["kk"] | {"secondHint": "Жауабы 8 кітап."}}
    scenarios = [
        (LibraryTextFixture(failure="provider_unavailable"), "provider_unavailable"),
        (LibraryTextFixture(result=broken), "invalid_provider_output"),
        (LibraryTextFixture(), None),
    ]
    with caplog.at_level("INFO", logger="app.worker"):
        for provider, error in scenarios:
            job_id = client.post("/api/continuation-jobs", json=REQUEST).json()["jobId"]
            assert asyncio.run(Worker(app.state.store, provider, NoImages(), settings).run_once())
            status = client.get(f"/api/comic-jobs/{job_id}").json()
            assert status["status"] == ("failed" if error else "ready")
            assert status["errorCode"] == error
            assert bool(status["comicId"]) == (error is None)
    assert "kk.secondHint:no_numeric_characters_or_math_symbols" in caplog.text
    assert "Жауабы" not in caplog.text
