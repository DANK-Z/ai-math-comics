"""Accounts: sign-up/sign-in with roles, class codes, coins from boss fights, dashboard.

Runs on SQLite by default. Set TEST_DATABASE_URL (e.g. the docker-compose PostgreSQL,
postgresql+asyncpg://amc:amc-dev-password@127.0.0.1:5433/amc_test) to run the same tests
on PostgreSQL too. Its tables are dropped and recreated for every test: never use the dev `amc`.
"""

import asyncio
import os
from datetime import UTC, datetime, timedelta
from fractions import Fraction

import jwt
import pytest
from fastapi.testclient import TestClient
from test_generation import DeterministicImages, DeterministicText

from app.config import Settings
from app.db import Base, Database
from app.main import create_app
from app.storage import Store
from app.worker import Worker

DATABASES = ["sqlite"] + (["postgres"] if os.getenv("TEST_DATABASE_URL") else [])
EQUATIONS = {"grade": 5, "topic": "equations", "lang": "ru", "difficulty": "intermediate"}
YEAR = datetime.now(UTC).year


@pytest.fixture(params=DATABASES)
def env(request, tmp_path):
    url = ""
    if request.param == "postgres":
        url = os.environ["TEST_DATABASE_URL"]

        async def reset():
            database = Database(url)
            async with database.engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
            await database.dispose()

        asyncio.run(reset())
    settings = Settings(
        data_dir=tmp_path,
        art_mode="live",
        public_base_url="http://testserver",
        database_url=url,
        jwt_secret="test-secret-" + "x" * 32,
    )
    with TestClient(create_app(settings)) as client:
        yield settings, client


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def teacher(client, email="aigul@school.kz", name="Айгуль Серикова"):
    response = client.post(
        "/api/auth/teachers", json={"email": email, "password": "teacher-pass", "displayName": name}
    )
    assert response.status_code == 201, response.text
    return response.json()["token"]


def student(client, login, name, code=None):
    body = {"login": login, "password": "student-pass", "displayName": name}
    if code:
        body["classCode"] = code
    response = client.post("/api/auth/students", json=body)
    assert response.status_code == 201, response.text
    return response.json()["token"]


