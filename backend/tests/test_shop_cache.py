"""Fair shop (buy/equip with server coins) and the story cache (express + semantic).

Set TEST_DATABASE_URL (pgvector database, e.g. .../amc_test) and TEST_REDIS_URL
(e.g. redis://127.0.0.1:6380/15) to also check the real vector and Redis stores.
"""

import asyncio
import json
import os
from fractions import Fraction

import pytest
from fastapi.testclient import TestClient
from test_accounts import answer, auth, generate_comic, student, teacher
from test_generation import DeterministicImages, DeterministicText
from test_my_story import STORY, StoryText

from app.config import Settings
from app.main import create_app
from app.schemas import JobRequest
from app.storage import Store
from app.story_cache import (
    CachedStory,
    PgVectorStore,
    RedisExactStore,
    SqliteExactStore,
    SqliteVectorStore,
    StoryCache,
    cosine,
    my_story_key,
)
from app.worker import Worker


@pytest.fixture
def env(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        art_mode="live",
        public_base_url="http://testserver",
        jwt_secret="test-secret-" + "x" * 32,
    )
    with TestClient(create_app(settings)) as client:
        yield settings, client


# ---- shop -----------------------------------------------------------------------------------


def earn_coins(settings, client, token):
    _, rounds = generate_comic(settings, client)
    for rid, x in rounds:
        result = answer(client, token, rid, str(x))
    return result["reward"]["totalCoins"]


def test_buy_and_equip_skins_with_earned_coins(env):
    settings, client = env
    token = student(client, "aruna", "Аруна")
    shop = client.get("/api/v1/shop", headers=auth(token)).json()
    assert shop["coins"] == 0 and shop["equippedSkin"] is None
    assert [(i["id"], i["price"], i["owned"]) for i in shop["items"]] == [
        ("smart-glasses", 40, False),
        ("yellow-backpack", 50, False),
        ("racer-helmet", 60, False),
    ]
    broke = client.post("/api/v1/shop/buy", json={"itemId": "smart-glasses"}, headers=auth(token))
    assert broke.status_code == 409 and broke.json()["detail"] == "not_enough_coins"

    assert earn_coins(settings, client, token) == 40  # a perfect boss fight
    bought = client.post("/api/v1/shop/buy", json={"itemId": "smart-glasses"}, headers=auth(token))
    assert bought.status_code == 201
    shop = bought.json()
    glasses = shop["items"][0]
    assert shop["coins"] == 0 and glasses["owned"] and not glasses["equipped"]
    again = client.post("/api/v1/shop/buy", json={"itemId": "smart-glasses"}, headers=auth(token))
    assert again.status_code == 409 and again.json()["detail"] == "already_owned"
    assert (
        client.post(
            "/api/v1/shop/buy", json={"itemId": "racer-helmet"}, headers=auth(token)
        ).json()["detail"]
        == "not_enough_coins"
    )
    assert (
        client.post(
            "/api/v1/shop/buy", json={"itemId": "gold-crown"}, headers=auth(token)
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/shop/buy", json={"itemId": "smart-glasses", "price": 0}, headers=auth(token)
        ).status_code
        == 422
    )

    worn = client.post(
        "/api/v1/backpack/equip", json={"itemId": glasses["backpackItemId"]}, headers=auth(token)
    ).json()
    assert worn["equippedSkin"] == "smart-glasses" and worn["items"][0]["equipped"]
    me = client.get("/api/me", headers=auth(token)).json()
    assert me["profile"]["coins"] == 0
    assert me["profile"]["items"] == [
        {"id": glasses["backpackItemId"], "type": "skin", "key": "smart-glasses", "equipped": True}
    ]
    off = client.post("/api/v1/backpack/equip", json={"itemId": None}, headers=auth(token)).json()
    assert off["equippedSkin"] is None


def test_shop_is_for_students_and_items_are_private(env):
    settings, client = env
    aruna = student(client, "aruna", "Аруна")
    earn_coins(settings, client, aruna)
    item = client.post(
        "/api/v1/shop/buy", json={"itemId": "smart-glasses"}, headers=auth(aruna)
    ).json()["items"][0]["backpackItemId"]
    aldiyar = student(client, "aldiyar", "Алдияр")
    stolen = client.post("/api/v1/backpack/equip", json={"itemId": item}, headers=auth(aldiyar))
    assert stolen.status_code == 404
    teacher_token = teacher(client)
    assert client.get("/api/v1/shop", headers=auth(teacher_token)).status_code == 403
    assert client.get("/api/v1/shop").status_code == 401


