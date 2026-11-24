"""Practice problems (new topics) and the solo review drill."""

import math
from fractions import Fraction

import pytest
from test_accounts import answer, auth, generate_comic, make_class, student, teacher
from test_accounts import env as env

from app import practice
from app.practice import DecimalProblem, GcdProblem, PartsProblem, check, from_stored, make_problem


@pytest.mark.parametrize("topic", practice.TOPICS)
@pytest.mark.parametrize("grade", [5, 6])
def test_every_topic_makes_sound_problems(topic, grade):
    for _ in range(200):
        problem = make_problem(topic, grade)
        restored = from_stored(problem.stored())
        assert restored.expected == problem.expected
        assert restored.prompt("ru") == problem.prompt("ru")
        assert problem.prompt("kk")
        assert problem.expected > 0
        if topic in ("gcd", "parts"):
            assert problem.expected.denominator == 1


def test_known_answers_and_formats():
    assert GcdProblem("gcd", 12, 18).expected == 6
    assert GcdProblem("lcm", 4, 6).expected == 12
    assert "НОД(12; 18)" in GcdProblem("gcd", 12, 18).prompt("ru")
    assert DecimalProblem("add", 25, 17).expected == Fraction(42, 10)
    assert "2,5 + 1,7" in DecimalProblem("add", 25, 17).prompt("ru")
    assert DecimalProblem("sub", 52, 17).expected == Fraction(35, 10)
    assert DecimalProblem("mul", 13, 3).expected == Fraction(39, 10)
    assert PartsProblem(40, 3, 5, True).expected == 25
    assert PartsProblem(40, 3, 5, False).expected == 15
    decimal = DecimalProblem("add", 25, 17)
    assert [check(decimal, a) for a in ("4,2", "4.2", "4,20", "42", "сорок")] == [
        "correct",
        "correct",
        "correct",
        "incorrect",
        "invalid",
    ]
    assert check(GcdProblem("lcm", 4, 6), str(math.lcm(4, 6))) == "correct"


def test_practice_drill_has_five_server_checked_problems(env, monkeypatch):
    _, client = env
    # НОД(12; 18) = 6 for every task, so the test knows the answer.
    monkeypatch.setattr(practice, "make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    token = student(client, "aruna", "Аруна")
    first = client.post(
        "/api/me/practice", json={"topic": "gcd", "lang": "ru"}, headers=auth(token)
    )
    assert first.status_code == 200, first.text
    task = first.json()
    assert task["number"] == 1 and task["total"] == 5 and "expected" not in task

    wrong = client.post(
        "/api/me/practice/answer",
        json={"taskId": task["id"], "answer": "100000", "lang": "kk"},
        headers=auth(token),
    ).json()
    assert wrong["status"] == "incorrect" and wrong["next"]["id"] == task["id"]
    for n in range(1, 6):
        result = client.post(
            "/api/me/practice/answer",
            json={"taskId": task["id"], "answer": "6", "lang": "ru"},
            headers=auth(token),
        ).json()
        assert result["status"] == "correct" and result["solved"] == n
        task = result["next"]
        if n < 5:
            assert task["number"] == n + 1
    assert task is None and "закреплена" in result["message"]

    # Another student can't answer someone else's task; guests can't practise.
    other = student(client, "aldiyar", "Алдияр")
    stray = client.post(
        "/api/me/practice", json={"topic": "decimals", "lang": "ru"}, headers=auth(token)
    ).json()
    response = client.post(
        "/api/me/practice/answer",
        json={"taskId": stray["id"], "answer": "1", "lang": "ru"},
        headers=auth(other),
    )
    assert response.status_code == 404
    assert client.post("/api/me/practice", json={"topic": "gcd", "lang": "ru"}).status_code == 401


def test_weak_spot_comes_from_boss_mistakes(env):
    settings, client = env
    token = student(client, "aruna", "Аруна")
    assert client.get("/api/me/practice/weak", headers=auth(token)).json() is None
    _, rounds = generate_comic(settings, client)
    first_round = rounds[0][0]
    answer(client, token, first_round, "999")
    assert client.get("/api/me/practice/weak", headers=auth(token)).json() is None  # once is chance
    answer(client, token, first_round, "998")
    weak = client.get("/api/me/practice/weak", headers=auth(token)).json()
    assert weak["topic"] == "equations" and weak["mistakes"] == 2 and weak["skill"]
    drill = client.post(
        "/api/me/practice",
        json={"topic": weak["topic"], "skill": weak["skill"], "lang": "ru"},
        headers=auth(token),
    )
    assert drill.status_code == 200 and "x" in drill.json()["prompt"]


def test_class_battle_on_a_new_topic(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна", school_class["code"])
    start = client.post(
        f"/api/teacher/classes/{school_class['id']}/battles",
        json={"topic": "decimals", "hp": 300},
        headers=auth(teacher_token),
    )
    assert start.status_code == 201, start.text
    view = client.get("/api/me/battle", headers=auth(aruna)).json()
    assert view["topic"] == "decimals" and view["task"]["answerFormat"] == "decimal"
    assert "Вычисли" in view["task"]["prompt"]
