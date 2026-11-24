"""Lessons on the board (answers from phones) and homework with due dates."""

from datetime import date, timedelta

from test_accounts import auth, make_class, student, teacher
from test_accounts import env as env

from app import practice
from app.practice import GcdProblem


def test_lesson_collects_answers_and_reveals_results(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    kids = [
        student(client, f"kid{i}", name, school_class["code"])
        for i, name in enumerate(["Аруна", "Алдияр", "Дана"])
    ]

    assert client.get("/api/me/lesson", headers=auth(kids[0])).json() is None
    bad = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "no-such-chapter", "answer": 4},
        headers=auth(teacher_token),
    )
    assert bad.status_code == 422
    lesson = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "roads-flag", "answer": 4},
        headers=auth(teacher_token),
    ).json()
    url = f"/api/teacher/lessons/{lesson['id']}"
    assert (lesson["phase"], lesson["students"], lesson["answered"]) == ("reading", 3, 0)

    view = client.get("/api/me/lesson", headers=auth(kids[0])).json()
    assert view["comicId"] == "roads-flag" and "answer" not in view

    def say(token, text):
        return client.post(
            f"/api/me/lesson/{lesson['id']}/answer", json={"answer": text}, headers=auth(token)
        )

    assert say(kids[0], "4").status_code == 409  # not answering yet
    client.post(url, json={"panel": 2, "phase": "answering"}, headers=auth(teacher_token))
    assert client.get("/api/me/lesson", headers=auth(kids[1])).json()["panel"] == 2
    assert say(kids[0], "7").json()["correct"] is None  # hidden until the reveal
    assert say(kids[0], "4").json()["myAnswer"] == "4"  # changed the answer
    say(kids[1], "7")
    assert say(kids[2], "четыре").status_code == 422
    board = client.get(url, headers=auth(teacher_token)).json()
    assert (board["answered"], board["correct"], board["wrong"]) == (2, None, [])

    board = client.post(url, json={"phase": "reveal"}, headers=auth(teacher_token)).json()
    assert (board["answered"], board["correct"]) == (2, 1)
    assert board["wrong"] == [{"text": "7", "count": 1}]
    assert client.get("/api/me/lesson", headers=auth(kids[0])).json()["correct"] is True
    assert say(kids[2], "4").status_code == 409  # too late

    # Other teachers can't see it; a closed lesson disappears for students.
    other = teacher(client, email="other@school.kz")
    assert client.get(url, headers=auth(other)).status_code == 404
    client.post(url, json={"phase": "closed"}, headers=auth(teacher_token))
    assert client.get("/api/me/lesson", headers=auth(kids[0])).json() is None


def test_homework_tracks_chapters_and_drills(env, monkeypatch):
    _, client = env
    monkeypatch.setattr(practice, "make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна Омарова", school_class["code"])
    student(client, "dana", "Дана", school_class["code"])
    due = (date.today() + timedelta(days=3)).isoformat()
    base = f"/api/teacher/classes/{school_class['id']}/homework"

    chapter = client.post(
        base,
        json={"kind": "chapter", "target": "roads-flag", "dueDate": due},
        headers=auth(teacher_token),
    )
    assert chapter.status_code == 201, chapter.text
    assert (chapter.json()["done"], chapter.json()["total"]) == (0, 2)
    drill = client.post(
        base,
        json={"kind": "practice", "target": "gcd", "dueDate": due},
        headers=auth(teacher_token),
    )
    assert drill.status_code == 201
    late = client.post(
        base,
        json={"kind": "chapter", "target": "mars-crater", "dueDate": "2020-01-01"},
        headers=auth(teacher_token),
    ).json()
    assert late["overdue"] is True
    assert (
        client.post(
            base,
            json={"kind": "practice", "target": "poetry", "dueDate": due},
            headers=auth(teacher_token),
        ).status_code
        == 422
    )

    mine = client.get("/api/me/homework", headers=auth(aruna)).json()
    assert [(h["target"], h["done"], h["overdue"]) for h in mine] == [
        ("mars-crater", False, True),
        ("roads-flag", False, False),
        ("gcd", False, False),
    ]

    # Aruna finishes the chapter and a drill.
    client.put("/api/me/progress", json={"completedChapters": ["roads-flag"]}, headers=auth(aruna))
    task = client.post(
        "/api/me/practice", json={"topic": "gcd", "lang": "ru"}, headers=auth(aruna)
    ).json()
    for _ in range(5):
        task = client.post(
            "/api/me/practice/answer",
            json={"taskId": task["id"], "answer": "6", "lang": "ru"},
            headers=auth(aruna),
        ).json()["next"]

    mine = {h["target"]: h for h in client.get("/api/me/homework", headers=auth(aruna)).json()}
    assert mine["roads-flag"]["done"] and mine["gcd"]["done"] and not mine["mars-crater"]["done"]
    report = {h["target"]: h for h in client.get(base, headers=auth(teacher_token)).json()}
    assert (report["roads-flag"]["done"], report["gcd"]["done"]) == (1, 1)
    assert {s["name"]: s["done"] for s in report["roads-flag"]["students"]} == {
        "Аруна О.": True,
        "Дана": False,
    }

    # Deleting: only the owner.
    other = teacher(client, email="other@school.kz")
    hw_id = report["gcd"]["id"]
    assert client.delete(f"/api/teacher/homework/{hw_id}", headers=auth(other)).status_code == 404
    assert (
        client.delete(f"/api/teacher/homework/{hw_id}", headers=auth(teacher_token)).status_code
        == 204
    )
    assert len(client.get(base, headers=auth(teacher_token)).json()) == 2
