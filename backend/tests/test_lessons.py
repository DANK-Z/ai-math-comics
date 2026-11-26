"""Lessons on the board (answers from phones) and homework with due dates."""

from datetime import date, timedelta

from test_accounts import auth, make_class, solve, student, teacher
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
    solve(client, aruna, "roads-chase", 4)
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


def test_lesson_retry_timer_chart_quiz_podium_and_report(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    kids = [
        student(client, f"kid{i}", name, school_class["code"])
        for i, name in enumerate(["Аруна Омарова", "Алдияр", "Дана"])
    ]
    lesson = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "roads-flag", "answer": 4},
        headers=auth(teacher_token),
    ).json()
    url = f"/api/teacher/lessons/{lesson['id']}"

    def board(**body):
        response = client.post(url, json=body, headers=auth(teacher_token))
        assert response.status_code == 200, response.text
        return response.json()

    def say(token, text):
        response = client.post(
            f"/api/me/lesson/{lesson['id']}/answer", json={"answer": text}, headers=auth(token)
        )
        assert response.status_code == 200, response.text
        return response.json()

    assert client.post(url, json={"timer": 45}, headers=auth(teacher_token)).status_code == 422
    # First try, no timer: who answered is listed, the answers are not.
    opened = board(phase="answering")
    assert opened["secondsLeft"] is None and len(opened["waiting"]) == 3
    say(kids[0], "4")
    say(kids[1], "7")
    view = client.get(url, headers=auth(teacher_token)).json()
    assert view["waiting"] == ["Дана"] and len(view["answeredIds"]) == 2
    assert view["chart"] == [] and view["correct"] is None
    say(kids[2], "x = 7")
    assert client.get(url, headers=auth(teacher_token)).json()["phase"] == "answering"
    first = board(phase="reveal")
    assert first["chart"] == [
        {"text": "4", "count": 1, "correct": True},
        {"text": "7", "count": 2, "correct": False},
    ]
    # Second try after the walkthrough, with a timer: it reveals itself once everyone answered.
    assert client.post(url, json={"retry": True}, headers=auth(teacher_token)).status_code == 200
    second = board(timer=60)
    assert (second["attempt"], second["phase"], second["answered"]) == (2, "answering", 0)
    assert (second["firstAnswered"], second["firstCorrect"]) == (3, 1)
    for kid in kids[:2]:
        say(kid, "4")
    assert say(kids[2], "7")["phase"] == "reveal"
    done = client.get(url, headers=auth(teacher_token)).json()
    assert (done["phase"], done["correct"], done["answered"]) == ("reveal", 2, 3)
    assert client.post(url, json={"retry": True}, headers=auth(teacher_token)).status_code == 409

    # Mini-quiz: three questions, points for right and quick answers, a podium with stars.
    quiz = client.post(
        f"{url}/quiz",
        json={
            "tasks": [
                {"comicId": "roads-bridge", "answer": 10},
                {"comicId": "roads-river", "answer": 20},
                {"comicId": "roads-hill", "answer": 30},
            ]
        },
        headers=auth(teacher_token),
    ).json()
    assert (quiz["step"], quiz["phase"], quiz["quiz"][0]) == (1, "answering", "roads-bridge")
    assert quiz["secondsLeft"] > 0 and quiz["answer"] == 10
    phone = client.get("/api/me/lesson", headers=auth(kids[0])).json()
    assert (phone["step"], phone["stepComicId"], phone["myAnswer"]) == (1, "roads-bridge", None)
    nxt = f"{url}/quiz/next"
    assert client.post(nxt, headers=auth(teacher_token)).status_code == 409  # not revealed
    for step, right in ((1, "10"), (2, "20"), (3, "30")):
        say(kids[0], right)
        say(kids[1], right if step > 1 else "1")
        say(kids[2], "0")
        assert client.post(nxt, headers=auth(teacher_token)).status_code == 200
    final = client.get(url, headers=auth(teacher_token)).json()
    assert final["phase"] == "podium"
    assert [(p["name"], p["place"], p["stars"]) for p in final["podium"]] == [
        ("Аруна О.", 1, 3),
        ("Алдияр", 2, 2),
    ]
    assert final["podium"][0]["points"] > 300
    phone = client.get("/api/me/lesson", headers=auth(kids[0])).json()
    assert (phone["place"], phone["stars"]) == (1, 3)
    league = client.get("/api/me/leaderboard", headers=auth(kids[0])).json()
    assert league["rows"][0]["name"] == "Аруна О." and league["rows"][0]["stars"] == 3

    # The report on the class page.
    board(phase="closed")
    reports = client.get(
        f"/api/teacher/classes/{school_class['id']}/lesson-reports", headers=auth(teacher_token)
    ).json()
    assert len(reports) == 1
    report = reports[0]
    assert report["first"] == {"answered": 3, "correct": 1}
    assert report["second"] == {"answered": 3, "correct": 2}
    assert {s["name"]: (s["first"], s["second"]) for s in report["students"]} == {
        "Аруна О.": (True, True),
        "Алдияр": (False, True),
        "Дана": (False, False),
    }
    assert len(report["podium"]) == 2

    # A drill only for those who slipped.
    dana_id = next(s["id"] for s in report["students"] if s["name"] == "Дана")
    base = f"/api/teacher/classes/{school_class['id']}/homework"
    due = (date.today() + timedelta(days=2)).isoformat()
    drill = client.post(
        base,
        json={"kind": "practice", "target": "equations", "dueDate": due, "studentIds": [dana_id]},
        headers=auth(teacher_token),
    ).json()
    assert (drill["targeted"], drill["total"], drill["students"][0]["name"]) == (True, 1, "Дана")
    assert [h["target"] for h in client.get("/api/me/homework", headers=auth(kids[2])).json()] == [
        "equations"
    ]
    assert client.get("/api/me/homework", headers=auth(kids[0])).json() == []
    stranger = client.post(
        base,
        json={"kind": "practice", "target": "equations", "dueDate": due, "studentIds": [999]},
        headers=auth(teacher_token),
    )
    assert stranger.status_code == 422