# ---- story cache ----------------------------------------------------------------------------


EQUATIONS = {"grade": 6, "topic": "equations", "lang": "ru", "difficulty": "advanced"}


def run_job(settings, client, body, text, cache):
    job = client.post("/api/comic-jobs", json=body).json()["jobId"]
    worker = Worker(Store(settings.data_dir), text, DeterministicImages(), settings, cache)
    assert asyncio.run(worker.run_once())
    status = client.get(f"/api/comic-jobs/{job}").json()
    assert status["status"] == "ready", status
    comic = client.get(f"/api/comics/{status['comicId']}?lang=ru").json()
    return status["comicId"], comic


def expected(settings, exercise_id):
    return Fraction(Store(settings.data_dir).exercise(exercise_id)["expected"])


def test_express_cache_reuses_story_and_art_but_never_the_math(env):
    settings, client = env
    cache = StoryCache(SqliteExactStore(Store(settings.data_dir).db_path))
    text = DeterministicText()
    first_id, first = run_job(settings, client, EQUATIONS, text, cache)
    assert len(text.calls) == 1

    prompts = {first["exercise"]["prompt"]}
    for _ in range(4):
        comic_id, comic = run_job(settings, client, EQUATIONS, text, cache)
        assert len(text.calls) == 1  # no model call
        assert comic["title"] == first["title"]
        assert [p["text"] for i, p in enumerate(comic["panels"]) if i != 3] == [
            p["text"] for i, p in enumerate(first["panels"]) if i != 3
        ]
        # The pictures are the first comic's; the exercise and boss rounds are this job's own.
        assert all(f"/comic-images/{first_id}/" in p["imageUrl"] for p in comic["panels"])
        assert comic["panels"][3]["text"] == comic["exercise"]["prompt"]
        assert comic["exercise"]["id"] == f"equations-{comic_id}"
        assert [r["exerciseId"] for r in comic["boss"]["rounds"]][1:] == [
            f"equations-{comic_id}-r2",
            f"equations-{comic_id}-r3",
        ]
        value = expected(settings, comic["exercise"]["id"])
        prompts.add(comic["exercise"]["prompt"])
        check = client.post(
            f"/api/exercises/{comic['exercise']['id']}/check", json={"answer": str(value)}
        )
        assert check.json()["status"] == "correct"
        assert client.get(comic["panels"][0]["imageUrl"]).status_code == 200

    assert len(prompts) > 1  # fresh math, not a copy of the first comic

    # Different settings: a new story.
    run_job(settings, client, {**EQUATIONS, "difficulty": "basic"}, text, cache)
    assert len(text.calls) == 2


def test_express_pool_builds_variants_before_reusing(env):
    settings, client = env
    cache = StoryCache(SqliteExactStore(Store(settings.data_dir).db_path), variants=2)
    text = DeterministicText()
    for expected_calls in (1, 2, 2, 2):
        run_job(settings, client, EQUATIONS, text, cache)
        assert len(text.calls) == expected_calls


class FakeEmbedder:
    """Hand-made vectors: the two Moon premises are close (cosine ≈ 0.95), the forest one is not."""

    VECTORS = {
        "Пифик летит на Луну": [1.0, 0.0, 0.0],
        "Пифик отправляется на Луну": [0.95, 0.31, 0.0],
        "Герои ищут клад в лесу": [0.0, 0.2, 0.98],
    }

    def __init__(self):
        self.calls = []

    async def embed(self, text):
        self.calls.append(text)
        return self.VECTORS[text]


def my_story(premise, **changes):
    return {
        "grade": 5,
        "topic": "fractions",
        "lang": "ru",
        "difficulty": "basic",
        "story": {**STORY, "premise": premise, **changes},
    }


def test_semantic_cache_for_my_story(env):
    settings, client = env
    db = Store(settings.data_dir).db_path
    cache = StoryCache(SqliteExactStore(db), SqliteVectorStore(db), FakeEmbedder(), threshold=0.92)
    text = StoryText()
    first_id, first = run_job(settings, client, my_story("Пифик летит на Луну"), text, cache)
    assert len(text.calls) == 1

    # A differently worded premise with the same meaning reuses the story.
    similar_id, similar = run_job(
        settings, client, my_story("Пифик отправляется на Луну"), text, cache
    )
    assert len(text.calls) == 1
    assert similar["title"] == first["title"] and similar_id != first_id
    assert similar["exercise"]["id"] == f"fractions-{similar_id}"

    # A different idea, or a different hero of the student's own, means a new story.
    run_job(settings, client, my_story("Герои ищут клад в лесу"), text, cache)
    assert len(text.calls) == 2
    other_hero = [
        STORY["customHeroes"][0],
        {"name": "Luna", "description": "Добрая кошка-астронавт"},
    ]
    run_job(settings, client, my_story("Пифик летит на Луну", customHeroes=other_hero), text, cache)
    assert len(text.calls) == 3


