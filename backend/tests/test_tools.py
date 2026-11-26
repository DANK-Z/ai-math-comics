"""Objective codes, printable drills, own tasks, messages, duels, mock tests and events."""

from datetime import date, timedelta

from test_accounts import auth, make_class, student, teacher
from test_accounts import env as env
from test_family import parent

from app import daily, events, practice
from app.practice import GcdProblem


def test_objective_codes_and_printable_drill(env):
    _, client = env
    token = teacher(client)
    put = client.put(
        "/api/teacher/objective-codes/roads-flag",
        json={"codes": "  5.1.2.1;   5.1.2.3 "},
        headers=auth(token),
    )
    assert put.json() == {"roads-flag": "5.1.2.1; 5.1.2.3"}
    assert (
        client.put(
            "/api/teacher/objective-codes/nope", json={"codes": "1"}, headers=auth(token)
        ).status_code
        == 404
    )
    cleared = client.put(
        "/api/teacher/objective-codes/roads-flag", json={"codes": ""}, headers=auth(token)
    )
    assert cleared.json() == {}

    drill = client.get(
        "/api/teacher/print/drill?topic=gcd&count=4&lang=kk", headers=auth(token)
    ).json()
    assert len(drill) == 4 and all(p["prompt"] and p["answer"] for p in drill)
    kid = student(client, "aruna", "Аруна")
    assert client.get("/api/teacher/print/drill?topic=gcd", headers=auth(kid)).status_code == 403


def test_teacher_task_as_a_comic(env):
    _, client = env
    token = teacher(client)
    school_class = make_class(client, token)
    kid = student(client, "aruna", "Аруна", school_class["code"])
    base = f"/api/teacher/classes/{school_class['id']}/tasks"
    bad = client.post(
        base,
        json={"hero": "aruna", "scene": "roads-flag", "textRu": "Сколько?", "answer": "много"},
        headers=auth(token),
    )
    assert bad.status_code == 422
    made = client.post(
        base,
        json={
            "hero": "aruna",
            "scene": "roads-flag",
            "textRu": "У Аруны 3 яблока и 4 груши. Сколько всего фруктов?",
            "answer": "7",
        },
        headers=auth(token),
    ).json()
    assert (made["solved"], made["total"]) == (0, 1) and made["textKk"].startswith("У Аруны")
    mine = client.get("/api/me/tasks", headers=auth(kid)).json()
    assert mine[0]["answer"] is None and mine[0]["textKk"].startswith("У Аруны")
    url = f"/api/me/tasks/{made['id']}/answer"
    assert client.post(url, json={"answer": "6"}, headers=auth(kid)).json()["status"] == "incorrect"
    assert client.post(url, json={"answer": "7"}, headers=auth(kid)).json() == {
        "status": "correct",
        "tries": 2,
    }
    report = client.get(base, headers=auth(token)).json()[0]
    assert (report["solved"], report["students"][0]["tries"]) == (1, 2)


def test_messages_between_teacher_and_parent(env):
    _, client = env
    token = teacher(client)
    school_class = make_class(client, token)
    kid = student(client, "aruna", "Аруна Омарова", school_class["code"])
    me = client.get("/api/me", headers=auth(kid)).json()
    url = f"/api/teacher/students/{me['id']}/messages"
    assert client.post(url, json={"text": "Здравствуйте"}, headers=auth(token)).status_code == 409

    mama = parent(client)
    code = client.get("/api/me/family-code", headers=auth(kid)).json()["code"]
    client.post("/api/parent/children", json={"code": code}, headers=auth(mama))
    sent = client.post(
        url,
        json={"text": "Аруна пропустила две домашки", "link": "#/class"},
        headers=auth(token),
    ).json()
    assert sent[0]["messages"][0]["link"] == "#/class"
    threads = client.get("/api/parent/messages", headers=auth(mama)).json()
    assert (threads[0]["unread"], threads[0]["studentName"]) == (1, "Аруна О.")
    reply = client.post(
        "/api/parent/messages",
        json={"teacherId": threads[0]["teacherId"], "studentId": me["id"], "text": "Спасибо!"},
        headers=auth(mama),
    ).json()
    assert [m["sender"] for m in reply[0]["messages"]] == ["teacher", "parent"]
    client.post(
        "/api/parent/messages/read",
        json={"otherId": threads[0]["teacherId"], "studentId": me["id"]},
        headers=auth(mama),
    )
    assert client.get("/api/parent/messages", headers=auth(mama)).json()[0]["unread"] == 0
    assert client.get("/api/teacher/messages", headers=auth(token)).json()[0]["unread"] == 1
    other = teacher(client, email="other@school.kz")
    assert (
        client.post(
            "/api/parent/messages",
            json={"teacherId": 999, "studentId": me["id"], "text": "?"},
            headers=auth(mama),
        ).status_code
        == 404
    )
    assert client.post(url, json={"text": "x"}, headers=auth(other)).status_code == 404


