"""Classroom play: the weekly class leaderboard and class battles.

Leaderboard: classmates ranked by stars, then coins earned this week (Monday 00:00, Almaty
time). Only earnings count (boss wins and one-time progress rewards), never spending, so a
purchase in the shop does not drop a student down the table. Classmates are shown by first
name and the initial of the last name; other classes and schools are never shown.

Class battle: a teacher starts a giant boss for the class (on the board). Every student opens
the battle from their phone and gets server-chosen problems of the class topic; each correct
answer deals DAMAGE to the shared boss. Answers stay on the server and damage is applied with
one conditional UPDATE, so simultaneous hits from a whole class all count and the boss is
beaten exactly once.
"""

import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import Session, current_student, current_teacher
from .db import (
    BackpackItem,
    BattleTask,
    BossResult,
    ClassBattle,
    LessonAward,
    ProgressReward,
    Role,
    SchoolClass,
    User,
)
from .practice import AnswerFormat, Topic, answer_format, check, from_stored, make_problem
from .presence import Present, present, touch
from .schemas import Language

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]
Teacher = Annotated[User, Depends(current_teacher)]

ALMATY = timedelta(hours=5)
LEADERBOARD_SIZE = 10
DAMAGE = 10
BATTLE_HP = (300, 600, 1000)
# After this many misses on one problem the student gets a new one (no endless guessing).
MISSES_PER_TASK = 3

Difficulty = Literal["basic", "intermediate", "advanced"]


