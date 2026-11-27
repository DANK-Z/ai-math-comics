"""The student's daily task (a streak with bonuses) and the review of past mistakes.

Daily task: one short problem a day (Almaty time), its topic rotating through the practice
topics. A right answer pays a few coins; a streak of 3, 7 and 14 days in a row pays a bonus.
Each payment is a progress reward with its own key, so it is paid once and counts in the
class league's weekly coins. The task is a practice task with the run ``daily-<date>``.

Review: what the student got wrong in a lesson on the board or in a boss fight comes back
after two days in «Мой класс»: the chapter to solve again (until the server has checked it)
and the boss skill to drill (until a five-problem drill on it is finished after the slip).
"""

from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from .auth import Session, current_student
from .db import (
    AnalyticsLog,
    ClassLesson,
    LessonAnswer,
    PracticeTask,
    ProgressReward,
    StudentProfile,
    User,
)
from .practice import (
    DAILY_TOPICS,
    FEEDBACK,
    AnswerFormat,
    answer_format,
    check,
    from_stored,
    new_task,
)
from .schemas import Language

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]

ALMATY = timedelta(hours=5)
DAILY_COINS = 5
STREAK_BONUS = {3: 15, 7: 40, 14: 100}
REVIEW_AFTER = timedelta(days=2)
REVIEW_WINDOW = timedelta(days=30)
REVIEW_ITEMS = 5
DAILY_PREFIX = "daily-"


def now() -> datetime:
    return datetime.now(UTC)


def almaty_today() -> date:
    return (now() + ALMATY).date()


def daily_topic(user_id: int, day: date) -> str:
    return DAILY_TOPICS[(day.toordinal() + user_id) % len(DAILY_TOPICS)]


# ---- daily task --------------------------------------------------------------------------


class StreakBonus(BaseModel):
    days: int
    coins: int


class DailyOut(BaseModel):
    day: date
    taskId: str
    topic: str
    prompt: str
    answerFormat: AnswerFormat
    solved: bool
    streak: int
    """Days in a row with the daily task solved (today, or up to yesterday if not yet)."""
    nextBonus: StreakBonus | None = None
    coins: int = DAILY_COINS


class DailyAnswer(BaseModel):
    model_config = {"extra": "forbid"}

    taskId: str = Field(min_length=1, max_length=36)
    answer: str = Field(max_length=64)
    lang: Language


