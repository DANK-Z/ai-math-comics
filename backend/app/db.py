"""Accounts database: users, classes, progress, coins, backpack and answer analytics.

SQLAlchemy async. PostgreSQL in development/production (``DATABASE_URL``, see
docker-compose.yml); without it the API falls back to ``data/accounts.sqlite3`` so tests and a
quick demo need no server. The comic job queue stays in ``storage.Store`` (SQLite).

Development can create tables on first use. With migration enforcement enabled, the API
requires the account database to be at the current Alembic revision.
"""

import asyncio
import enum
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import NullPool


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Role(str, enum.Enum):
    student = "student"
    teacher = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Students sign in with a login (no e-mail needed); teachers with an e-mail.
    login: Mapped[str | None] = mapped_column(String(24), unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    display_name: Mapped[str] = mapped_column(String(60))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"))
    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id", use_alter=True, name="fk_users_class", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SchoolClass(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(40))  # e.g. 5 «А»
    grade: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(String(32), unique=True)  # e.g. KOKSH-5A-2026
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    total_coins: Mapped[int] = mapped_column(Integer, default=0)
    stars_collected: Mapped[int] = mapped_column(Integer, default=0)
    avatar_item_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "backpack_items.id", use_alter=True, name="fk_profiles_avatar", ondelete="SET NULL"
        )
    )
    # Season map progress: completed chapter ids and earned bonus stickers.
    season: Mapped[dict] = mapped_column(JSON, default=dict)


class BackpackItem(Base):
    __tablename__ = "backpack_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column(String(20))  # skin | potion
    item_key: Mapped[str] = mapped_column(String(40))  # e.g. racer-helmet, intuition-potion
    is_equipped: Mapped[bool] = mapped_column(Boolean, default=False)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalyticsLog(Base):
    """One checked answer of a signed-in student in a boss round (teacher reports)."""

    __tablename__ = "analytics_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    comic_id: Mapped[str] = mapped_column(String(64), index=True)
    exercise_id: Mapped[str] = mapped_column(String(100))
    topic: Mapped[str] = mapped_column(String(20))
    skill: Mapped[str | None] = mapped_column(String(20))  # e.g. div, mul_add, sum
    round_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10))  # correct | incorrect | invalid
    mistake_count: Mapped[int] = mapped_column(Integer)  # misses in this round so far
    text_entered: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BossResult(Base):
    """A won boss fight; coins and stars are awarded once per student and comic."""

    __tablename__ = "boss_results"
    __table_args__ = (UniqueConstraint("student_id", "comic_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    comic_id: Mapped[str] = mapped_column(String(64))
    topic: Mapped[str] = mapped_column(String(20))
    stars: Mapped[int] = mapped_column(Integer)
    misses: Mapped[int] = mapped_column(Integer)
    coins: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SignInWindow(Base):
    """Shared sign-in counters. Keys contain a digest, with no stored login or IP."""

    __tablename__ = "sign_in_windows"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attempts: Mapped[int] = mapped_column(Integer)


class Database:
    def __init__(self, url: str, *, require_migrations: bool = False):
        sqlite = url.startswith("sqlite")
        # SQLite: no pool, so each event loop (tests, TestClient) gets fresh connections.
        options = {"poolclass": NullPool} if sqlite else {"pool_pre_ping": True}
        self.engine = create_async_engine(url, **options)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.require_migrations = require_migrations
        self._ready = False

    async def ensure_schema(self):
        if self._ready:
            return
        async with self.engine.begin() as conn:
            if self.require_migrations:
                config = Config(Path(__file__).resolve().parents[1] / "alembic.ini")
                expected = set(ScriptDirectory.from_config(config).get_heads())
                current = await conn.run_sync(
                    lambda db: set(MigrationContext.configure(db).get_current_heads())
                )
                if current != expected:
                    raise RuntimeError(
                        "Account database migrations required: run alembic upgrade head"
                    )
            else:
                await conn.run_sync(Base.metadata.create_all)
        self._ready = True

    async def session(self) -> AsyncIterator[AsyncSession]:
        await self.ensure_schema()
        async with self.sessions() as session:
            yield session

    async def dispose(self):
        await self.engine.dispose()


def default_database_url(data_dir: Path) -> str:
    return f"sqlite+aiosqlite:///{(data_dir / 'accounts.sqlite3').as_posix()}"


def run(coro):
    """Run a coroutine from sync code (CLI helpers and tests)."""
    return asyncio.run(coro)