def week_start(now: datetime | None = None) -> datetime:
    """Monday 00:00 in Almaty, as a UTC datetime."""
    local = (now or datetime.now(UTC)) + ALMATY
    monday = (local - timedelta(days=local.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return monday - ALMATY


def short_name(display_name: str) -> str:
    """«Даниал Ахметов» -> «Даниал А.»: enough for classmates, no full surnames."""
    parts = display_name.split()
    if not parts:
        return "?"
    return f"{parts[0]} {parts[1][0]}." if len(parts) > 1 else parts[0]


# ---- leaderboard -------------------------------------------------------------------------


class LeaderRow(BaseModel):
    rank: int
    name: str
    stars: int
    coins: int
    cleanWins: int
    me: bool = False
    # What the student wears from the fair shop: Pifik's skin, the avatar frame and the title.
    skin: str | None = None
    frame: str | None = None
    title: str | None = None


class Leaderboard(BaseModel):
    className: str
    weekStart: datetime
    rows: list[LeaderRow]
    """Top of the class, plus the student's own row when it is lower."""
    classSize: int


async def build_leaderboard(session: AsyncSession, school_class: SchoolClass, me_id: int | None):
    since = week_start()
    students = (
        await session.scalars(
            select(User).where(User.class_id == school_class.id, User.role == Role.student)
        )
    ).all()
    ids = [s.id for s in students]
    stars: Counter[int] = Counter()
    coins: Counter[int] = Counter()
    clean: Counter[int] = Counter()
    if ids:
        wins = await session.execute(
            select(
                BossResult.student_id, BossResult.stars, BossResult.coins, BossResult.misses
            ).where(BossResult.student_id.in_(ids), BossResult.created_at >= since)
        )
        for student_id, s, c, misses in wins:
            stars[student_id] += s
            coins[student_id] += c
            clean[student_id] += misses == 0
        rewards = await session.execute(
            select(ProgressReward.student_id, func.sum(ProgressReward.coins))
            .where(ProgressReward.student_id.in_(ids), ProgressReward.created_at >= since)
            .group_by(ProgressReward.student_id)
        )
        for student_id, total in rewards:
            coins[student_id] += int(total or 0)
        podium = await session.execute(
            select(LessonAward.student_id, LessonAward.stars).where(
                LessonAward.student_id.in_(ids), LessonAward.created_at >= since
            )
        )
        for student_id, s in podium:  # the mini-quiz podium of lessons on the board
            stars[student_id] += s
    worn: dict[int, dict[str, str]] = {}
    if ids:
        items = await session.execute(
            select(BackpackItem.student_id, BackpackItem.item_type, BackpackItem.item_key).where(
                BackpackItem.student_id.in_(ids),
                BackpackItem.is_equipped.is_(True),
                BackpackItem.item_type.in_(("skin", "frame", "title")),
            )
        )
        for student_id, kind, key in items:
            worn.setdefault(student_id, {})[kind] = key
    ordered = sorted(
        students,
        key=lambda s: (-stars[s.id], -coins[s.id], -clean[s.id], s.display_name.casefold()),
    )
    rows: list[LeaderRow] = []
    rank = 0
    previous = None
    for position, student in enumerate(ordered, start=1):
        score = (stars[student.id], coins[student.id], clean[student.id])
        if score != previous:  # equal scores share a place
            rank, previous = position, score
        rows.append(
            LeaderRow(
                rank=rank,
                name=short_name(student.display_name),
                stars=score[0],
                coins=score[1],
                cleanWins=score[2],
                me=student.id == me_id,
                **worn.get(student.id, {}),
            )
        )
    shown = rows[:LEADERBOARD_SIZE] + [r for r in rows[LEADERBOARD_SIZE:] if r.me]
    return Leaderboard(
        className=school_class.name, weekStart=since, rows=shown, classSize=len(rows)
    )


@router.get("/me/leaderboard", response_model=Leaderboard)
async def my_leaderboard(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    school_class = await session.get(SchoolClass, user.class_id) if user.class_id else None
    if school_class is None:
        raise HTTPException(404, "no_class")
    return await build_leaderboard(session, school_class, user.id)


@router.get("/teacher/classes/{class_id}/leaderboard", response_model=Leaderboard)
async def class_leaderboard(class_id: int, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    return await build_leaderboard(session, school_class, None)


# ---- class battle ------------------------------------------------------------------------


class BattleStart(BaseModel):
    model_config = {"extra": "forbid"}

    topic: Topic
    difficulty: Difficulty = "basic"
    hp: int = Field(default=600)


class Fighter(BaseModel):
    name: str
    hits: int


class Hit(BaseModel):
    name: str
    at: datetime


class BattleBoard(BaseModel):
    """What the class board shows."""

    id: str
    classId: int
    className: str
    classCode: str
    topic: Topic
    difficulty: Difficulty
    maxHp: int
    hp: int
    damagePerHit: int
    status: Literal["active", "won", "stopped"]
    hits: int
    fighters: int
    top: list[Fighter]
    recent: list[Hit]
    present: list[Present] = []
    startedAt: datetime
    finishedAt: datetime | None = None


class BattleTaskOut(BaseModel):
    id: str
    prompt: str
    answerFormat: AnswerFormat


class StudentBattle(BaseModel):
    id: str
    topic: Topic
    maxHp: int
    hp: int
    damagePerHit: int
    status: Literal["active", "won", "stopped"]
    myHits: int
    classHits: int
    task: BattleTaskOut | None = None


class BattleAnswer(BaseModel):
    model_config = {"extra": "forbid"}

    taskId: str = Field(min_length=1, max_length=36)
    answer: str = Field(max_length=64)
    lang: Language


class BattleAnswerResult(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    message: str
    damage: int
    battle: StudentBattle


FEEDBACK = {
    "ru": {
        "correct": "Попадание! −{damage} HP боссу.",
        "incorrect": "Мимо! Проверь вычисления и попробуй ещё раз.",
        "invalid": "Запиши ответ числом или дробью, например 12 или 3/4.",
        "swap": "Мимо! Держи новую задачу — у тебя получится.",
    },
    "kk": {
        "correct": "Дәл тидің! Боссқа −{damage} HP.",
        "incorrect": "Тимеді! Есебіңді тексеріп, қайта көр.",
        "invalid": "Жауапты санмен немесе бөлшекпен жаз, мысалы 12 немесе 3/4.",
        "swap": "Тимеді! Міне, жаңа есеп — сен міндетті түрде шешесің.",
    },
}


async def own_class(session: AsyncSession, teacher: User, class_id: int) -> SchoolClass:
    school_class = await session.get(SchoolClass, class_id)
    if school_class is None or school_class.teacher_id != teacher.id:
        raise HTTPException(404, "class_not_found")  # never reveal other teachers' classes
    return school_class


async def board(session: AsyncSession, battle: ClassBattle) -> BattleBoard:
    school_class = await session.get(SchoolClass, battle.class_id)
    solved = await session.execute(
        select(BattleTask.student_id, BattleTask.solved_at, User.display_name)
        .join(User, User.id == BattleTask.student_id)
        .where(BattleTask.battle_id == battle.id, BattleTask.solved_at.is_not(None))
        .order_by(BattleTask.solved_at.desc())
    )
    solved = solved.all()
    fighters = await session.scalar(
        select(func.count(func.distinct(BattleTask.student_id))).where(
            BattleTask.battle_id == battle.id
        )
    )
    names = {student_id: short_name(name) for student_id, _, name in solved}
    per_student = Counter(student_id for student_id, _, _ in solved)
    return BattleBoard(
        present=await present(session, battle.id, battle.class_id),
        id=battle.id,
        classId=school_class.id,
        className=school_class.name,
        classCode=school_class.code,
        topic=battle.topic,
        difficulty=battle.difficulty,
        maxHp=battle.max_hp,
        hp=max(0, battle.max_hp - battle.damage),
        damagePerHit=DAMAGE,
        status=battle.status,
        hits=len(solved),
        fighters=fighters or 0,
        top=[Fighter(name=names[i], hits=n) for i, n in per_student.most_common(5)],
        recent=[Hit(name=names[i], at=at) for i, at, _ in solved[:6]],
        startedAt=battle.created_at,
        finishedAt=battle.finished_at,
    )


async def teacher_battle(session: AsyncSession, teacher: User, battle_id: str) -> ClassBattle:
    battle = await session.get(ClassBattle, battle_id, populate_existing=True)
    if battle is None:
        raise HTTPException(404, "battle_not_found")
    await own_class(session, teacher, battle.class_id)
    return battle


@router.post("/teacher/classes/{class_id}/battles", status_code=201, response_model=BattleBoard)
async def start_battle(class_id: int, body: BattleStart, user: Teacher, session: Session):
    if body.hp not in BATTLE_HP:
        raise HTTPException(422, "hp_not_allowed")
    school_class = await own_class(session, user, class_id)
    # One battle at a time per class: a new one ends the previous.
    await session.execute(
        update(ClassBattle)
        .where(ClassBattle.class_id == school_class.id, ClassBattle.status == "active")
        .values(status="stopped", finished_at=datetime.now(UTC))
    )
    battle = ClassBattle(
        id=str(uuid.uuid4()),
        class_id=school_class.id,
        topic=body.topic,
        difficulty=body.difficulty,
        max_hp=body.hp,
        damage=0,
        status="active",
        created_at=datetime.now(UTC),
    )
    session.add(battle)
    await session.commit()
    return await board(session, battle)


@router.get("/teacher/classes/{class_id}/battles/current", response_model=BattleBoard | None)
async def current_class_battle(class_id: int, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    battle = await latest_battle(session, school_class.id)
    return await board(session, battle) if battle else None


@router.get("/teacher/battles/{battle_id}", response_model=BattleBoard)
async def battle_board(battle_id: str, user: Teacher, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await board(session, await teacher_battle(session, user, battle_id))


@router.post("/teacher/battles/{battle_id}/stop", response_model=BattleBoard)
async def stop_battle(battle_id: str, user: Teacher, session: Session):
    battle = await teacher_battle(session, user, battle_id)
    if battle.status == "active":
        battle.status = "stopped"
        battle.finished_at = datetime.now(UTC)
        await session.commit()
    return await board(session, battle)


async def latest_battle(session: AsyncSession, class_id: int) -> ClassBattle | None:
    """The active battle, or one finished in the last hour (so the class sees the result)."""
    battle = await session.scalar(
        select(ClassBattle)
        .where(ClassBattle.class_id == class_id)
        .order_by(ClassBattle.created_at.desc())
        .limit(1)
        .execution_options(populate_existing=True)
    )
    if battle is None or battle.status == "active":
        return battle
    finished = battle.finished_at
    if finished is not None and finished.tzinfo is None:
        finished = finished.replace(tzinfo=UTC)
    if finished is None or datetime.now(UTC) - finished > timedelta(hours=1):
        return None
    return battle


def new_problem(battle: ClassBattle, grade: int):
    return make_problem(battle.topic, grade, battle.difficulty)


def stored(problem) -> dict:
    return problem.stored()


async def open_task(
    session: AsyncSession, battle: ClassBattle, student: User, grade: int
) -> BattleTask:
    task = await session.scalar(
        select(BattleTask)
        .where(
            BattleTask.battle_id == battle.id,
            BattleTask.student_id == student.id,
            BattleTask.solved_at.is_(None),
            BattleTask.misses < MISSES_PER_TASK,
        )
        .order_by(BattleTask.created_at.desc())
        .limit(1)
    )
    if task is None:
        task = BattleTask(
            id=str(uuid.uuid4()),
            battle_id=battle.id,
            student_id=student.id,
            problem=stored(new_problem(battle, grade)),
            misses=0,
            created_at=datetime.now(UTC),
        )
        session.add(task)
        await session.flush()
    return task


async def student_view(
    session: AsyncSession, battle: ClassBattle, student: User, lang: Language, grade: int
) -> StudentBattle:
    task = None
    if battle.status == "active":
        open_ = await open_task(session, battle, student, grade)
        problem = from_stored(open_.problem)
        task = BattleTaskOut(
            id=open_.id, prompt=problem.prompt(lang), answerFormat=answer_format(battle.topic)
        )
    mine = await session.scalar(
        select(func.count()).where(
            BattleTask.battle_id == battle.id,
            BattleTask.student_id == student.id,
            BattleTask.solved_at.is_not(None),
        )
    )
    everyone = await session.scalar(
        select(func.count()).where(
            BattleTask.battle_id == battle.id, BattleTask.solved_at.is_not(None)
        )
    )
    await session.commit()
    return StudentBattle(
        id=battle.id,
        topic=battle.topic,
        maxHp=battle.max_hp,
        hp=max(0, battle.max_hp - battle.damage),
        damagePerHit=DAMAGE,
        status=battle.status,
        myHits=mine or 0,
        classHits=everyone or 0,
        task=task,
    )


async def student_class(session: AsyncSession, user: User) -> SchoolClass:
    school_class = await session.get(SchoolClass, user.class_id) if user.class_id else None
    if school_class is None:
        raise HTTPException(404, "no_class")
    return school_class


@router.get("/me/battle", response_model=StudentBattle | None)
async def my_battle(user: Student, session: Session, response: Response, lang: Language = "ru"):
    response.headers["Cache-Control"] = "no-store"
    school_class = await student_class(session, user)
    battle = await latest_battle(session, school_class.id)
    if battle is None:
        return None
    await touch(session, battle.id, user.id)  # the board's lobby
    return await student_view(session, battle, user, lang, school_class.grade)


@router.post("/me/battle/{battle_id}/answer", response_model=BattleAnswerResult)
async def answer_battle(battle_id: str, body: BattleAnswer, user: Student, session: Session):
    school_class = await student_class(session, user)
    battle = await session.get(ClassBattle, battle_id, populate_existing=True)
    if battle is None or battle.class_id != school_class.id:
        raise HTTPException(404, "battle_not_found")
    task = await session.get(BattleTask, body.taskId, populate_existing=True)
    if task is None or task.battle_id != battle.id or task.student_id != user.id:
        raise HTTPException(404, "task_not_found")
    copy = FEEDBACK[body.lang]
    if battle.status != "active" or task.solved_at is not None:
        # The boss fell (or the teacher stopped the battle) while this answer was on its way.
        view = await student_view(session, battle, user, body.lang, school_class.grade)
        return BattleAnswerResult(status="invalid", message="", damage=0, battle=view)
    status = check(from_stored(task.problem), body.answer)
    damage = 0
    message = copy[status]
    if status == "correct":
        # Conditional updates: a task pays once, and the boss's HP never goes below zero.
        marked = await session.execute(
            update(BattleTask)
            .where(BattleTask.id == task.id, BattleTask.solved_at.is_(None))
            .values(solved_at=datetime.now(UTC))
        )
        if marked.rowcount == 1:
            capped = case(
                (ClassBattle.damage + DAMAGE > ClassBattle.max_hp, ClassBattle.max_hp),
                else_=ClassBattle.damage + DAMAGE,
            )
            hit = await session.execute(
                update(ClassBattle)
                .where(
                    ClassBattle.id == battle.id,
                    ClassBattle.status == "active",
                    ClassBattle.damage < ClassBattle.max_hp,
                )
                .values(damage=capped)
            )
            damage = DAMAGE if hit.rowcount == 1 else 0
            if not damage:  # the boss fell a moment earlier: this answer is not a hit
                await session.execute(
                    update(BattleTask).where(BattleTask.id == task.id).values(solved_at=None)
                )
            await session.execute(
                update(ClassBattle)
                .where(
                    ClassBattle.id == battle.id,
                    ClassBattle.status == "active",
                    ClassBattle.damage >= ClassBattle.max_hp,
                )
                .values(status="won", finished_at=datetime.now(UTC))
            )
        message = message.format(damage=damage or DAMAGE)
    elif status == "incorrect":
        task.misses += 1
        if task.misses >= MISSES_PER_TASK:
            message = copy["swap"]
    await session.commit()
    await session.refresh(battle)
    view = await student_view(session, battle, user, body.lang, school_class.grade)
    return BattleAnswerResult(status=status, message=message, damage=damage, battle=view)
