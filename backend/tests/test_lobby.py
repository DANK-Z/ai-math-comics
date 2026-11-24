"""The lobby on battle and lesson boards, and taking a student out of the class."""

from test_accounts import auth, make_class, student, teacher
from test_accounts import env as env


def test_lobby_lists_students_and_the_teacher_can_remove_one(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна Омарова", school_class["code"])
    joker = student(client, "joker", "Бэтмен", school_class["code"])
    battle = client.post(
        f"/api/teacher/classes/{school_class['id']}/battles",
        json={"topic": "equations", "hp": 300},
        headers=auth(teacher_token),
    ).json()
    board_url = f"/api/teacher/battles/{battle['id']}"
    assert client.get(board_url, headers=auth(teacher_token)).json()["present"] == []

    client.get("/api/me/battle", headers=auth(aruna))
    client.get("/api/me/battle", headers=auth(joker))
    present = client.get(board_url, headers=auth(teacher_token)).json()["present"]
    assert [p["name"] for p in present] == ["Аруна О.", "Бэтмен"]

    removed = client.post(
        f"/api/teacher/classes/{school_class['id']}/students/{present[1]['id']}/remove",
        headers=auth(teacher_token),
    )
    assert removed.status_code == 204
    assert [
        p["name"] for p in client.get(board_url, headers=auth(teacher_token)).json()["present"]
    ] == ["Аруна О."]
    assert client.get("/api/me/battle", headers=auth(joker)).status_code == 404  # no class now

    # The lesson board has the same lobby.
    lesson = client.post(
        f"/api/teacher/classes/{school_class['id']}/lessons",
        json={"comicId": "roads-flag", "answer": 4},
        headers=auth(teacher_token),
    ).json()
    client.get("/api/me/lesson", headers=auth(aruna))
    lesson_board = client.get(f"/api/teacher/lessons/{lesson['id']}", headers=auth(teacher_token))
    assert [p["name"] for p in lesson_board.json()["present"]] == ["Аруна О."]

    # Only the class's teacher can remove.
    other = teacher(client, email="other@school.kz")
    denied = client.post(
        f"/api/teacher/classes/{school_class['id']}/students/{present[0]['id']}/remove",
        headers=auth(other),
    )
    assert denied.status_code == 404
