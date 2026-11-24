"""Joining a class from the board's QR code with a name and the phone's own key."""

from test_accounts import auth, make_class, teacher
from test_accounts import env as env

KEY = "phone-key-" + "x" * 30


def test_quick_join_creates_a_class_student_the_phone_can_sign_in_again(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    joined = client.post(
        "/api/auth/quick-join",
        json={"classCode": school_class["code"].lower(), "displayName": "Әлия", "deviceKey": KEY},
    )
    assert joined.status_code == 201, joined.text
    user = joined.json()["user"]
    assert user["role"] == "student" and user["schoolClass"]["id"] == school_class["id"]
    assert user["login"].startswith("aliya")

    # The same phone signs in again with its key; the class sees the student.
    again = client.post("/api/auth/login", json={"login": user["login"], "password": KEY})
    assert again.status_code == 200
    dashboard = client.get(
        f"/api/teacher/classes/{school_class['id']}", headers=auth(teacher_token)
    ).json()
    assert [s["displayName"] for s in dashboard["students"]] == ["Әлия"]

    # Another phone typing the same name gets its own account, never Aliya's.
    other = client.post(
        "/api/auth/quick-join",
        json={"classCode": school_class["code"], "displayName": "Әлия", "deviceKey": "y" * 30},
    ).json()["user"]
    assert other["id"] != user["id"]


def test_quick_join_rejects_bad_input(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    unknown = client.post(
        "/api/auth/quick-join",
        json={"classCode": "NOPE-5A-2026", "displayName": "Әлия", "deviceKey": KEY},
    )
    assert unknown.status_code == 404
    short_key = client.post(
        "/api/auth/quick-join",
        json={"classCode": school_class["code"], "displayName": "Әлия", "deviceKey": "short"},
    )
    assert short_key.status_code == 422
    bad_name = client.post(
        "/api/auth/quick-join",
        json={"classCode": school_class["code"], "displayName": "R2D2", "deviceKey": KEY},
    )
    assert bad_name.status_code == 422
