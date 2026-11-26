"""Duels: two students solve the same five problems; the first to solve all five wins.

A student opens a duel by code (to send a friend) or with a classmate: the class duel joins a
classmate already waiting on the same topic, otherwise it waits for one. Both players get the
same problems in the same order; each answer is checked on the server and only a right answer
moves the player on. When the time is up (DUEL_TIME), the one further ahead wins (a tie stays
a tie). The winner gets a few coins (once per duel, as a progress reward).
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from .auth import Session, current_student
from .classroom import short_name
from .db import Duel, ProgressReward, SchoolClass, StudentProfile, User
from .practice import TOPICS, answer_format, check, from_stored, make_problem
from .schemas import Language

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]

PROBLEMS = 5
DUEL_TIME = timedelta(minutes=3)
WAIT_TIME = timedelta(minutes=10)
WIN_COINS = 10
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime | None) -> datetime | None:
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


class DuelStart(BaseModel):
    model_config = {"extra": "forbid"}

    topic: Literal["fractions", "equations", "gcd", "decimals", "parts"]
    mode: Literal["code", "class"]


class DuelJoin(BaseModel):
    model_config = {"extra": "forbid"}

    code: str = Field(min_length=4, max_length=8)


class DuelAnswer(BaseModel):
    model_config = {"extra": "forbid"}

    answer: str = Field(min_length=1, max_length=64)
    lang: Language


class DuelOut(BaseModel):
    id: str
    code: str
    topic: str
    status: Literal["waiting", "active", "done"]
    total: int
    me: int
    opponent: int
    opponentName: str | None = None
    secondsLeft: int | None = None
    prompt: str | None = None
    """My current problem (while the duel runs and I still have problems to solve)."""
    answerFormat: str
    result: Literal["won", "lost", "tie"] | None = None
    coins: int = 0


class DuelResult(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    duel: DuelOut


def side(duel: Duel, user: User) -> Literal["a", "b"]:
    if duel.player_a == user.id:
        return "a"
    if duel.player_b == user.id:
        return "b"
    raise HTTPException(404, "duel_not_found")


async def settle(session, duel: Duel) -> None:
    """Ends a duel when someone solved everything or the time is up; pays the winner."""
    if duel.status != "active":
        return
    started = aware(duel.started_at) or now()
    done = PROBLEMS in (duel.progress_a, duel.progress_b)
    if not done and now() < started + DUEL_TIME:
        return
    duel.status = "done"
    duel.finished_at = now()
    if duel.progress_a != duel.progress_b:
        duel.winner_id = duel.player_a if duel.progress_a > duel.progress_b else duel.player_b
        key = f"duel-{duel.id}"
        if await session.get(ProgressReward, (duel.winner_id, key)) is None:
            session.add(
                ProgressReward(
                    student_id=duel.winner_id, reward_key=key, coins=WIN_COINS, created_at=now()
                )
            )
            await session.flush()
            await session.execute(
                update(StudentProfile)
                .where(StudentProfile.user_id == duel.winner_id)
                .values(total_coins=StudentProfile.total_coins + WIN_COINS)
            )
    await session.commit()


async def duel_out(session, duel: Duel, user: User, lang: str) -> DuelOut:
    await settle(session, duel)
    mine = side(duel, user)
    me = duel.progress_a if mine == "a" else duel.progress_b
    other = duel.progress_b if mine == "a" else duel.progress_a
    other_id = duel.player_b if mine == "a" else duel.player_a
    other_user = await session.get(User, other_id) if other_id else None
    left = None
    if duel.status == "active":
        left = max(0, round(((aware(duel.started_at) + DUEL_TIME) - now()).total_seconds()))
    prompt = None
    if duel.status == "active" and me < PROBLEMS:
        prompt = from_stored(duel.problems[me]).prompt(lang)
    result = None
    if duel.status == "done":
        result = (
            "tie" if duel.winner_id is None else ("won" if duel.winner_id == user.id else "lost")
        )
    return DuelOut(
        id=duel.id,
        code=duel.code,
        topic=duel.topic,
        status=duel.status,
        total=PROBLEMS,
        me=me,
        opponent=other,
        opponentName=short_name(other_user.display_name) if other_user else None,
        secondsLeft=left,
        prompt=prompt,
        answerFormat=answer_format(duel.topic),
        result=result,
        coins=WIN_COINS if result == "won" else 0,
    )


async def grade_of(session, user: User) -> int:
    school_class = await session.get(SchoolClass, user.class_id) if user.class_id else None
    return school_class.grade if school_class else 5


def start(duel: Duel, opponent: User) -> None:
    duel.player_b = opponent.id
    duel.status = "active"
    duel.started_at = now()


@router.post("/me/duels", response_model=DuelOut, status_code=201)
async def open_duel(body: DuelStart, user: Student, session: Session, lang: Language = "ru"):
    if body.topic not in TOPICS:
        raise HTTPException(422, "unknown_topic")
    if body.mode == "class":
        if not user.class_id:
            raise HTTPException(409, "no_class")
        waiting = await session.scalar(
            select(Duel)
            .where(
                Duel.class_id == user.class_id,
                Duel.topic == body.topic,
                Duel.status == "waiting",
                Duel.player_a != user.id,
                Duel.created_at >= now() - WAIT_TIME,
            )
            .order_by(Duel.created_at)
            .limit(1)
        )
        if waiting is not None:
            start(waiting, user)
            await session.commit()
            return await duel_out(session, waiting, user, lang)
    grade = await grade_of(session, user)
    duel = Duel(
        id=str(uuid.uuid4()),
        code="".join(secrets.choice(CODE_ALPHABET) for _ in range(5)),
        class_id=user.class_id if body.mode == "class" else None,
        topic=body.topic,
        problems=[make_problem(body.topic, grade).stored() for _ in range(PROBLEMS)],
        player_a=user.id,
        progress_a=0,
        progress_b=0,
        status="waiting",
        created_at=now(),
    )
    session.add(duel)
    await session.commit()
    return await duel_out(session, duel, user, lang)


@router.post("/me/duels/join", response_model=DuelOut)
async def join_duel(body: DuelJoin, user: Student, session: Session, lang: Language = "ru"):
    duel = await session.scalar(
        select(Duel)
        .where(Duel.code == body.code.strip().upper(), Duel.status == "waiting")
        .order_by(Duel.created_at.desc())
        .limit(1)
    )
    if duel is None or aware(duel.created_at) < now() - WAIT_TIME:
        raise HTTPException(404, "duel_not_found")
    if duel.player_a == user.id:
        raise HTTPException(409, "own_duel")
    start(duel, user)
    await session.commit()
    return await duel_out(session, duel, user, lang)


@router.get("/me/duels/{duel_id}", response_model=DuelOut)
async def get_duel(
    duel_id: str, user: Student, session: Session, response: Response, lang: Language = "ru"
):
    response.headers["Cache-Control"] = "no-store"
    duel = await session.get(Duel, duel_id, populate_existing=True)
    if duel is None:
        raise HTTPException(404, "duel_not_found")
    return await duel_out(session, duel, user, lang)


@router.post("/me/duels/{duel_id}/answer", response_model=DuelResult)
async def answer_duel(duel_id: str, body: DuelAnswer, user: Student, session: Session):
    duel = await session.get(Duel, duel_id, populate_existing=True)
    if duel is None:
        raise HTTPException(404, "duel_not_found")
    mine = side(duel, user)
    await settle(session, duel)
    if duel.status != "active":
        raise HTTPException(409, "duel_not_active")
    progress = duel.progress_a if mine == "a" else duel.progress_b
    if progress >= PROBLEMS:
        raise HTTPException(409, "already_done")
    status = check(from_stored(duel.problems[progress]), body.answer)
    if status == "correct":
        if mine == "a":
            duel.progress_a += 1
        else:
            duel.progress_b += 1
        await session.commit()
    return DuelResult(status=status, duel=await duel_out(session, duel, user, body.lang))
