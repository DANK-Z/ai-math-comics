import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.parametrize("lang", ["ru", "kk"])
def test_comic_contract(lang):
    response = client.get("/api/comics/pizza-fractions", params={"lang": lang})
    assert response.status_code == 200
    comic = response.json()
    assert set(comic) == {"id", "lang", "title", "panels", "exercise"}
    assert comic["id"] == "pizza-fractions"
    assert comic["lang"] == lang
    assert comic["title"]
    assert [panel["id"] for panel in comic["panels"]] == list(range(1, 7))
    assert [panel["imageKey"] for panel in comic["panels"]] == [
        f"pizza-{index:02d}" for index in range(1, 7)
    ]
    for panel in comic["panels"]:
        assert set(panel) == {"id", "speaker", "text", "imageKey"}
        assert panel["speaker"] and panel["text"]
    exercise = comic["exercise"]
    assert set(exercise) == {"id", "panelId", "prompt"}
    assert exercise["id"] == "pizza-share"
    assert exercise["panelId"] == 4
    assert exercise["prompt"] == comic["panels"][3]["text"]
    if lang == "ru":
        assert "Три одинаковые пиццы" in exercise["prompt"]
        assert "четырьмя друзьями" in exercise["prompt"]
    else:
        assert "Үш бірдей пиццаны" in exercise["prompt"]
        assert "төрт дос" in exercise["prompt"]


@pytest.mark.parametrize("lang", ["ru", "kk"])
@pytest.mark.parametrize(
    ("answer", "status"),
    [
        ("3/4", "correct"),
        ("6/8", "correct"),
        ("9/12", "correct"),
        ("  +003 / +004  ", "correct"),
        ("-3/-4", "correct"),
        ("3000000000000000000000000000000/4000000000000000000000000000000", "correct"),
        ("75000000000000000001/100000000000000000000", "incorrect"),
        ("2/3", "incorrect"),
        ("4/3", "incorrect"),
        ("0/4", "incorrect"),
        ("-3/4", "incorrect"),
        ("3/-4", "incorrect"),
        ("1/0", "invalid"),
        ("0/0", "invalid"),
        ("3/-0", "invalid"),
        ("", "invalid"),
        ("  ", "invalid"),
        ("pizza", "invalid"),
        ("3/4/5", "invalid"),
        ("3//4", "invalid"),
        ("3.0/4", "invalid"),
        ("0.75", "invalid"),
        ("3", "invalid"),
        ("1e3/4", "invalid"),
        ("3_0/40", "invalid"),
        ("٣/٤", "invalid"),
        ("NaN", "invalid"),
    ],
)
def test_fraction_check(answer, status, lang):
    response = client.post(
        "/api/exercises/pizza-share/check", json={"answer": answer, "lang": lang}
    )
    assert response.status_code == 200
    result = response.json()
    assert set(result) == {"status", "message"}
    assert result["status"] == status
    assert result["message"]


@pytest.mark.parametrize("lang", ["ru", "kk"])
@pytest.mark.parametrize(("step", "has_more"), [(1, True), (2, False)])
def test_progressive_hints(lang, step, has_more):
    response = client.get("/api/exercises/pizza-share/hints", params={"lang": lang, "step": step})
    assert response.status_code == 200
    hint = response.json()
    assert set(hint) == {"step", "text", "hasMore"}
    assert hint["step"] == step
    assert hint["hasMore"] is has_more
    assert hint["text"]
    assert "3/4" not in hint["text"]
    assert "төрттен үш" not in hint["text"].lower()
    assert "три четверти" not in hint["text"].lower()


def test_content_is_localized():
    russian = client.get("/api/comics/pizza-fractions?lang=ru").json()
    kazakh = client.get("/api/comics/pizza-fractions?lang=kk").json()
    assert russian["title"] != kazakh["title"]
    assert russian["exercise"]["prompt"] != kazakh["exercise"]["prompt"]
    for ru_panel, kk_panel in zip(russian["panels"], kazakh["panels"]):
        assert ru_panel["text"] != kk_panel["text"]
    for answer in ["3/4", "1/2", "1/0"]:
        feedback = [
            client.post(
                "/api/exercises/pizza-share/check", json={"answer": answer, "lang": lang}
            ).json()["message"]
            for lang in ["ru", "kk"]
        ]
        assert feedback[0] != feedback[1]
    for step in [1, 2]:
        hints = [
            client.get(
                "/api/exercises/pizza-share/hints", params={"lang": lang, "step": step}
            ).json()["text"]
            for lang in ["ru", "kk"]
        ]
        assert hints[0] != hints[1]
    assert (
        client.get("/api/exercises/pizza-share/hints?step=1").json()["text"]
        != client.get("/api/exercises/pizza-share/hints?step=2").json()["text"]
    )


def test_defaults():
    assert client.get("/api/comics/pizza-fractions").json()["lang"] == "ru"
    hint = client.get("/api/exercises/pizza-share/hints").json()
    assert hint["step"] == 1
    assert hint == client.get("/api/exercises/pizza-share/hints?lang=ru&step=1").json()
    feedback = client.post("/api/exercises/pizza-share/check", json={"answer": "3/4"}).json()
    assert (
        feedback
        == client.post(
            "/api/exercises/pizza-share/check", json={"answer": "3/4", "lang": "ru"}
        ).json()
    )


@pytest.mark.parametrize("lang", ["en", "RU", ""])
def test_unsupported_languages(lang):
    for path in ["/api/comics/pizza-fractions", "/api/exercises/pizza-share/hints"]:
        assert client.get(path, params={"lang": lang}).status_code == 422
    assert (
        client.post(
            "/api/exercises/pizza-share/check", json={"answer": "3/4", "lang": lang}
        ).status_code
        == 422
    )


@pytest.mark.parametrize("step", ["0", "3", "-1", "1.5", "abc", ""])
def test_unsupported_hint_steps(step):
    assert client.get("/api/exercises/pizza-share/hints", params={"step": step}).status_code == 422


@pytest.mark.parametrize(
    "body", [{}, {"answer": None}, {"answer": 0.75}, {"answer": [3, 4]}, {"answer": "1" * 257}]
)
def test_invalid_request_bodies(body):
    assert client.post("/api/exercises/pizza-share/check", json=body).status_code == 422


def test_malformed_json():
    assert (
        client.post(
            "/api/exercises/pizza-share/check",
            content="{broken",
            headers={"Content-Type": "application/json"},
        ).status_code
        == 422
    )


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_frontend_cors(origin):
    response = client.options(
        "/api/exercises/pizza-share/check",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    for response in [
        client.get("/api/comics/pizza-fractions", headers={"Origin": origin}),
        client.post(
            "/api/exercises/pizza-share/check",
            json={"answer": "3/4"},
            headers={"Origin": origin},
        ),
    ]:
        assert response.headers["access-control-allow-origin"] == origin
    response = client.get(
        "/api/comics/pizza-fractions", headers={"Origin": "http://unrelated.example"}
    )
    assert "access-control-allow-origin" not in response.headers


def test_pizza_chapter_uses_the_game_cast():
    for lang in ("ru", "kk"):
        comic = client.get(f"/api/comics/pizza-fractions?lang={lang}").json()
        assert {p["speaker"] for p in comic["panels"]} <= {"Пифик", "Аруна", "Алдияр"}
