"""Parents motivate: real-life challenges, a comparison with peers and a calendar of practice.

Challenges: the parent sets a rule with a real reward («3 звезды по уравнениям без ошибок =
+500 ₸ на карманные расходы»). Progress is counted from the child's real results after the
challenge was set; when it is reached the parent's area shows «… выполнил челлендж! Пора
порадовать героя», and the parent marks the reward as given. The child sees the challenges
with their progress on the home page.

Benchmark: the child's accuracy by topic (boss answers, last 30 days) and practice days next to
anonymous peers of the same grade on the platform. Shown only when there are at least
MIN_PEERS peers with enough answers, so no one can be singled out.

Calendar: days of a month with practice (answers, drills, lessons, chapters, boss wins) and the
current streak. From a five-day streak the parent can send a rare frame (once).
"""

import uuid
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .accounts import CHAPTER_IDS
from .auth import Session, current_student
from .daily import DAILY_PREFIX, almaty_today, streak_of
from .db import (
    AnalyticsLog,
    BackpackItem,
    BossResult,
    LessonAnswer,
    ParentChallenge,
    PracticeTask,
    Praise,
    ProgressReward,
    Role,
    SchoolClass,
    User,
)
from .family import Parent, linked_child

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]

ALMATY = timedelta(hours=5)
MAX_ACTIVE = 5
MIN_PEERS = 10
MIN_ANSWERS = 5
BENCH_DAYS = 30
STREAK_GIFT_DAYS = 5
STREAK_FRAME = "frame-fire"
ChallengeKind = Literal["boss_clean", "chapters", "drills", "streak"]
BossTopic = Literal["equations", "fractions"]
TARGETS: dict[str, tuple[int, int]] = {
    "boss_clean": (1, 5),
    "chapters": (1, 20),
    "drills": (1, 10),
    "streak": (3, 30),
}


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def local_day(moment: datetime) -> date:
    return (aware(moment) + ALMATY).date()


# ---- challenges ----------------------------------------------------------------------------


class ChallengeIn(BaseModel):
    model_config = {"extra": "forbid"}

    kind: ChallengeKind
    topic: BossTopic | None = None
    target: int = Field(ge=1, le=30)
    reward: str = Field(min_length=2, max_length=80)


class ChallengeOut(BaseModel):
    id: str
    kind: ChallengeKind
    topic: str | None = None
    target: int
    reward: str
    progress: int
    done: bool
    createdAt: datetime
    completedAt: datetime | None = None
    rewardedAt: datetime | None = None
    childName: str | None = None
    fromName: str | None = None


async def progress_of(session, child: User, item: ParentChallenge) -> int:
    since = aware(item.created_at)
    if item.kind == "boss_clean":
        query = (
            select(func.count())
            .select_from(BossResult)
            .where(
                BossResult.student_id == child.id,
                BossResult.created_at >= since,
                BossResult.stars == 3,
                BossResult.misses == 0,
            )
        )
        if item.topic:
            query = query.where(BossResult.topic == item.topic)
        return int(await session.scalar(query) or 0)
    if item.kind == "chapters":
        keys = await session.scalars(
            select(ProgressReward.reward_key).where(
                ProgressReward.student_id == child.id, ProgressReward.created_at >= since
            )
        )
        return sum(1 for key in keys if key in CHAPTER_IDS)
    if item.kind == "drills":
        return int(
            await session.scalar(
                select(func.count())
                .select_from(PracticeTask)
                .where(
                    PracticeTask.student_id == child.id,
                    PracticeTask.number == 5,
                    PracticeTask.solved_at >= since,
                    PracticeTask.run_id.not_like(DAILY_PREFIX + "%"),
                )
            )
            or 0
        )
    # streak: the current streak of daily tasks.
    return await streak_of(session, child, almaty_today())


