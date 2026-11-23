"""Weekly class leaderboard and class battles (runs on SQLite, and PostgreSQL when configured)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from test_accounts import answer, auth, generate_comic, make_class, student, teacher
from test_accounts import env as env

from app import classroom
from app.problems import EquationProblem


def put_progress(client, token, *chapters):
    response = client.put(
        "/api/me/progress", json={"completedChapters": list(chapters)}, headers=auth(token)
    )
    assert response.status_code == 200, response.text


def test_week_starts_on_monday_in_almaty():
    # Sunday 20:00 UTC is already Monday 01:00 in Almaty.
    start = classroom.week_start(datetime(2026, 11, 22, 20, 0, tzinfo=UTC))
    assert start == datetime(2026, 11, 22, 19, 0, tzinfo=UTC)
    assert classroom.short_name("Даниал Ахметов") == "Даниал А."
    assert classroom.short_name("Аруна") == "Аруна"


def test_leaderboard_ranks_the_class_by_this_weeks_earnings(env):
    settings, client = env
    teacher_token = teacher(client)
    code = make_class(client, teacher_token)["code"]
    other_code = make_class(client, teacher_token, letter="Б")["code"]
    aruna = student(client, "aruna", "Аруна Серикова", code)
    aldiyar = student(client, "aldiyar", "Алдияр", code)
    dana = student(client, "dana", "Дана", code)
    student(client, "stranger", "Чужой", other_code)

    # Aldiyar: a perfect boss win (3 stars, 40 coins). Aruna: 10 coins of chapter rewards.
    _, rounds = generate_comic(settings, client)
    for rid, x in rounds:
        answer(client, aldiyar, rid, str(x))
    put_progress(client, aruna, "roads-flag", "roads-bridge")

    board = client.get("/api/me/leaderboard", headers=auth(aruna))
    assert board.status_code == 200, board.text
    rows = board.json()["rows"]
    assert [(r["rank"], r["name"], r["stars"], r["coins"], r["cleanWins"]) for r in rows] == [
        (1, "Алдияр", 3, 40, 1),
        (2, "Аруна С.", 0, 10, 0),
        (3, "Дана", 0, 0, 0),
    ]
    assert [r["me"] for r in rows] == [False, True, False]
    assert board.json()["classSize"] == 3

    # Spending in the shop does not change the weekly table.
    client.post("/api/v1/shop/buy", json={"itemId": "smart-glasses"}, headers=auth(aldiyar))
    assert client.get("/api/me/leaderboard", headers=auth(dana)).json()["rows"][0]["coins"] == 40

    # The teacher sees the same table; other teachers and classless students see nothing.
    class_id = client.get("/api/teacher/classes", headers=auth(teacher_token)).json()[0]["id"]
    teacher_view = client.get(
        f"/api/teacher/classes/{class_id}/leaderboard", headers=auth(teacher_token)
    )
    assert [r["name"] for r in teacher_view.json()["rows"]] == ["Алдияр", "Аруна С.", "Дана"]
    other = teacher(client, email="other@school.kz")
    forbidden = client.get(f"/api/teacher/classes/{class_id}/leaderboard", headers=auth(other))
    assert forbidden.status_code == 404
    loner = student(client, "loner", "Одиночка")
    assert client.get("/api/me/leaderboard", headers=auth(loner)).status_code == 404


def fixed_problem(monkeypatch):
    # x + 3 = 10 -> x = 7, for every task.
    problem = EquationProblem("add", 3, 10)
    monkeypatch.setattr(classroom, "new_problem", lambda battle, grade: problem)


def test_class_battle_shares_one_boss(env, monkeypatch):
    _, client = env
    fixed_problem(monkeypatch)
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна", school_class["code"])
    aldiyar = student(client, "aldiyar", "Алдияр", school_class["code"])

    assert client.get("/api/me/battle", headers=auth(aruna)).json() is None
    start = client.post(
        f"/api/teacher/classes/{school_class['id']}/battles",
        json={"topic": "equations", "hp": 300},
        headers=auth(teacher_token),
    )
    assert start.status_code == 201, start.text
    battle_id = start.json()["id"]
    assert start.json()["hp"] == 300

    view = client.get("/api/me/battle?lang=kk", headers=auth(aruna)).json()
    assert view["status"] == "active" and view["hp"] == 300
    assert "x + 3 = 10" in view["task"]["prompt"] and "expected" not in str(view)

    def hit(token, text):
        task = client.get("/api/me/battle", headers=auth(token)).json()["task"]["id"]
        response = client.post(
            f"/api/me/battle/{battle_id}/answer",
            json={"taskId": task, "answer": text, "lang": "ru"},
            headers=auth(token),
        )
        assert response.status_code == 200, response.text
        return response.json()

    assert hit(aruna, "8")["status"] == "incorrect"
    assert hit(aruna, "семь")["status"] == "invalid"
    result = hit(aruna, "7")
    assert (result["status"], result["damage"], result["battle"]["hp"]) == ("correct", 10, 290)
    assert hit(aldiyar, "x = 7")["battle"]["hp"] == 280

    # The same task cannot be paid twice.
    task = client.get("/api/me/battle", headers=auth(aruna)).json()["task"]["id"]
    body = {"taskId": task, "answer": "7", "lang": "ru"}
    client.post(f"/api/me/battle/{battle_id}/answer", json=body, headers=auth(aruna))
    again = client.post(f"/api/me/battle/{battle_id}/answer", json=body, headers=auth(aruna))
    assert again.json()["damage"] == 0

    board = client.get(f"/api/teacher/battles/{battle_id}", headers=auth(teacher_token)).json()
    assert (board["hp"], board["hits"], board["fighters"]) == (270, 3, 2)
    assert board["top"][0] == {"name": "Аруна", "hits": 2}
    assert board["classCode"] == school_class["code"]

    # Other classes' students and teachers can't see or hit this boss.
    other_teacher = teacher(client, email="other@school.kz")
    outsider = student(client, "outsider", "Чужой", make_class(client, other_teacher)["code"])
    response = client.post(f"/api/me/battle/{battle_id}/answer", json=body, headers=auth(outsider))
    assert response.status_code == 404
    response = client.get(f"/api/teacher/battles/{battle_id}", headers=auth(other_teacher))
    assert response.status_code == 404


def test_three_misses_swap_the_problem(env, monkeypatch):
    _, client = env
    fixed_problem(monkeypatch)
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна", school_class["code"])
    battle = client.post(
        f"/api/teacher/classes/{school_class['id']}/battles",
        json={"topic": "equations", "hp": 300},
        headers=auth(teacher_token),
    ).json()["id"]
    first = client.get("/api/me/battle", headers=auth(aruna)).json()["task"]["id"]
    for _ in range(3):
        result = client.post(
            f"/api/me/battle/{battle}/answer",
            json={"taskId": first, "answer": "1", "lang": "ru"},
            headers=auth(aruna),
        ).json()
    assert result["battle"]["task"]["id"] != first


def test_whole_class_beats_the_boss_exactly_once(env, monkeypatch):
    _, client = env
    fixed_problem(monkeypatch)
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    tokens = [student(client, f"kid{i}", "Ученик", school_class["code"]) for i in range(4)]
    battle = client.post(
        f"/api/teacher/classes/{school_class['id']}/battles",
        json={"topic": "equations", "hp": 300},
        headers=auth(teacher_token),
    ).json()["id"]

    def fight(token):
        dealt = 0
        for _ in range(12):
            view = client.get("/api/me/battle", headers=auth(token)).json()
            if view["status"] != "active":
                break
            result = client.post(
                f"/api/me/battle/{battle}/answer",
                json={"taskId": view["task"]["id"], "answer": "7", "lang": "ru"},
                headers=auth(token),
            ).json()
            dealt += result["damage"]
        return dealt

    with ThreadPoolExecutor(max_workers=4) as pool:
        dealt = sum(pool.map(fight, tokens))
    board = client.get(f"/api/teacher/battles/{battle}", headers=auth(teacher_token)).json()
    assert dealt == 300
    assert (board["hp"], board["status"]) == (0, "won")
    assert board["hits"] == 30
    # The class still sees the victory; there is no task to solve any more.
    view = client.get("/api/me/battle", headers=auth(tokens[0])).json()
    assert view["status"] == "won" and view["task"] is None

    # Stopping and starting again: a new battle replaces the old one.
    stopped = client.post(f"/api/teacher/battles/{battle}/stop", headers=auth(teacher_token))
    assert stopped.json()["status"] == "won"
    bad = client.post(
        f"/api/teacher/classes/{school_class['id']}/battles",
        json={"topic": "fractions", "hp": 5000},
        headers=auth(teacher_token),
    )
    assert bad.status_code == 422
