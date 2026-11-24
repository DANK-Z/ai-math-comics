"""Parents: family codes, a child's summary, praise cards and weekly gift coins."""

from test_accounts import auth, coins, make_class, solve, student, teacher
from test_accounts import env as env


def parent(client, email="mama@family.kz", name="Гульнара Омарова"):
    response = client.post(
        "/api/auth/parents",
        json={"email": email, "password": "parent-pass", "displayName": name},
    )
    assert response.status_code == 201, response.text
    assert response.json()["user"]["role"] == "parent"
    return response.json()["token"]


def test_parent_follows_a_child_by_family_code(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна Омарова", school_class["code"])
    mama = parent(client)

    code = client.get("/api/me/family-code", headers=auth(aruna)).json()
    assert code["code"].startswith("AMC-") and code["parents"] == 0
    assert client.get("/api/me/family-code", headers=auth(aruna)).json()["code"] == code["code"]

    assert client.get("/api/parent/children", headers=auth(mama)).json() == []
    wrong = client.post("/api/parent/children", json={"code": "AMC-NOPE1234"}, headers=auth(mama))
    assert wrong.status_code == 404
    added = client.post(
        "/api/parent/children", json={"code": code["code"].lower()}, headers=auth(mama)
    )
    assert added.status_code == 201, added.text
    child = added.json()
    assert (child["name"], child["className"], child["chaptersMonth"]) == (
        "Аруна Омарова",
        "5 «А»",
        0,
    )
    assert client.get("/api/me/family-code", headers=auth(aruna)).json()["parents"] == 1

    # Progress shows up: a checked chapter this month.
    solve(client, aruna, "roads-chase", 4)
    child = client.get("/api/parent/children", headers=auth(mama)).json()[0]
    assert (child["chaptersMonth"], child["chaptersTotal"], child["coins"]) == (1, 1, 5)

    # Another parent sees nothing; students and teachers can't use the parent area.
    papa = parent(client, email="other@family.kz")
    assert client.get("/api/parent/children", headers=auth(papa)).json() == []
    denied = client.post(
        f"/api/parent/children/{child['id']}/praise", json={"kind": "proud"}, headers=auth(papa)
    )
    assert denied.status_code == 404
    assert client.get("/api/parent/children", headers=auth(aruna)).status_code == 403
    assert client.get("/api/parent/children", headers=auth(teacher_token)).status_code == 403
    assert client.get("/api/me/family-code", headers=auth(mama)).status_code == 403

    # Unlinking.
    assert (
        client.delete(f"/api/parent/children/{child['id']}", headers=auth(mama)).status_code == 204
    )
    assert client.get("/api/parent/children", headers=auth(mama)).json() == []


def test_praise_cards_and_a_weekly_gift(env):
    _, client = env
    aruna = student(client, "aruna", "Аруна")
    mama = parent(client)
    code = client.get("/api/me/family-code", headers=auth(aruna)).json()["code"]
    child_id = client.post("/api/parent/children", json={"code": code}, headers=auth(mama)).json()[
        "id"
    ]
    url = f"/api/parent/children/{child_id}/praise"

    assert client.post(url, json={"kind": "proud"}, headers=auth(mama)).status_code == 201
    gift = client.post(url, json={"kind": "gift"}, headers=auth(mama))
    assert gift.status_code == 201 and gift.json()["giftReadyAt"]
    assert coins(client, aruna) == 20
    assert client.post(url, json={"kind": "gift"}, headers=auth(mama)).status_code == 409
    assert coins(client, aruna) == 20

    cards = client.get("/api/me/praise", headers=auth(aruna)).json()
    assert [(c["kind"], c["coins"], c["fromName"]) for c in cards] == [
        ("gift", 20, "Гульнара Омарова"),
        ("proud", 0, "Гульнара Омарова"),
    ]
    assert client.post("/api/me/praise/seen", headers=auth(aruna)).status_code == 204
    assert client.get("/api/me/praise", headers=auth(aruna)).json() == []
    # Gift coins are not earnings: the class league ignores them.
