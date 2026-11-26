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
from datetime import UTC, date, datetime
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
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
    parent = "parent"


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


class ItemLore(Base):
    __tablename__ = "item_lore"

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    item_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    locale: Mapped[str] = mapped_column(String(2), primary_key=True)
    story: Mapped[str] = mapped_column(String(400))


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


class ProgressReward(Base):
    """A one-time coin reward for operation progress (a chapter or a finale, by key).

    The primary key makes each reward claimable once per student, even when the same
    completion is reported again, after a reload, or by two requests at the same time.
    """

    __tablename__ = "progress_rewards"

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    reward_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    coins: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClassBattle(Base):
    """A class battle: the whole class fights one giant boss, each correct answer deals damage."""

    __tablename__ = "class_battles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(20))  # fractions | equations
    difficulty: Mapped[str] = mapped_column(String(20))
    max_hp: Mapped[int] = mapped_column(Integer)
    damage: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | won | stopped
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BattleTask(Base):
    """One server-chosen problem a student solves in a class battle (the answer stays here)."""

    __tablename__ = "battle_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    battle_id: Mapped[str] = mapped_column(
        ForeignKey("class_battles.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    problem: Mapped[dict] = mapped_column(JSON)
    misses: Mapped[int] = mapped_column(Integer, default=0)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PracticeTask(Base):
    """One problem of a student's solo review drill (the answer stays on the server)."""

    __tablename__ = "practice_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(20))
    skill: Mapped[str | None] = mapped_column(String(20))
    number: Mapped[int] = mapped_column(Integer)
    problem: Mapped[dict] = mapped_column(JSON)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClassLesson(Base):
    """A comic read together on the board; every student answers its exercise from a phone."""

    __tablename__ = "class_lessons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    comic_id: Mapped[str] = mapped_column(String(64))
    answer: Mapped[int] = mapped_column(Integer)  # the chapter's whole-number answer
    panel: Mapped[int] = mapped_column(Integer, default=0)
    # reading | answering | reveal | closed
    # reading | answering | reveal | podium | closed
    phase: Mapped[str] = mapped_column(String(12), default="reading")
    # 1: the first try; 2: the class tries again after the walkthrough.
    attempt: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    # 0: the chapter's exercise; 1..n: the questions of the mini-quiz.
    step: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Seconds for answering (0: no timer); the deadline of the open answering.
    timer: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    answering_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The mini-quiz: [{"comicId": ..., "answer": ...}], answers sent by the teacher's client.
    quiz: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LessonAnswer(Base):
    """A student's answer in a class lesson: one per step and try, changeable until the reveal."""

    __tablename__ = "lesson_answers"

    lesson_id: Mapped[str] = mapped_column(
        ForeignKey("class_lessons.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    step: Mapped[int] = mapped_column(Integer, primary_key=True, default=0, server_default="0")
    attempt: Mapped[int] = mapped_column(Integer, primary_key=True, default=1, server_default="1")
    # Mini-quiz points: right answers score 100 plus up to 50 for speed.
    points: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    text_entered: Mapped[str] = mapped_column(String(32))
    correct: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Homework(Base):
    """A chapter or a review drill set for a class, with a due date."""

    __tablename__ = "homework"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # chapter | practice
    target: Mapped[str] = mapped_column(String(64))  # comic id or practice topic
    due_date: Mapped[date] = mapped_column(Date)
    # Only these students (a drill for those who slipped in a lesson); None: the whole class.
    student_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LessonAward(Base):
    """A podium place of a lesson's mini-quiz; its stars count in the class league."""

    __tablename__ = "lesson_awards"

    lesson_id: Mapped[str] = mapped_column(
        ForeignKey("class_lessons.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    place: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)
    stars: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BoardPresence(Base):
    """Who is on a board right now (a battle or a lesson): the student's last poll."""

    __tablename__ = "board_presence"

    board_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FamilyCode(Base):
    """A student's family code: a parent types it to follow the child."""

    __tablename__ = "family_codes"

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(16), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FamilyLink(Base):
    """A parent following a child."""

    __tablename__ = "family_links"

    parent_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Praise(Base):
    """A card from a parent to a child (sometimes with gift coins), shown on the child's home."""

    __tablename__ = "praises"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    coins: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ParentChallenge(Base):
    """A parent's rule with a real reward («3 звезды по уравнениям = поход в кино»)."""

    __tablename__ = "parent_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # boss_clean | chapters | drills | streak
    topic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    target: Mapped[int] = mapped_column(Integer)
    reward: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rewarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ObjectiveCodes(Base):
    """The teacher's own codes of the curriculum's learning objectives for a chapter."""

    __tablename__ = "objective_codes"

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    comic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    codes: Mapped[str] = mapped_column(String(80))


class Message(Base):
    """A message between a teacher and a parent about one student."""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    sender: Mapped[str] = mapped_column(String(10))  # teacher | parent
    text: Mapped[str] = mapped_column(String(500))
    link: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Duel(Base):
    """Two students, the same five problems: the first to solve them all wins."""

    __tablename__ = "duels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    code: Mapped[str] = mapped_column(String(8), index=True)
    class_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    topic: Mapped[str] = mapped_column(String(20))
    problems: Mapped[list] = mapped_column(JSON)
    player_a: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    player_b: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    progress_a: Mapped[int] = mapped_column(Integer, default=0)
    progress_b: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10))  # waiting | active | done
    winner_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MockTest(Base):
    """A timed NIS/BIL-style mock test: problems from the olympiad bank, score, answers."""

    __tablename__ = "mock_tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    problem_ids: Mapped[list] = mapped_column(JSON)
    answers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TeacherTask(Base):
    """The teacher's own problem, shown to the class as a comic panel with a hero."""

    __tablename__ = "teacher_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    hero: Mapped[str] = mapped_column(String(20))
    scene: Mapped[str] = mapped_column(String(64))  # a bundled chapter whose art is the backdrop
    text_ru: Mapped[str] = mapped_column(String(300))
    text_kk: Mapped[str] = mapped_column(String(300))
    answer: Mapped[str] = mapped_column(String(20))
    hint_ru: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hint_kk: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TeacherTaskAnswer(Base):
    __tablename__ = "teacher_task_answers"

    task_id: Mapped[str] = mapped_column(
        ForeignKey("teacher_tasks.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    tries: Mapped[int] = mapped_column(Integer, default=0)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SignInWindow(Base):
    """Shared sign-in counters. Keys contain a digest, with no stored login or IP."""

    __tablename__ = "sign_in_windows"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attempts: Mapped[int] = mapped_column(Integer)


class AssignedComic(Base):
    __tablename__ = "assigned_comics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    comic_id: Mapped[str] = mapped_column(String(36), unique=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    content: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AssignmentHint(Base):
    __tablename__ = "assignment_hints"

    assignment_id: Mapped[str] = mapped_column(
        ForeignKey("assigned_comics.id", ondelete="CASCADE"),
        primary_key=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    step: Mapped[int] = mapped_column(Integer, primary_key=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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


class FamilyPlan(Base):
    """A parent's paid family plan (bigger weekly gift, more comics for the children)."""

    __tablename__ = "family_plans"

    parent_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    plan: Mapped[str] = mapped_column(String(20))
    paid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Payment(Base):
    """One parent payment: a plan month or a coin pack. ``status`` is ``test`` in test mode."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    product: Mapped[str] = mapped_column(String(30))
    amount_kzt: Mapped[int] = mapped_column(Integer)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(12))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