def test_duel_by_class_and_by_code(env, monkeypatch):
    _, client = env
    monkeypatch.setattr(practice, "make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    monkeypatch.setattr("app.duels.make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    token = teacher(client)
    school_class = make_class(client, token)
    aruna = student(client, "aruna", "Аруна", school_class["code"])
    dana = student(client, "dana", "Дана", school_class["code"])

    first = client.post(
        "/api/me/duels", json={"topic": "gcd", "mode": "class"}, headers=auth(aruna)
    ).json()
    assert first["status"] == "waiting"
    second = client.post(
        "/api/me/duels", json={"topic": "gcd", "mode": "class"}, headers=auth(dana)
    ).json()
    assert (second["id"], second["status"], second["opponentName"]) == (
        first["id"],
        "active",
        "Аруна",
    )
    url = f"/api/me/duels/{first['id']}/answer"
    assert (
        client.post(url, json={"answer": "5", "lang": "ru"}, headers=auth(aruna)).json()["status"]
        == "incorrect"
    )
    for _ in range(5):
        result = client.post(url, json={"answer": "6", "lang": "ru"}, headers=auth(aruna)).json()
    assert (result["duel"]["result"], result["duel"]["coins"]) == ("won", 10)
    lost = client.get(f"/api/me/duels/{first['id']}", headers=auth(dana)).json()
    assert (lost["result"], lost["me"], lost["opponent"]) == ("lost", 0, 5)

    by_code = client.post(
        "/api/me/duels", json={"topic": "gcd", "mode": "code"}, headers=auth(aruna)
    ).json()
    assert (
        client.post(
            "/api/me/duels/join", json={"code": by_code["code"]}, headers=auth(aruna)
        ).status_code
        == 409
    )
    joined = client.post(
        "/api/me/duels/join", json={"code": by_code["code"].lower()}, headers=auth(dana)
    )
    assert joined.json()["status"] == "active"


def test_mock_test_and_walkthrough(env):
    _, client = env
    kid = student(client, "aruna", "Аруна")
    test = client.post("/api/me/prep/tests?lang=kk", headers=auth(kid)).json()
    assert len(test["problems"]) == 10 and test["minutes"] == 25
    from app.prep import BANK

    answers = {p["id"]: str(BANK[p["id"]][0]) for p in test["problems"][:7]}
    answers[test["problems"][7]["id"]] = "0"
    result = client.post(
        f"/api/me/prep/tests/{test['id']}/submit",
        json={"answers": answers, "lang": "ru"},
        headers=auth(kid),
    ).json()
    assert (result["score"], result["total"]) == (7, 10)
    assert all(p["solution"] for p in result["problems"])
    again = client.post(
        f"/api/me/prep/tests/{test['id']}/submit",
        json={"answers": {}, "lang": "ru"},
        headers=auth(kid),
    )
    assert again.status_code == 409
    assert client.get("/api/me/prep/history", headers=auth(kid)).json()[0]["score"] == 7


def test_bank_answers_match_solutions():
    from app.prep import BANK

    for pid, (answer, *_rest, sol_ru, sol_kk) in BANK.items():
        assert str(answer) in sol_ru and str(answer) in sol_kk, pid


def test_seasonal_event_frame(env, monkeypatch):
    _, client = env
    monkeypatch.setattr(practice, "make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    kid = student(client, "aruna", "Аруна")
    start = date(2026, 11, 25)
    monkeypatch.setattr(events, "EVENTS", {"winter": (11, 20, 1, 10, 2, "frame-winter")})
    for offset in range(2):
        day = start + timedelta(days=offset)
        monkeypatch.setattr(daily, "almaty_today", lambda d=day: d)
        monkeypatch.setattr(events, "almaty_today", lambda d=day: d)
        if offset == 0:
            event = client.get("/api/me/event", headers=auth(kid)).json()
            assert (event["id"], event["progress"], event["target"]) == ("winter", 0, 2)
            assert client.post("/api/me/event/claim", headers=auth(kid)).status_code == 409
        task = client.get("/api/me/daily", headers=auth(kid)).json()
        client.post(
            "/api/me/daily/answer",
            json={"taskId": task["taskId"], "answer": "6", "lang": "ru"},
            headers=auth(kid),
        )
    claimed = client.post("/api/me/event/claim", headers=auth(kid)).json()
    assert (claimed["progress"], claimed["claimed"]) == (2, True)
    shop = client.get("/api/v1/shop", headers=auth(kid)).json()
    assert any(c["id"] == "frame-winter" and c["owned"] for c in shop["cosmetics"])
    monkeypatch.setattr(events, "almaty_today", lambda: date(2026, 6, 1))
    assert client.get("/api/me/event", headers=auth(kid)).json() is None