async def challenge_out(session, child: User, item: ParentChallenge, **names) -> ChallengeOut:
    progress = await progress_of(session, child, item)
    if item.completed_at is None and progress >= item.target:
        item.completed_at = now()
        await session.commit()
    return ChallengeOut(
        id=item.id,
        kind=item.kind,
        topic=item.topic,
        target=item.target,
        reward=item.reward,
        progress=min(progress, item.target) if item.completed_at else progress,
        done=item.completed_at is not None,
        createdAt=aware(item.created_at),
        completedAt=aware(item.completed_at) if item.completed_at else None,
        rewardedAt=aware(item.rewarded_at) if item.rewarded_at else None,
        **names,
    )


async def own_challenge(session, parent: User, challenge_id: str) -> ParentChallenge:
    item = await session.get(ParentChallenge, challenge_id)
    if item is None or item.parent_id != parent.id:
        raise HTTPException(404, "challenge_not_found")
    return item


@router.get("/parent/children/{student_id}/challenges", response_model=list[ChallengeOut])
async def child_challenges(student_id: int, user: Parent, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    child = await linked_child(session, user, student_id)
    items = (
        await session.scalars(
            select(ParentChallenge)
            .where(ParentChallenge.parent_id == user.id, ParentChallenge.student_id == child.id)
            .order_by(ParentChallenge.created_at.desc())
            .limit(20)
        )
    ).all()
    return [await challenge_out(session, child, i, childName=child.display_name) for i in items]


@router.post(
    "/parent/children/{student_id}/challenges", status_code=201, response_model=ChallengeOut
)
async def set_challenge(student_id: int, body: ChallengeIn, user: Parent, session: Session):
    child = await linked_child(session, user, student_id)
    low, high = TARGETS[body.kind]
    if not low <= body.target <= high:
        raise HTTPException(422, "invalid_target")
    active = await session.scalar(
        select(func.count())
        .select_from(ParentChallenge)
        .where(
            ParentChallenge.parent_id == user.id,
            ParentChallenge.student_id == child.id,
            ParentChallenge.rewarded_at.is_(None),
        )
    )
    if active >= MAX_ACTIVE:
        raise HTTPException(409, "too_many_challenges")
    item = ParentChallenge(
        id=str(uuid.uuid4()),
        parent_id=user.id,
        student_id=child.id,
        kind=body.kind,
        topic=body.topic if body.kind == "boss_clean" else None,
        target=body.target,
        reward=body.reward.strip(),
        created_at=now(),
    )
    session.add(item)
    await session.commit()
    return await challenge_out(session, child, item, childName=child.display_name)


@router.post("/parent/challenges/{challenge_id}/rewarded", response_model=ChallengeOut)
async def mark_rewarded(challenge_id: str, user: Parent, session: Session):
    item = await own_challenge(session, user, challenge_id)
    child = await linked_child(session, user, item.student_id)
    if item.completed_at is None:
        raise HTTPException(409, "not_done")
    item.rewarded_at = item.rewarded_at or now()
    await session.commit()
    return await challenge_out(session, child, item, childName=child.display_name)


@router.delete("/parent/challenges/{challenge_id}", status_code=204)
async def delete_challenge(challenge_id: str, user: Parent, session: Session):
    item = await own_challenge(session, user, challenge_id)
    await session.delete(item)
    await session.commit()
    return Response(status_code=204)


@router.get("/me/challenges", response_model=list[ChallengeOut])
async def my_challenges(user: Student, session: Session, response: Response):
    """The student's challenges from all their parents: open ones and those done this week."""
    response.headers["Cache-Control"] = "no-store"
    rows = await session.execute(
        select(ParentChallenge, User.display_name)
        .join(User, User.id == ParentChallenge.parent_id)
        .where(ParentChallenge.student_id == user.id)
        .order_by(ParentChallenge.created_at.desc())
        .limit(10)
    )
    result = []
    for item, parent_name in rows:
        if item.rewarded_at and now() - aware(item.rewarded_at) > timedelta(days=7):
            continue
        result.append(await challenge_out(session, user, item, fromName=parent_name))
    return result


# ---- calendar ------------------------------------------------------------------------------


class CalendarDay(BaseModel):
    day: date
    count: int
    chapters: int
    bosses: int


class Calendar(BaseModel):
    month: str
    days: list[CalendarDay]
    streak: int
    """Days in a row with any practice, up to today (or yesterday)."""
    giftReady: bool
    giftSent: bool


async def activity_days(session, student_id: int, start: datetime) -> dict[date, Counter]:
    days: defaultdict[date, Counter] = defaultdict(Counter)
    for (at,) in await session.execute(
        select(AnalyticsLog.created_at).where(
            AnalyticsLog.student_id == student_id, AnalyticsLog.created_at >= start
        )
    ):
        days[local_day(at)]["count"] += 1
    for (at,) in await session.execute(
        select(LessonAnswer.created_at).where(
            LessonAnswer.student_id == student_id, LessonAnswer.created_at >= start
        )
    ):
        days[local_day(at)]["count"] += 1
    for (at,) in await session.execute(
        select(PracticeTask.solved_at).where(
            PracticeTask.student_id == student_id, PracticeTask.solved_at >= start
        )
    ):
        days[local_day(at)]["count"] += 1
    for key, at in await session.execute(
        select(ProgressReward.reward_key, ProgressReward.created_at).where(
            ProgressReward.student_id == student_id, ProgressReward.created_at >= start
        )
    ):
        days[local_day(at)]["count"] += 1
        if key in CHAPTER_IDS:
            days[local_day(at)]["chapters"] += 1
    for (at,) in await session.execute(
        select(BossResult.created_at).where(
            BossResult.student_id == student_id, BossResult.created_at >= start
        )
    ):
        days[local_day(at)]["count"] += 1
        days[local_day(at)]["bosses"] += 1
    return days


def streak_in(days: dict[date, Counter], today: date) -> int:
    day = today if days.get(today, {}).get("count") else today - timedelta(days=1)
    count = 0
    while days.get(day, {}).get("count"):
        count += 1
        day -= timedelta(days=1)
    return count


async def frame_owned(session, child_id: int) -> bool:
    return (
        await session.scalar(
            select(BackpackItem.id).where(
                BackpackItem.student_id == child_id, BackpackItem.item_key == STREAK_FRAME
            )
        )
    ) is not None


@router.get("/parent/children/{student_id}/calendar", response_model=Calendar)
async def calendar(
    student_id: int,
    user: Parent,
    session: Session,
    response: Response,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
):
    response.headers["Cache-Control"] = "no-store"
    child = await linked_child(session, user, student_id)
    today = almaty_today()
    first = date.fromisoformat(f"{month}-01") if month else today.replace(day=1)
    last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    # Enough history for the streak, and the whole month.
    start = datetime.combine(min(first, today - timedelta(days=60)), datetime.min.time(), UTC)
    days = await activity_days(session, child.id, start - ALMATY)
    streak = streak_in(days, today)
    sent = await frame_owned(session, child.id)
    return Calendar(
        month=first.strftime("%Y-%m"),
        days=[
            CalendarDay(
                day=d,
                count=days.get(d, {}).get("count", 0),
                chapters=days.get(d, {}).get("chapters", 0),
                bosses=days.get(d, {}).get("bosses", 0),
            )
            for d in (first + timedelta(days=i) for i in range((last - first).days + 1))
        ],
        streak=streak,
        giftReady=streak >= STREAK_GIFT_DAYS and not sent,
        giftSent=sent,
    )


@router.post("/parent/children/{student_id}/streak-gift", response_model=Calendar)
async def streak_gift(student_id: int, user: Parent, session: Session, response: Response):
    """A rare frame for a five-day streak: once per child, with a card on the child's home."""
    child = await linked_child(session, user, student_id)
    days = await activity_days(session, child.id, now() - timedelta(days=60))
    if streak_in(days, almaty_today()) < STREAK_GIFT_DAYS:
        raise HTTPException(409, "streak_too_short")
    if await frame_owned(session, child.id):
        raise HTTPException(409, "already_sent")
    session.add(
        BackpackItem(
            student_id=child.id,
            item_type="frame",
            item_key=STREAK_FRAME,
            is_equipped=False,
            acquired_at=now(),
        )
    )
    session.add(
        Praise(parent_id=user.id, student_id=child.id, kind="streak", coins=0, created_at=now())
    )
    await session.commit()
    return await calendar(student_id, user, session, response)


# ---- benchmark -----------------------------------------------------------------------------


class TopicBench(BaseModel):
    topic: str
    answers: int
    accuracy: int | None = None
    """The child's share of right answers (None: fewer than MIN_ANSWERS)."""
    peerAverage: int | None = None
    percentile: int | None = None
    """The share of peers the child is ahead of (None: too few peers to compare)."""


class Benchmark(BaseModel):
    grade: int | None = None
    peers: int
    days: int
    topics: list[TopicBench]
    activeDays: int
    activePercentile: int | None = None
    peerActiveDays: float | None = None


def ahead_of(value: float, others: list[float]) -> int:
    return round(100 * sum(1 for o in others if o < value) / len(others)) if others else 0


@router.get("/parent/children/{student_id}/benchmark", response_model=Benchmark)
async def benchmark(student_id: int, user: Parent, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    child = await linked_child(session, user, student_id)
    school_class = await session.get(SchoolClass, child.class_id) if child.class_id else None
    grade = school_class.grade if school_class else None
    query = select(User.id).where(User.role == Role.student)
    if grade is not None:
        query = query.join(SchoolClass, SchoolClass.id == User.class_id).where(
            SchoolClass.grade == grade
        )
    ids = list((await session.scalars(query)).all())
    if child.id not in ids:
        ids.append(child.id)
    since = now() - timedelta(days=BENCH_DAYS)

    answers: defaultdict[tuple[int, str], list[int]] = defaultdict(lambda: [0, 0])
    for student_id_, topic, status in await session.execute(
        select(AnalyticsLog.student_id, AnalyticsLog.topic, AnalyticsLog.status).where(
            AnalyticsLog.student_id.in_(ids),
            AnalyticsLog.created_at >= since,
            AnalyticsLog.status != "invalid",
        )
    ):
        row = answers[(student_id_, topic)]
        row[0] += 1
        row[1] += status == "correct"
    topics = sorted({t for (_, t) in answers})
    result = []
    for topic in topics:
        mine = answers.get((child.id, topic), [0, 0])
        peers = [
            r[1] / r[0]
            for (s, t), r in answers.items()
            if t == topic and s != child.id and r[0] >= MIN_ANSWERS
        ]
        has_own = mine[0] >= MIN_ANSWERS
        enough = len(peers) >= MIN_PEERS
        result.append(
            TopicBench(
                topic=topic,
                answers=mine[0],
                accuracy=round(100 * mine[1] / mine[0]) if has_own else None,
                peerAverage=round(100 * sum(peers) / len(peers)) if enough else None,
                percentile=ahead_of(mine[1] / mine[0], peers) if has_own and enough else None,
            )
        )

    # Practice days in the period, for everyone in the peer group.
    active: defaultdict[int, set[date]] = defaultdict(set)
    for model, column in (
        (AnalyticsLog, AnalyticsLog.created_at),
        (PracticeTask, PracticeTask.solved_at),
        (ProgressReward, ProgressReward.created_at),
        (LessonAnswer, LessonAnswer.created_at),
    ):
        for s, at in await session.execute(
            select(model.student_id, column).where(model.student_id.in_(ids), column >= since)
        ):
            active[s].add(local_day(at))
    peer_days = [len(active[s]) for s in ids if s != child.id]
    enough = len(peer_days) >= MIN_PEERS
    return Benchmark(
        grade=grade,
        peers=len(peer_days),
        days=BENCH_DAYS,
        topics=result,
        activeDays=len(active[child.id]),
        activePercentile=ahead_of(len(active[child.id]), peer_days) if enough else None,
        peerActiveDays=round(sum(peer_days) / len(peer_days), 1) if enough else None,
    )
