"""Teacher-made student accounts, password resets and the review-drill report."""

from test_accounts import auth, make_class, student, teacher
from test_accounts import env as env

from app import practice
from app.practice import GcdProblem
from app.roster import easy_password, latin


def login(client, user, password):
    return client.post("/api/auth/login", json={"login": user, "password": password})


def test_helpers():
    assert latin("Әлия") == "aliya"
    assert latin("Нұрсұлтан") == "nursultan"
    assert latin("Щука") == "shuka"
    for _ in range(50):
        word, digits = easy_password().split("-")
        assert len(word) >= 3 and len(digits) == 4 and digits.isdigit()


def test_teacher_creates_students_and_resets_a_password(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    created = client.post(
        f"/api/teacher/classes/{school_class['id']}/students",
        json={"names": ["Әлия Сапарова", "Тимур"]},
        headers=auth(teacher_token),
    )
    assert created.status_code == 201, created.text
    aliya, timur = created.json()
    assert aliya["login"].startswith("aliya") and timur["login"].startswith("timur")
    assert aliya["login"] != timur["login"]

    signed = login(client, aliya["login"], aliya["password"])
    assert signed.status_code == 200
    me = signed.json()["user"]
    assert me["displayName"] == "Әлия Сапарова" and me["schoolClass"]["id"] == school_class["id"]
    assert me["profile"]["coins"] == 0

    old_token = signed.json()["token"]
    assert client.get("/api/me", headers=auth(old_token)).status_code == 200
    reset = client.post(
        f"/api/teacher/classes/{school_class['id']}/students/{aliya['id']}/password",
        headers=auth(teacher_token),
    )
    assert reset.status_code == 200
    assert login(client, aliya["login"], aliya["password"]).status_code == 401
    # The reset signs the student out everywhere: the old session no longer works.
    assert client.get("/api/me", headers=auth(old_token)).status_code == 401
    assert login(client, aliya["login"], reset.json()["password"]).status_code == 200

    # Another teacher can't touch this class; nobody can reset a student of another class.
    other = teacher(client, email="other@school.kz")
    forbidden = client.post(
        f"/api/teacher/classes/{school_class['id']}/students/{aliya['id']}/password",
        headers=auth(other),
    )
    assert forbidden.status_code == 404
    other_class = make_class(client, other)
    stranger = client.post(
        f"/api/teacher/classes/{other_class['id']}/students/{aliya['id']}/password",
        headers=auth(other),
    )
    assert stranger.status_code == 404
    # Students can't use teacher tools; bad names are rejected.
    student_token = student(client, "kid", "Ребёнок", school_class["code"])
    denied = client.post(
        f"/api/teacher/classes/{school_class['id']}/students",
        json={"names": ["Хакер"]},
        headers=auth(student_token),
    )
    assert denied.status_code == 403
    bad = client.post(
        f"/api/teacher/classes/{school_class['id']}/students",
        json={"names": ["R2D2"]},
        headers=auth(teacher_token),
    )
    assert bad.status_code == 422


def test_practice_report(env, monkeypatch):
    _, client = env
    monkeypatch.setattr(practice, "make_problem", lambda *a, **k: GcdProblem("gcd", 12, 18))
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна", school_class["code"])
    student(client, "dana", "Дана", school_class["code"])
    task = client.post(
        "/api/me/practice", json={"topic": "gcd", "lang": "ru"}, headers=auth(aruna)
    ).json()
    for _ in range(5):
        task = client.post(
            "/api/me/practice/answer",
            json={"taskId": task["id"], "answer": "6", "lang": "ru"},
            headers=auth(aruna),
        ).json()["next"]
    client.post("/api/me/practice", json={"topic": "decimals", "lang": "ru"}, headers=auth(aruna))

    report = client.get(
        f"/api/teacher/classes/{school_class['id']}/practice", headers=auth(teacher_token)
    )
    assert report.status_code == 200, report.text
    rows = {r["displayName"]: r for r in report.json()["students"]}
    assert rows["Аруна"]["drills"] == 2 and rows["Аруна"]["finished"] == 1
    assert rows["Аруна"]["solved"] == 5 and rows["Аруна"]["topics"] == {"gcd": 5}
    assert rows["Аруна"]["lastAt"]
    assert rows["Дана"]["drills"] == 0 and rows["Дана"]["lastAt"] is None
    assert report.json()["students"][0]["displayName"] == "Аруна"
