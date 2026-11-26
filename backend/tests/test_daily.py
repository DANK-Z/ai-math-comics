"""Daily task streaks, the review of past mistakes and the teacher's class summary."""

import asyncio
from datetime import UTC, date, datetime, timedelta

from test_accounts import auth, make_class, student, teacher
from test_accounts import env as env

from app import daily, practice
from app.db import AnalyticsLog, Database, default_database_url
from app.practice import GcdProblem


def answer(client, token, task_id, text):
    return client.post(
        "/api/me/daily/answer",
        json={"taskId": task_id, "answer": text, "lang": "ru"},
        headers=auth(token),
    )


def test_daily_task_pays_once_and_streak_bonuses(env, monkeypatch):
    _, client = env
    monkeypatch.setattr(practice, "make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    token = student(client, "aruna", "Аруна")
    start = date(2026, 11, 2)
    coins_before = client.get("/api/me", headers=auth(token)).json()["profile"]["coins"]
    paid = []
    for offset in range(3):
        monkeypatch.setattr(daily, "almaty_today", lambda o=offset: start + timedelta(days=o))
        task = client.get("/api/me/daily", headers=auth(token)).json()
        assert task["solved"] is False and task["streak"] == offset
        assert client.get("/api/me/daily", headers=auth(token)).json()["taskId"] == task["taskId"]
        assert answer(client, token, task["taskId"], "5").json()["status"] == "incorrect"
        result = answer(client, token, task["taskId"], "6").json()
        assert result["status"] == "correct" and result["daily"]["solved"] is True
        paid.append(result["coins"])
        assert answer(client, token, task["taskId"], "6").status_code == 409
    assert paid == [5, 5, 5 + 15]  # the third day in a row pays the 3-day bonus
    assert result["bonus"] == {"days": 3, "coins": 15}
    assert result["daily"]["nextBonus"] == {"days": 7, "coins": 40}
    coins = client.get("/api/me", headers=auth(token)).json()["profile"]["coins"]
    assert coins == coins_before + 30

    # A missed day breaks the streak; the drill endpoint does not take daily tasks.
    monkeypatch.setattr(daily, "almaty_today", lambda: start + timedelta(days=4))
    task = client.get("/api/me/daily", headers=auth(token)).json()
    assert task["streak"] == 0
    drill = client.post(
        "/api/me/practice/answer",
        json={"taskId": task["taskId"], "answer": "6", "lang": "ru"},
        headers=auth(token),
    )
    assert drill.status_code == 404


def test_review_brings_back_lesson_and_boss_slips_after_two_days(env, monkeypatch):
    settings, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    kid = student(client, "aruna", "Аруна Омарова", school_class["code"])
    lesson = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "roads-flag", "answer": 4},
        headers=auth(teacher_token),
    ).json()
    url = f"/api/teacher/lessons/{lesson['id']}"
    client.post(url, json={"phase": "answering"}, headers=auth(teacher_token))
    client.post(f"/api/me/lesson/{lesson['id']}/answer", json={"answer": "7"}, headers=auth(kid))
    client.post(url, json={"phase": "closed"}, headers=auth(teacher_token))
    me = client.get("/api/me", headers=auth(kid)).json()

    async def slip():
        database = Database(settings.database_url or default_database_url(settings.data_dir))
        async with database.sessions() as session:
            for k in range(2):
                session.add(
                    AnalyticsLog(
                        student_id=me["id"],
                        comic_id="boss-1",
                        exercise_id=f"boss-1-r{k}",
                        topic="equations",
                        skill="div",
                        round_number=2,
                        status="incorrect",
                        mistake_count=k + 1,
                        text_entered="7",
                        created_at=datetime.now(UTC),
                    )
                )
            await session.commit()
        await database.dispose()

    asyncio.run(slip())
    assert client.get("/api/me/review", headers=auth(kid)).json() == []  # too fresh
    later = datetime.now(UTC) + timedelta(days=3)
    monkeypatch.setattr(daily, "now", lambda: later)
    items = client.get("/api/me/review", headers=auth(kid)).json()
    assert [(i["kind"], i.get("comicId"), i.get("skill"), i["mistakes"]) for i in items] == [
        ("drill", None, "div", 2),
        ("chapter", "roads-flag", None, 1),
    ]

    # Solving the chapter on the server takes it off the review.
    check = client.post("/api/chapters/roads-chase/check", json={"answer": "4"}, headers=auth(kid))
    assert check.status_code == 200
    items = client.get("/api/me/review", headers=auth(kid)).json()
    assert [i["kind"] for i in items] == ["drill"]


def test_class_summary_for_the_teacher(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    kids = [
        student(client, f"kid{i}", name, school_class["code"])
        for i, name in enumerate(["Аруна Омарова", "Дана"])
    ]
    lesson = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "roads-flag", "answer": 4},
        headers=auth(teacher_token),
    ).json()
    url = f"/api/teacher/lessons/{lesson['id']}"
    client.post(url, json={"phase": "answering"}, headers=auth(teacher_token))
    client.post(
        f"/api/me/lesson/{lesson['id']}/answer", json={"answer": "4"}, headers=auth(kids[0])
    )
    base = f"/api/teacher/classes/{school_class['id']}/summary"
    response = client.get(base, headers=auth(teacher_token))
    assert response.status_code == 200, response.text
    summary = response.json()
    assert (summary["days"], summary["students"]) == (7, 2)
    assert summary["lessons"] == [{"comicId": "roads-flag", "answered": 1, "correct": 1}]
    pupils = {p["name"]: p for p in summary["pupils"]}
    assert (pupils["Аруна О."]["answers"], pupils["Аруна О."]["activeDays"]) == (1, 1)
    assert pupils["Аруна О."]["lagging"] is False and pupils["Дана"]["lagging"] is True
    assert client.get(f"{base}?days=90", headers=auth(teacher_token)).json()["days"] == 90
    assert client.get(f"{base}?days=5", headers=auth(teacher_token)).status_code == 422
    other = teacher(client, email="other@school.kz")
    assert client.get(base, headers=auth(other)).status_code == 404


def test_quiz_can_have_the_teachers_own_problem(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    kid = student(client, "aruna", "Аруна", school_class["code"])
    lesson = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "roads-flag", "answer": 4},
        headers=auth(teacher_token),
    ).json()
    url = f"/api/teacher/lessons/{lesson['id']}/quiz"
    own = {"text": "Сколько будет 6 · 7?", "answer": 42}
    bad = client.post(
        url,
        json={"tasks": [{"comicId": "roads-hill", "text": "x y z", "answer": 1}, own, own]},
        headers=auth(teacher_token),
    )
    assert bad.status_code == 422
    board = client.post(
        url,
        json={"tasks": [own, {"comicId": "roads-hill", "answer": 9}, own]},
        headers=auth(teacher_token),
    ).json()
    assert (board["quiz"], board["stepText"], board["answer"]) == (
        ["", "roads-hill", ""],
        own["text"],
        42,
    )
    phone = client.get("/api/me/lesson", headers=auth(kid)).json()
    assert (phone["stepComicId"], phone["stepText"]) == (None, own["text"])
    result = client.post(
        f"/api/me/lesson/{lesson['id']}/answer", json={"answer": "42"}, headers=auth(kid)
    )
    assert result.status_code == 200
