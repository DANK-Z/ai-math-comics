"""Story cache: reuse a generated storyboard (and its pictures) instead of calling the models.

What is reused is the *story*: titles, dialogue and artwork. The math never is. Narrative
validation guarantees the story has no numbers outside panel four, so a cached story fits any
new problem of the same topic: the worker swaps in the new job's exercise, hints and boss rounds
and validates the result again. Classmates get the same adventure with their own numbers.

* Express comics (no «Моя история» options): exact key topic + grade + difficulty + art mode
  (the story is bilingual, so the language does not matter). Up to ``variants`` stories are
  kept per key; until there are that many, new ones are generated. Redis when ``REDIS_URL`` is
  set, otherwise a table in the comics SQLite store.
* «Моя история»: everything the student chose except the premise must match exactly (their
  heroes, names and descriptions, style, setting, topic, grade, difficulty) — otherwise a child
  could get somebody else's hero. The premise is compared by meaning: a local multilingual
  embedding model turns it into a vector; a cached story is reused when the cosine similarity is
  at least ``threshold`` (0.92). PostgreSQL + pgvector when ``DATABASE_URL`` points to
  PostgreSQL, otherwise vectors in the SQLite store (fine for a few hundred stories).
"""

import asyncio
import hashlib
import json
import logging
import math
import random
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .schemas import JobRequest

logger = logging.getLogger(__name__)
KEY_VERSION = "v3"
EMBEDDING_DIM = 384
EXPRESS_TTL_SECONDS = 60 * 60 * 24 * 60


@dataclass(frozen=True)
class CachedStory:
    story: dict  # the validated storyboard JSON (with the original job's math)
    source_comic_id: str  # whose generated images to show (live art)
    aspects: dict[int, float]
    kind: str  # "express" | "my-story-exact" | "my-story-semantic"
    similarity: float = 1.0
    fraction_context: str | None = None

    def to_json(self) -> str:
        return json.dumps(
            {
                "story": self.story,
                "source": self.source_comic_id,
                "aspects": {str(k): v for k, v in self.aspects.items()},
                "fraction_context": self.fraction_context,
            },
            ensure_ascii=False,
        )

    @classmethod
    def from_json(cls, value: str, kind: str, similarity: float = 1.0) -> "CachedStory":
        data = json.loads(value)
        return cls(
            story=data["story"],
            source_comic_id=data["source"],
            aspects={int(k): float(v) for k, v in data["aspects"].items()},
            kind=kind,
            similarity=similarity,
            fraction_context=data.get("fraction_context"),
        )


# ---- keys ------------------------------------------------------------------------------------


def express_key(request: JobRequest, art_mode: str) -> str:
    return (
        f"amc:story:{KEY_VERSION}:express:{request.topic}:{request.grade}:"
        f"{request.difficulty}:{art_mode}"
    )


def my_story_key(request: JobRequest, art_mode: str) -> str:
    """Exact part of a «Моя история» request: all choices except the premise."""
    options = request.story
    assert options is not None
    exact = options.model_dump(exclude={"premise"})
    exact.update(topic=request.topic, grade=request.grade, difficulty=request.difficulty)
    exact["art"] = art_mode
    if request.topic == "fractions":
        exact["fraction_context_version"] = 1
    if art_mode == "live" and options.customHeroes:
        exact["custom_art_version"] = 1
    digest = hashlib.sha256(json.dumps(exact, sort_keys=True, ensure_ascii=False).encode())
    return f"amc:story:{KEY_VERSION}:my-story:{digest.hexdigest()[:32]}"


# ---- exact store (Redis or SQLite) -----------------------------------------------------------


class ExactStore(Protocol):
    async def get(self, key: str) -> list[str]: ...
    async def add(self, key: str, value: str, keep: int) -> None: ...


class RedisExactStore:
    def __init__(self, url: str):
        import redis.asyncio as redis

        self.redis = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> list[str]:
        return await self.redis.lrange(key, 0, -1)

    async def add(self, key: str, value: str, keep: int) -> None:
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.lpush(key, value).ltrim(key, 0, keep - 1).expire(key, EXPRESS_TTL_SECONDS)
            await pipe.execute()


class SqliteExactStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        with sqlite3.connect(db_path) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS story_cache "
                "(id INTEGER PRIMARY KEY, key TEXT NOT NULL, value TEXT NOT NULL, created REAL)"
            )
            db.execute("CREATE INDEX IF NOT EXISTS story_cache_key ON story_cache(key)")

    async def get(self, key: str) -> list[str]:
        with sqlite3.connect(self.db_path) as db:
            rows = db.execute(
                "SELECT value FROM story_cache WHERE key=? ORDER BY id DESC", (key,)
            ).fetchall()
        return [row[0] for row in rows]

    async def add(self, key: str, value: str, keep: int) -> None:
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                "INSERT INTO story_cache(key,value,created) VALUES(?,?,?)",
                (key, value, time.time()),
            )
            db.execute(
                "DELETE FROM story_cache WHERE key=? AND id NOT IN "
                "(SELECT id FROM story_cache WHERE key=? ORDER BY id DESC LIMIT ?)",
                (key, key, keep),
            )


# ---- vector store (pgvector or SQLite) -------------------------------------------------------


class VectorStore(Protocol):
    async def nearest(self, key: str, vector: list[float]) -> tuple[str, float] | None: ...
    async def add(self, key: str, premise: str, vector: list[float], value: str) -> None: ...


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


class SqliteVectorStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        with sqlite3.connect(db_path) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS story_vectors (id INTEGER PRIMARY KEY, key TEXT NOT "
                "NULL, premise TEXT NOT NULL, vector TEXT NOT NULL, value TEXT NOT NULL)"
            )
            db.execute("CREATE INDEX IF NOT EXISTS story_vectors_key ON story_vectors(key)")

    async def nearest(self, key: str, vector: list[float]) -> tuple[str, float] | None:
        with sqlite3.connect(self.db_path) as db:
            rows = db.execute(
                "SELECT vector, value FROM story_vectors WHERE key=?", (key,)
            ).fetchall()
        scored = [(cosine(vector, json.loads(v)), value) for v, value in rows]
        if not scored:
            return None
        similarity, value = max(scored, key=lambda item: item[0])
        return value, similarity

    async def add(self, key: str, premise: str, vector: list[float], value: str) -> None:
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                "INSERT INTO story_vectors(key,premise,vector,value) VALUES(?,?,?,?)",
                (key, premise, json.dumps(vector), value),
            )


class PgVectorStore:
    """story_vectors table with a pgvector column; nearest neighbour by cosine distance."""

    def __init__(self, database_url: str):
        from sqlalchemy.ext.asyncio import create_async_engine

        self.engine = create_async_engine(database_url, pool_pre_ping=True)
        self._ready = False

    async def _schema(self):
        if self._ready:
            return
        from sqlalchemy import text

        async with self.engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS story_vectors (id BIGSERIAL PRIMARY KEY, "
                    f"key TEXT NOT NULL, premise TEXT NOT NULL, embedding vector({EMBEDDING_DIM}) "
                    "NOT NULL, value JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now())"
                )
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS story_vectors_key ON story_vectors(key)")
            )
        self._ready = True

    @staticmethod
    def _literal(vector: list[float]) -> str:
        return "[" + ",".join(f"{x:.6f}" for x in vector) + "]"

    async def nearest(self, key: str, vector: list[float]) -> tuple[str, float] | None:
        from sqlalchemy import text

        await self._schema()
        async with self.engine.connect() as conn:
            row = (
                await conn.execute(
                    text(
                        "SELECT value::text, 1 - (embedding <=> CAST(:q AS vector)) AS similarity "
                        "FROM story_vectors WHERE key = :k "
                        "ORDER BY embedding <=> CAST(:q AS vector) LIMIT 1"
                    ),
                    {"q": self._literal(vector), "k": key},
                )
            ).first()
        return (row[0], float(row[1])) if row else None

    async def add(self, key: str, premise: str, vector: list[float], value: str) -> None:
        from sqlalchemy import text

        await self._schema()
        async with self.engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO story_vectors(key, premise, embedding, value) "
                    "VALUES (:k, :p, CAST(:v AS vector), CAST(:value AS jsonb))"
                ),
                {"k": key, "p": premise, "v": self._literal(vector), "value": value},
            )


