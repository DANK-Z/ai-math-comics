"""Parents motivate: challenges with real rewards, a practice calendar with a streak gift, peers."""

from datetime import date, timedelta

from test_accounts import auth, make_class, solve, student, teacher
from test_accounts import env as env
from test_family import parent

from app import motivation


def link(client, kid, mama):
    code = client.get("/api/me/family-code", headers=auth(kid)).json()["code"]
    return client.post("/api/parent/children", json={"code": code}, headers=auth(mama)).json()["id"]


def test_challenge_with_a_real_reward(env):
    _, client = env
    aruna = student(client, "aruna", "Аруна")
    mama = parent(client)
    child_id = link(client, aruna, mama)
    base = f"/api/parent/children/{child_id}/challenges"

    bad = client.post(
        base, json={"kind": "chapters", "target": 50, "reward": "Кино"}, headers=auth(mama)
    )
    assert bad.status_code == 422
    made = client.post(
        base,
        json={"kind": "chapters", "target": 1, "reward": "Поход в кино в выходные"},
        headers=auth(mama),
    ).json()
    assert (made["progress"], made["done"], made["reward"]) == (0, False, "Поход в кино в выходные")

    mine = client.get("/api/me/challenges", headers=auth(aruna)).json()
    assert [(c["reward"], c["fromName"], c["target"]) for c in mine] == [
        ("Поход в кино в выходные", "Гульнара Омарова", 1)
    ]
    rewarded = client.post(f"/api/parent/challenges/{made['id']}/rewarded", headers=auth(mama))
    assert rewarded.status_code == 409  # not done yet

    solve(client, aruna, "roads-chase", 4)  # one chapter checked by the server
    done = client.get(base, headers=auth(mama)).json()[0]
    assert (done["progress"], done["done"]) == (1, True) and done["completedAt"]
    given = client.post(f"/api/parent/challenges/{made['id']}/rewarded", headers=auth(mama))
    assert given.json()["rewardedAt"]

    papa = parent(client, email="papa@family.kz", name="Ерлан")
    assert client.get(base, headers=auth(papa)).status_code == 404
    assert (
        client.delete(f"/api/parent/challenges/{made['id']}", headers=auth(papa)).status_code == 404
    )
    assert (
        client.delete(f"/api/parent/challenges/{made['id']}", headers=auth(mama)).status_code == 204
    )


def test_calendar_and_the_streak_frame(env, monkeypatch):
    _, client = env
    aruna = student(client, "aruna", "Аруна")
    mama = parent(client)
    child_id = link(client, aruna, mama)
    url = f"/api/parent/children/{child_id}/calendar"

    solve(client, aruna, "roads-chase", 4)
    cal = client.get(url, headers=auth(mama)).json()
    today = motivation.almaty_today()
    assert cal["month"] == today.strftime("%Y-%m") and cal["streak"] == 1
    day = next(d for d in cal["days"] if d["day"] == today.isoformat())
    assert day["chapters"] == 1 and day["count"] >= 1
    assert (cal["giftReady"], cal["giftSent"]) == (False, False)
    gift = f"/api/parent/children/{child_id}/streak-gift"
    assert client.post(gift, headers=auth(mama)).status_code == 409  # too short

    # Five days in a row: pretend the activity of today happened on each of the last five days.
    real = motivation.activity_days

    async def five_days(session, student_id, start):
        days = await real(session, student_id, start)
        sample = days[today]
        return {today - timedelta(days=i): sample for i in range(5)}

    monkeypatch.setattr(motivation, "activity_days", five_days)
    cal = client.get(url, headers=auth(mama)).json()
    assert (cal["streak"], cal["giftReady"]) == (5, True)
    sent = client.post(gift, headers=auth(mama)).json()
    assert (sent["giftReady"], sent["giftSent"]) == (False, True)
    assert client.post(gift, headers=auth(mama)).status_code == 409  # once

    cards = client.get("/api/me/praise", headers=auth(aruna)).json()
    assert cards[0]["kind"] == "streak"
    shop = client.get("/api/v1/shop", headers=auth(aruna)).json()
    frame = next(c for c in shop["cosmetics"] if c["id"] == "frame-fire")
    assert frame["owned"] is True
    bought = client.post("/api/v1/shop/buy", json={"itemId": "frame-fire"}, headers=auth(aruna))
    assert bought.status_code == 404  # not for sale


def test_benchmark_needs_enough_peers(env):
    _, client = env
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    aruna = student(client, "aruna", "Аруна", school_class["code"])
    mama = parent(client)
    child_id = link(client, aruna, mama)
    bench = client.get(f"/api/parent/children/{child_id}/benchmark", headers=auth(mama)).json()
    assert (bench["grade"], bench["peers"], bench["activePercentile"]) == (5, 0, None)
    assert bench["topics"] == []
    assert isinstance(date.today(), date)


def test_benchmark_compares_with_peers_of_the_grade(env, monkeypatch):
    import asyncio
    from datetime import UTC, datetime

    from app.db import AnalyticsLog, Database, default_database_url

    settings, client = env
    monkeypatch.setattr(motivation, "MIN_PEERS", 2)
    teacher_token = teacher(client)
    school_class = make_class(client, teacher_token)
    names = ["Аруна", "Дана", "Тимур", "Ерасыл"]
    tokens = [student(client, f"kid{i}", n, school_class["code"]) for i, n in enumerate(names)]
    ids = [client.get("/api/me", headers=auth(t)).json()["id"] for t in tokens]
    right = {ids[0]: 9, ids[1]: 5, ids[2]: 3, ids[3]: 7}  # of 10 answers in equations

    async def answers():
        database = Database(settings.database_url or default_database_url(settings.data_dir))
        async with database.sessions() as session:
            for student_id, good in right.items():
                for k in range(10):
                    session.add(
                        AnalyticsLog(
                            student_id=student_id,
                            comic_id="boss",
                            exercise_id=f"boss-{k}",
                            topic="equations",
                            skill="add",
                            round_number=1,
                            status="correct" if k < good else "incorrect",
                            mistake_count=0,
                            text_entered="1",
                            created_at=datetime.now(UTC),
                        )
                    )
            await session.commit()
        await database.dispose()

    asyncio.run(answers())
    mama = parent(client)
    child_id = link(client, tokens[0], mama)
    bench = client.get(f"/api/parent/children/{child_id}/benchmark", headers=auth(mama)).json()
    assert (bench["grade"], bench["peers"]) == (5, 3)
    topic = bench["topics"][0]
    assert (topic["topic"], topic["accuracy"], topic["peerAverage"], topic["percentile"]) == (
        "equations",
        90,
        50,
        100,
    )
    assert bench["activeDays"] == 1 and bench["activePercentile"] == 0
