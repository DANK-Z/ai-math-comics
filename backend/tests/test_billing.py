"""Parent billing in test mode: the family plan and coin packs (no money moves)."""

from test_accounts import auth, coins, student
from test_accounts import env as env
from test_family import parent


def linked(client):
    aruna = student(client, "aruna", "Аруна Омарова")
    mama = parent(client)
    code = client.get("/api/me/family-code", headers=auth(aruna)).json()["code"]
    child = client.post("/api/parent/children", json={"code": code}, headers=auth(mama)).json()
    return aruna, mama, child["id"]


def test_coin_pack_reaches_the_child_as_a_card(env):
    _, client = env
    aruna, mama, child_id = linked(client)
    billing = client.get("/api/parent/billing", headers=auth(mama)).json()
    assert billing["mode"] == "test" and billing["plan"] is None
    assert [p["id"] for p in billing["packs"]] == ["coins-100", "coins-300", "coins-700"]

    before = coins(client, aruna)
    bought = client.post(
        f"/api/parent/children/{child_id}/coins", json={"pack": "coins-100"}, headers=auth(mama)
    )
    assert bought.status_code == 201, bought.text
    assert coins(client, aruna) == before + 100
    cards = client.get("/api/me/praise", headers=auth(aruna)).json()
    assert [(c["kind"], c["coins"]) for c in cards] == [("coins", 100)]
    # Bought coins are not the weekly gift: the gift is still available.
    assert bought.json()["giftReadyAt"] is None
    history = client.get("/api/parent/billing", headers=auth(mama)).json()["history"]
    assert [(h["product"], h["amount"], h["status"]) for h in history] == [
        ("coins-100", 490, "test")
    ]
    # Only for linked children and known packs.
    other = student(client, "aldiyar", "Алдияр")
    other_id = client.get("/api/me", headers=auth(other)).json()["id"]
    stranger = client.post(
        f"/api/parent/children/{other_id}/coins", json={"pack": "coins-100"}, headers=auth(mama)
    )
    assert stranger.status_code == 404
    bad = client.post(
        f"/api/parent/children/{child_id}/coins", json={"pack": "coins-9999"}, headers=auth(mama)
    )
    assert bad.status_code == 422


def test_family_plan_raises_the_weekly_gift_and_caps_test_payments(env):
    _, client = env
    aruna, mama, child_id = linked(client)
    plan = client.post("/api/parent/billing/plan", json={"plan": "family"}, headers=auth(mama))
    assert plan.status_code == 201 and plan.json()["plan"] == "family"
    first_until = plan.json()["paidUntil"]
    again = client.post("/api/parent/billing/plan", json={"plan": "family"}, headers=auth(mama))
    assert again.json()["paidUntil"] > first_until  # a repeat payment extends the plan

    before = coins(client, aruna)
    gift = client.post(
        f"/api/parent/children/{child_id}/praise", json={"kind": "gift"}, headers=auth(mama)
    )
    assert gift.json()["giftCoins"] == 50
    assert coins(client, aruna) == before + 50

    for _ in range(3):
        client.post(
            f"/api/parent/children/{child_id}/coins", json={"pack": "coins-100"}, headers=auth(mama)
        )
    capped = client.post(
        f"/api/parent/children/{child_id}/coins", json={"pack": "coins-100"}, headers=auth(mama)
    )
    assert capped.status_code == 429 and capped.json()["detail"] == "payments_limit"
    assert client.get("/api/parent/billing", headers=auth(aruna)).status_code == 403