def test_my_story_without_premise_uses_the_exact_cache(env):
    settings, client = env
    db = Store(settings.data_dir).db_path
    embedder = FakeEmbedder()
    cache = StoryCache(SqliteExactStore(db), SqliteVectorStore(db), embedder)
    text = StoryText()
    run_job(settings, client, my_story(""), text, cache)
    run_job(settings, client, my_story(""), text, cache)
    assert len(text.calls) == 1 and embedder.calls == []


def test_a_broken_cache_entry_falls_back_to_generation(env):
    settings, client = env
    db = Store(settings.data_dir).db_path
    exact = SqliteExactStore(db)
    cache = StoryCache(exact)
    text = DeterministicText()
    run_job(settings, client, EQUATIONS, text, cache)
    key = "amc:story:v1:express:equations:6:advanced:live"
    value = json.loads((asyncio.run(exact.get(key)))[0])
    value["story"]["ru"]["panels"][0]["text"] = "Нас тут трое!"  # breaks the number rule
    with __import__("sqlite3").connect(db) as conn:
        conn.execute("DELETE FROM story_cache")
    asyncio.run(exact.add(key, json.dumps(value, ensure_ascii=False), 1))
    run_job(settings, client, EQUATIONS, text, cache)
    assert len(text.calls) == 2


def test_cosine():
    assert cosine([1, 0], [1, 0]) == 1
    assert cosine([1, 0], [0, 1]) == 0
    assert round(cosine([1.0, 0.0, 0.0], [0.95, 0.31, 0.0]), 2) == 0.95


@pytest.mark.skipif(not os.getenv("TEST_REDIS_URL"), reason="set TEST_REDIS_URL")
def test_redis_store_keeps_the_newest_variants():
    async def scenario():
        store = RedisExactStore(os.environ["TEST_REDIS_URL"])
        key = "amc:test:variants"
        await store.redis.delete(key)
        for value in ("a", "b", "c"):
            await store.add(key, value, keep=2)
        values = await store.get(key)
        ttl = await store.redis.ttl(key)
        await store.redis.delete(key)
        await store.redis.aclose()
        return values, ttl

    values, ttl = asyncio.run(scenario())
    assert values == ["c", "b"] and ttl > 0


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="set TEST_DATABASE_URL")
def test_pgvector_store_finds_the_nearest_premise():
    async def scenario():
        store = PgVectorStore(os.environ["TEST_DATABASE_URL"])
        from sqlalchemy import text

        await store._schema()
        async with store.engine.begin() as conn:
            await conn.execute(text("DELETE FROM story_vectors WHERE key LIKE 'amc:test:%'"))
        dim = 384
        moon = [1.0] + [0.0] * (dim - 1)
        moon_again = [0.95, 0.31] + [0.0] * (dim - 2)
        forest = [0.0, 0.2, 0.98] + [0.0] * (dim - 3)
        entry = CachedStory({"ru": {}}, "comic-1", {}, "new").to_json()
        await store.add("amc:test:k", "Пифик летит на Луну", moon, entry)
        await store.add("amc:test:k", "Герои ищут клад", forest, entry)
        near = await store.nearest("amc:test:k", moon_again)
        other_key = await store.nearest("amc:test:other", moon_again)
        async with store.engine.begin() as conn:
            await conn.execute(text("DELETE FROM story_vectors WHERE key LIKE 'amc:test:%'"))
        await store.engine.dispose()
        return near, other_key

    near, other_key = asyncio.run(scenario())
    assert json.loads(near[0])["source"] == "comic-1" and 0.94 < near[1] < 0.96
    assert other_key is None


def test_my_story_key_ignores_only_the_premise():
    base = JobRequest.model_validate(my_story("Пифик летит на Луну"))
    same = JobRequest.model_validate(my_story("Совсем другая завязка"))
    other = JobRequest.model_validate(my_story("Пифик летит на Луну", style="comic"))
    assert my_story_key(base, "live") == my_story_key(same, "live")
    assert my_story_key(base, "live") != my_story_key(other, "live")
    assert my_story_key(base, "live") != my_story_key(base, "prepared")