def make_class(client, token, letter="А", school="KOKSH"):
    response = client.post(
        "/api/teacher/classes",
        json={"grade": 5, "letter": letter, "school": school},
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def generate_comic(settings, client):
    job = client.post("/api/comic-jobs", json=EQUATIONS).json()["jobId"]
    worker = Worker(Store(settings.data_dir), DeterministicText(), DeterministicImages(), settings)
    assert asyncio.run(worker.run_once())
    comic_id = client.get(f"/api/comic-jobs/{job}").json()["comicId"]
    comic = client.get(f"/api/comics/{comic_id}?lang=ru").json()
    store = Store(settings.data_dir)
    rounds = [
        (r["exerciseId"], int(Fraction(store.exercise(r["exerciseId"])["expected"])))
        for r in comic["boss"]["rounds"]
    ]
    return comic_id, rounds


def answer(client, token, exercise_id, text):
    headers = auth(token) if token else {}
    response = client.post(
        f"/api/exercises/{exercise_id}/check", json={"answer": text, "lang": "ru"}, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_student_and_teacher_sign_up_and_sign_in(env):
    _, client = env
    token = student(client, "Aruna_5a", "Аруна")
    me = client.get("/api/me", headers=auth(token)).json()
    assert me["role"] == "student" and me["login"] == "aruna_5a" and "email" not in me
    assert me["profile"] == {
        "coins": 0,
        "stars": 0,
        "completedChapters": [],
        "stickers": [],
        "items": [],
    }

    signed_in = client.post(
        "/api/auth/login", json={"login": " ARUNA_5A ", "password": "student-pass"}
    )
    assert signed_in.status_code == 200 and signed_in.json()["user"]["displayName"] == "Аруна"

    teacher_token = teacher(client)
    me = client.get("/api/me", headers=auth(teacher_token)).json()
    assert me["role"] == "teacher" and me["email"] == "aigul@school.kz" and "profile" not in me
    by_email = client.post(
        "/api/auth/login", json={"login": "AIGUL@school.kz", "password": "teacher-pass"}
    )
    assert by_email.json()["user"]["role"] == "teacher"


@pytest.mark.parametrize(
    "body",
    [
        {"login": "ab", "password": "student-pass", "displayName": "Аруна"},
        {"login": "аруна", "password": "student-pass", "displayName": "Аруна"},  # Cyrillic login
        {"login": "aruna", "password": "short", "displayName": "Аруна"},
        {"login": "aruna", "password": "student-pass", "displayName": "Аруна5"},
        {"login": "aruna", "password": "student-pass", "displayName": "<b>"},
        {"login": "aruna", "password": "student-pass", "displayName": "Аруна", "role": "teacher"},
    ],
)
def test_sign_up_validation(env, body):
    _, client = env
    assert client.post("/api/auth/students", json=body).status_code == 422


def test_duplicates_wrong_passwords_and_bad_tokens(env):
    _, client = env
    student(client, "aldiyar", "Алдияр")
    duplicate = client.post(
        "/api/auth/students",
        json={"login": "ALDIYAR", "password": "another-pass", "displayName": "Ещё"},
    )
    assert duplicate.status_code == 409 and duplicate.json()["detail"] == "login_taken"
    teacher(client)
    assert (
        client.post(
            "/api/auth/teachers",
            json={"email": "aigul@school.kz", "password": "x" * 8, "displayName": "Двойник"},
        ).status_code
        == 409
    )
    for login, password in [("aldiyar", "wrong-pass"), ("nobody", "student-pass")]:
        response = client.post("/api/auth/login", json={"login": login, "password": password})
        assert (
            response.status_code == 401 and response.json()["detail"] == "wrong_login_or_password"
        )
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers=auth("not-a-token")).status_code == 401
    expired = jwt.encode(
        {"sub": "1", "role": "student", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        "test-secret-" + "x" * 32,
        algorithm="HS256",
    )
    assert client.get("/api/me", headers=auth(expired)).status_code == 401
    forged = jwt.encode(
        {"sub": "1", "role": "teacher", "exp": datetime.now(UTC) + timedelta(hours=1)},
        "another-secret-" + "y" * 32,
        algorithm="HS256",
    )
    assert client.get("/api/me", headers=auth(forged)).status_code == 401


def test_roles_are_enforced(env):
    _, client = env
    student_token = student(client, "aruna", "Аруна")
    teacher_token = teacher(client)
    assert client.get("/api/teacher/classes", headers=auth(student_token)).status_code == 403
    assert (
        client.post(
            "/api/teacher/classes", json={"grade": 5, "letter": "А"}, headers=auth(student_token)
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/me/class", json={"code": "AMC-5A-2026"}, headers=auth(teacher_token)
        ).status_code
        == 403
    )
    assert client.put("/api/me/progress", json={}, headers=auth(teacher_token)).status_code == 403


def test_class_codes_and_joining(env):
    _, client = env
    token = teacher(client)
    first = make_class(client, token)
    assert (
        first["name"] == "5 «А»" and first["code"] == f"KOKSH-5A-{YEAR}" and first["students"] == 0
    )
    second = make_class(client, token)
    assert second["code"] == f"KOKSH-5A-{YEAR}-2"
    kazakh = make_class(client, token, letter="ә", school="amc")
    assert kazakh["name"] == "5 «Ә»" and kazakh["code"] == f"AMC-5A-{YEAR}"

    aruna = student(client, "aruna", "Аруна", code=first["code"].lower())
    assert (
        client.get("/api/me", headers=auth(aruna)).json()["schoolClass"]["teacherName"]
        == "Айгуль Серикова"
    )
    aldiyar = student(client, "aldiyar", "Алдияр")
    joined = client.post(
        "/api/me/class", json={"code": f" {second['code']} "}, headers=auth(aldiyar)
    )
    assert joined.json()["schoolClass"]["name"] == "5 «А»"
    assert (
        client.post("/api/me/class", json={"code": "NOPE-0000"}, headers=auth(aldiyar)).status_code
        == 404
    )
    bad = client.post(
        "/api/auth/students",
        json={
            "login": "ghost",
            "password": "student-pass",
            "displayName": "Гость",
            "classCode": "NOPE-1",
        },
    )
    assert bad.status_code == 404

    classes = client.get("/api/teacher/classes", headers=auth(token)).json()
    assert [(c["code"], c["students"]) for c in classes] == [
        (first["code"], 1),
        (second["code"], 1),
        (kazakh["code"], 0),
    ]


def test_season_progress_only_grows(env):
    _, client = env
    token = student(client, "aruna", "Аруна")
    client.put(
        "/api/me/progress",
        json={
            "completedChapters": ["pizza-fractions", "school-store-discount"],
            "stickers": ["price-tag"],
        },
        headers=auth(token),
    )
    me = client.put(
        "/api/me/progress", json={"completedChapters": ["school-quest-map"]}, headers=auth(token)
    ).json()
    assert me["profile"]["completedChapters"] == [
        "pizza-fractions",
        "school-quest-map",
        "school-store-discount",
    ]
    assert me["profile"]["stickers"] == ["price-tag"]
    assert (
        client.put(
            "/api/me/progress", json={"completedChapters": ["../etc"]}, headers=auth(token)
        ).status_code
        == 422
    )


def test_boss_fight_awards_coins_once_and_survives_reload(env):
    settings, client = env
    token = student(client, "aruna", "Аруна")
    comic_id, rounds = generate_comic(settings, client)
    (r1, x1), (r2, x2), (r3, x3) = rounds

    # A guest's answers are checked but never logged.
    assert "reward" not in answer(client, None, r1, str(x1))

    assert answer(client, token, r1, "икс")["status"] == "invalid"
    assert answer(client, token, r1, f"x = {x1}")["status"] == "correct"
    state = client.get(f"/api/me/boss/{comic_id}", headers=auth(token)).json()
    assert state == {"comicId": comic_id, "cleared": 1, "misses": 1}

    assert "reward" not in answer(client, token, r2, str(x2))
    result = answer(client, token, r3, f"{x3},0")
    assert result["reward"] == {"coins": 30, "stars": 2, "misses": 1, "totalCoins": 30}
    # Re-solving does not pay again.
    assert "reward" not in answer(client, token, r3, str(x3))

    state = client.get(f"/api/me/boss/{comic_id}", headers=auth(token)).json()
    assert state["cleared"] == 3 and state["result"] == {"stars": 2, "misses": 1, "coins": 30}
    profile = client.get("/api/me", headers=auth(token)).json()["profile"]
    assert (profile["coins"], profile["stars"]) == (30, 2)

    # A stale token never blocks a check: the student simply plays as a guest.
    assert answer(client, "expired-or-broken", r1, str(x1))["status"] == "correct"


def test_perfect_fight_gives_three_stars(env):
    settings, client = env
    token = student(client, "aldiyar", "Алдияр")
    _, rounds = generate_comic(settings, client)
    rewards = [answer(client, token, rid, str(x)).get("reward") for rid, x in rounds]
    assert rewards[:2] == [None, None]
    assert rewards[2] == {"coins": 40, "stars": 3, "misses": 0, "totalCoins": 40}


def test_teacher_dashboard_ranks_students_and_finds_the_hardest_round(env):
    settings, client = env
    teacher_token = teacher(client)
    code = make_class(client, teacher_token)["code"]
    comic_id, rounds = generate_comic(settings, client)
    (r1, x1), (r2, x2), (r3, x3) = rounds

    aruna = student(client, "aruna", "Аруна", code)  # perfect: 3 stars
    for rid, x in rounds:
        answer(client, aruna, rid, str(x))
    aldiyar = student(client, "aldiyar", "Алдияр", code)  # slips twice in round 2
    answer(client, aldiyar, r1, str(x1))
    answer(client, aldiyar, r2, str(x2 + 1))
    answer(client, aldiyar, r2, "не знаю")
    answer(client, aldiyar, r2, str(x2))
    answer(client, aldiyar, r3, str(x3))
    dana = student(client, "dana", "Дана", code)  # stuck in round 2
    answer(client, dana, r1, str(x1))
    answer(client, dana, r2, str(x2 + 1))
    student(client, "outsider", "Чужой")  # not in the class

    classes = client.get("/api/teacher/classes", headers=auth(teacher_token)).json()
    dashboard = client.get(
        f"/api/teacher/classes/{classes[0]['id']}", headers=auth(teacher_token)
    ).json()
    assert [s["login"] for s in dashboard["students"]] == ["aruna", "aldiyar", "dana"]
    aruna_row, aldiyar_row, dana_row = dashboard["students"]
    assert aruna_row["topics"] == {"equations": {"beaten": 1, "bestStars": 3, "stars": 3}}
    assert (aruna_row["stars"], aruna_row["coins"], aruna_row["bestCombo"]) == (3, 40, 3)
    assert (aldiyar_row["stars"], aldiyar_row["misses"], aldiyar_row["bossesBeaten"]) == (2, 2, 1)
    assert (dana_row["stars"], dana_row["bossesBeaten"], dana_row["topics"]) == (0, 0, {})

    cells = {c["round"]: c for c in dashboard["heatmap"]}
    assert cells[1]["mistakeRate"] == 0 and cells[1]["students"] == 3
    hard = cells[2]
    assert (hard["students"], hard["studentsWithMistakes"], hard["mistakeRate"]) == (3, 2, 0.67)
    assert hard["invalidAnswers"] == 1 and hard["commonWrong"][0] == str(x2 + 1)
    assert hard["skill"] in {"mul", "div"}
    assert dashboard["recommendation"] == {
        "topic": "equations",
        "round": 2,
        "skill": hard["skill"],
        "mistakeRate": 0.67,
    }

    other = teacher(client, email="other@school.kz", name="Другой Учитель")
    assert (
        client.get(f"/api/teacher/classes/{classes[0]['id']}", headers=auth(other)).status_code
        == 404
    )
    del comic_id