class DailyResult(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    message: str
    coins: int = 0
    """Coins paid by this answer: the day's coins plus a streak bonus."""
    bonus: StreakBonus | None = None
    daily: DailyOut


async def todays_task(session, user: User, day: date) -> PracticeTask:
    task = await session.scalar(
        select(PracticeTask)
        .where(PracticeTask.student_id == user.id, PracticeTask.run_id == DAILY_PREFIX + str(day))
        .order_by(PracticeTask.created_at)
        .limit(1)
    )
    if task is None:
        task = await new_task(session, user, daily_topic(user.id, day), None, 1, f"daily-{day}")
        await session.commit()
    return task


async def streak_of(session, user: User, today: date) -> int:
    runs = await session.scalars(
        select(PracticeTask.run_id).where(
            PracticeTask.student_id == user.id,
            PracticeTask.run_id.like(DAILY_PREFIX + "%"),
            PracticeTask.solved_at.is_not(None),
            PracticeTask.created_at >= now() - timedelta(days=400),
        )
    )
    days = {date.fromisoformat(r.removeprefix(DAILY_PREFIX)) for r in runs}
    day = today if today in days else today - timedelta(days=1)
    count = 0
    while day in days:
        count += 1
        day -= timedelta(days=1)
    return count


def next_bonus(streak: int) -> StreakBonus | None:
    """The next streak bonus: the next solved day makes the streak one day longer."""
    for days, coins in sorted(STREAK_BONUS.items()):
        if days > streak:
            return StreakBonus(days=days, coins=coins)
    return None


async def daily_out(session, user: User, task: PracticeTask, day: date, lang: str) -> DailyOut:
    streak = await streak_of(session, user, day)
    solved = task.solved_at is not None
    return DailyOut(
        day=day,
        taskId=task.id,
        topic=task.topic,
        prompt=from_stored(task.problem).prompt(lang),
        answerFormat=answer_format(task.topic),
        solved=solved,
        streak=streak,
        nextBonus=next_bonus(streak),
    )


@router.get("/me/daily", response_model=DailyOut)
async def my_daily(user: Student, session: Session, response: Response, lang: Language = "ru"):
    response.headers["Cache-Control"] = "no-store"
    day = almaty_today()
    return await daily_out(session, user, await todays_task(session, user, day), day, lang)


async def pay(session, user: User, key: str, coins: int) -> bool:
    if await session.get(ProgressReward, (user.id, key)) is not None:
        return False
    session.add(ProgressReward(student_id=user.id, reward_key=key, coins=coins, created_at=now()))
    await session.flush()
    await session.execute(
        update(StudentProfile)
        .where(StudentProfile.user_id == user.id)
        .values(total_coins=StudentProfile.total_coins + coins)
    )
    return True


@router.post("/me/daily/answer", response_model=DailyResult)
async def answer_daily(body: DailyAnswer, user: Student, session: Session):
    day = almaty_today()
    task = await session.get(PracticeTask, body.taskId)
    if task is None or task.student_id != user.id or task.run_id != DAILY_PREFIX + str(day):
        raise HTTPException(404, "task_not_found")
    copy = FEEDBACK[body.lang]
    if task.solved_at is not None:
        raise HTTPException(409, "task_solved")
    status = check(from_stored(task.problem), body.answer)
    if status != "correct":
        daily = await daily_out(session, user, task, day, body.lang)
        return DailyResult(status=status, message=copy[status], daily=daily)
    task.solved_at = now()
    await session.flush()
    coins = DAILY_COINS if await pay(session, user, f"daily-{day}", DAILY_COINS) else 0
    streak = await streak_of(session, user, day)
    bonus = None
    if streak in STREAK_BONUS and await pay(
        session, user, f"streak{streak}-{day}", STREAK_BONUS[streak]
    ):
        bonus = StreakBonus(days=streak, coins=STREAK_BONUS[streak])
        coins += bonus.coins
    await session.commit()
    return DailyResult(
        status="correct",
        message=copy["done"],
        coins=coins,
        bonus=bonus,
        daily=await daily_out(session, user, task, day, body.lang),
    )


# ---- review of mistakes ------------------------------------------------------------------


class ReviewItem(BaseModel):
    kind: Literal["chapter", "drill"]
    comicId: str | None = None
    topic: str | None = None
    skill: str | None = None
    mistakes: int
    since: datetime
    """When the (latest) slip happened."""


async def lesson_slips(session, user: User, verified: set[str]) -> list[ReviewItem]:
    start, end = now() - REVIEW_WINDOW, now() - REVIEW_AFTER
    rows = (
        await session.execute(
            select(LessonAnswer, ClassLesson)
            .join(ClassLesson, ClassLesson.id == LessonAnswer.lesson_id)
            .where(
                LessonAnswer.student_id == user.id,
                LessonAnswer.created_at >= start,
                LessonAnswer.created_at <= end,
            )
        )
    ).all()
    # The chapter's exercise counts as fixed when the second try was right.
    fixed = {(a.lesson_id, a.step) for a, _ in rows if a.correct}
    items: dict[str, ReviewItem] = {}
    for answer, lesson in rows:
        if answer.correct or (answer.lesson_id, answer.step) in fixed:
            continue
        comic = lesson.comic_id
        if answer.step:
            task = (lesson.quiz or [])[answer.step - 1] if lesson.quiz else {}
            comic = task.get("comicId")
        if not comic or comic in verified:
            continue
        item = items.get(comic)
        when = (
            answer.created_at if answer.created_at.tzinfo else answer.created_at.replace(tzinfo=UTC)
        )
        if item is None:
            items[comic] = ReviewItem(kind="chapter", comicId=comic, mistakes=1, since=when)
        else:
            item.mistakes += 1
            item.since = max(item.since, when)
    return list(items.values())


async def boss_slips(session, user: User) -> list[ReviewItem]:
    start, end = now() - REVIEW_WINDOW, now() - REVIEW_AFTER
    rows = await session.execute(
        select(
            AnalyticsLog.topic, AnalyticsLog.skill, func.count(), func.max(AnalyticsLog.created_at)
        )
        .where(
            AnalyticsLog.student_id == user.id,
            AnalyticsLog.status == "incorrect",
            AnalyticsLog.skill.is_not(None),
            AnalyticsLog.topic.in_(("fractions", "equations")),
            AnalyticsLog.created_at >= start,
            AnalyticsLog.created_at <= end,
        )
        .group_by(AnalyticsLog.topic, AnalyticsLog.skill)
    )
    items = []
    for topic, skill, count, last in rows:
        last = last if last.tzinfo else last.replace(tzinfo=UTC)
        drilled = await session.scalar(
            select(func.count())
            .select_from(PracticeTask)
            .where(
                PracticeTask.student_id == user.id,
                PracticeTask.skill == skill,
                PracticeTask.number == 5,
                PracticeTask.solved_at >= last,
            )
        )
        if not drilled:
            items.append(
                ReviewItem(kind="drill", topic=topic, skill=skill, mistakes=count, since=last)
            )
    return items


@router.get("/me/review", response_model=list[ReviewItem])
async def my_review(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    profile = await session.get(StudentProfile, user.id)
    verified = set((profile.season or {}).get("verifiedChapters", [])) if profile else set()
    items = await lesson_slips(session, user, verified) + await boss_slips(session, user)
    items.sort(key=lambda i: (-i.mistakes, i.since))
    return items[:REVIEW_ITEMS]