# ---- embeddings ----------------------------------------------------------------------------


class Embedder(Protocol):
    async def embed(self, text: str) -> list[float]: ...


class FastEmbedder:
    """Local multilingual sentence embeddings (ONNX via fastembed, no PyTorch, no API calls).

    The model (~220 MB) is downloaded once into ``cache_dir`` on first use.
    """

    def __init__(self, model: str, cache_dir: Path):
        self.model_name = model
        self.cache_dir = cache_dir
        self._model = None
        self._lock = asyncio.Lock()

    def _load(self):
        from fastembed import TextEmbedding

        return TextEmbedding(model_name=self.model_name, cache_dir=str(self.cache_dir))

    async def embed(self, text: str) -> list[float]:
        async with self._lock:
            if self._model is None:
                self._model = await asyncio.to_thread(self._load)
        vector = await asyncio.to_thread(lambda: next(iter(self._model.embed([text]))))
        return [float(x) for x in vector]


# ---- facade ------------------------------------------------------------------------------------


class StoryCache:
    def __init__(
        self,
        exact: ExactStore,
        vectors: VectorStore | None = None,
        embedder: Embedder | None = None,
        *,
        variants: int = 1,
        threshold: float = 0.92,
    ):
        self.exact = exact
        self.vectors = vectors
        self.embedder = embedder
        self.variants = max(1, variants)
        self.threshold = threshold

    async def lookup(self, request: JobRequest, art_mode: str) -> CachedStory | None:
        try:
            return await self._lookup(request, art_mode)
        except Exception:  # a broken cache must never break generation
            logger.warning("Story cache lookup failed; generating", exc_info=True)
            return None

    async def _lookup(self, request: JobRequest, art_mode: str) -> CachedStory | None:
        options = request.story
        if options is None:
            values = await self.exact.get(express_key(request, art_mode))
            if len(values) < self.variants:
                return None  # build the pool first, so classmates see different stories
            return CachedStory.from_json(random.choice(values), "express")
        key = my_story_key(request, art_mode)
        if not options.premise:
            values = await self.exact.get(key)
            return CachedStory.from_json(values[0], "my-story-exact") if values else None
        if self.vectors is None or self.embedder is None:
            return None
        found = await self.vectors.nearest(key, await self.embedder.embed(options.premise))
        if found is None or found[1] < self.threshold:
            return None
        return CachedStory.from_json(found[0], "my-story-semantic", round(found[1], 4))

    async def remember(self, request: JobRequest, art_mode: str, entry: CachedStory) -> None:
        try:
            options = request.story
            if options is None:
                await self.exact.add(express_key(request, art_mode), entry.to_json(), self.variants)
            elif not options.premise:
                await self.exact.add(my_story_key(request, art_mode), entry.to_json(), 1)
            elif self.vectors is not None and self.embedder is not None:
                vector = await self.embedder.embed(options.premise)
                await self.vectors.add(
                    my_story_key(request, art_mode), options.premise, vector, entry.to_json()
                )
        except Exception:
            logger.warning("Story cache write failed", exc_info=True)


def story_cache_from_settings(settings, store_db_path: Path) -> StoryCache | None:
    if not settings.story_cache:
        return None
    exact: ExactStore = (
        RedisExactStore(settings.redis_url)
        if settings.redis_url
        else SqliteExactStore(store_db_path)
    )
    vectors: VectorStore = (
        PgVectorStore(settings.database_url)
        if settings.database_url.startswith("postgresql")
        else SqliteVectorStore(store_db_path)
    )
    # One shared model folder (git-ignored), whatever COMIC_DATA_DIR points to.
    models_dir = Path(__file__).resolve().parents[1] / "data" / "models"
    embedder = (
        FastEmbedder(settings.embedding_model, models_dir) if settings.embedding_model else None
    )
    return StoryCache(
        exact,
        vectors,
        embedder,
        variants=settings.cache_variants,
        threshold=settings.semantic_threshold,
    )
