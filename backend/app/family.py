"""Parents: a family account follows a child's progress and sends praise.

The child shares a family code from their profile; the parent signs up with an e-mail and adds
the child by that code. The parent sees a summary built from the child's real data (checked
chapters, boss wins, skills from answer logs, drills, homework) and can send a praise card; once
a week a card may carry 20 gift coins. Gift coins are not earnings, so the class league ignores
them. Parents see only the children they added.
"""

import secrets
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from .accounts import (
    CHAPTER_IDS,
    AuthResponse,
    TeacherSignup,
    issue,
    me,
)
from .auth import Session, current_student, current_user, enforce_sign_in_limit, hash_password
from .db import (
    AnalyticsLog,
    BackpackItem,
    BossResult,
    FamilyCode,
    FamilyLink,
    Homework,
    PracticeTask,
    Praise,
    ProgressReward,
    Role,
    SchoolClass,
    StudentProfile,
    User,
)

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]

ALMATY = timedelta(hours=5)
GIFT_COINS = 20
GIFT_EVERY = timedelta(days=7)
MAX_CHILDREN = 6
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I
PraiseKind = Literal["proud", "keep-going", "star", "gift"]
# Cards a child can get: the ones above plus coins bought by a parent (billing.py).
CardKind = Literal["proud", "keep-going", "star", "gift", "coins"]


async def current_parent(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != Role.parent:
        raise HTTPException(403, "parents_only")
    return user


Parent = Annotated[User, Depends(current_parent)]


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


# ---- sign-up and the family code ---------------------------------------------------------


@router.post("/auth/parents", status_code=201, response_model=AuthResponse)
async def sign_up_parent(body: TeacherSignup, request: Request, session: Session):
    await enforce_sign_in_limit(request, session, f"signup-{body.email}")
    user = User(
        email=body.email,
        display_name=body.displayName,
        hashed_password=hash_password(body.password),
        role=Role.parent,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        raise HTTPException(409, "email_taken") from None
    return AuthResponse(token=issue(request, user), user=await me(session, user))


class FamilyCodeOut(BaseModel):
    code: str
    parents: int


@router.get("/me/family-code", response_model=FamilyCodeOut)
async def family_code(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    found = await session.get(FamilyCode, user.id)
    if found is None:
        for _ in range(20):
            code = "AMC-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
            if await session.scalar(select(FamilyCode.code).where(FamilyCode.code == code)) is None:
                break
        found = FamilyCode(student_id=user.id, code=code, created_at=now())
        session.add(found)
        await session.commit()
    parents = await session.scalar(
        select(func.count()).select_from(FamilyLink).where(FamilyLink.student_id == user.id)
    )
    return FamilyCodeOut(code=found.code, parents=parents or 0)


# ---- parent: children --------------------------------------------------------------------


class AddChild(BaseModel):
    model_config = {"extra": "forbid"}

    code: str = Field(min_length=6, max_length=16)

    @field_validator("code")
    @classmethod
    def _code(cls, value: str) -> str:
        return value.strip().upper()


class Win(BaseModel):
    kind: Literal["boss", "finale"]
    key: str
    stars: int = 0
    at: datetime


class ChildSummary(BaseModel):
    id: int
    name: str
    className: str | None = None
    skin: str | None = None
    coins: int
    stars: int
    chaptersMonth: int
    chaptersTotal: int
    bossWins: int
    cleanWins: int
    strengths: list[str]
    """Skills the child answers right most often (30 days)."""
    weakSkill: str | None = None
    weakMistakes: int = 0
    drillsWeek: int
    homeworkOpen: int
    homeworkOverdue: int
    lastActive: datetime | None = None
    recent: list[Win]
    giftReadyAt: datetime | None = None
    """When the next gift with coins can be sent (None: now)."""
    giftCoins: int = GIFT_COINS
    """Coins in the weekly gift (more with the family plan)."""


async def linked_child(session, parent: User, student_id: int) -> User:
    link = await session.get(FamilyLink, (parent.id, student_id))
    child = await session.get(User, student_id) if link else None
    if child is None or child.role != Role.student:
        raise HTTPException(404, "child_not_found")
    return child


async def summary(session, parent: User, child: User) -> ChildSummary:
    current = now()
    local = current + ALMATY
    month_start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - ALMATY
    week_ago = current - timedelta(days=7)
    month_ago = current - timedelta(days=30)

    profile = await session.get(StudentProfile, child.id)
    season = (profile.season if profile else None) or {}
    school_class = await session.get(SchoolClass, child.class_id) if child.class_id else None
    skin = await session.scalar(
        select(BackpackItem.item_key).where(
            BackpackItem.student_id == child.id,
            BackpackItem.is_equipped.is_(True),
            BackpackItem.item_type == "skin",
        )
    )
    rewards = (
        await session.execute(
            select(ProgressReward.reward_key, ProgressReward.created_at).where(
                ProgressReward.student_id == child.id
            )
        )
    ).all()
    chapters_month = sum(
        1 for key, at in rewards if key in CHAPTER_IDS and aware(at) >= month_start
    )
    wins = (
        await session.scalars(
            select(BossResult)
            .where(BossResult.student_id == child.id)
            .order_by(BossResult.created_at.desc())
        )
    ).all()
    logs = (
        await session.execute(
            select(AnalyticsLog.skill, AnalyticsLog.status).where(
                AnalyticsLog.student_id == child.id,
                AnalyticsLog.created_at >= month_ago,
                AnalyticsLog.skill.is_not(None),
            )
        )
    ).all()
    right = Counter(skill for skill, status in logs if status == "correct")
    wrong = Counter(skill for skill, status in logs if status == "incorrect")
    weak = next(((s, n) for s, n in wrong.most_common(1) if n >= 2), (None, 0))
    drills = await session.scalar(
        select(func.count()).where(
            PracticeTask.student_id == child.id,
            PracticeTask.number == 5,
            PracticeTask.solved_at.is_not(None),
            PracticeTask.created_at >= week_ago,
        )
    )
    homework_open = homework_overdue = 0
    if school_class is not None:
        verified = set(season.get("verifiedChapters", []))
        today = local.date()
        items = (
            await session.scalars(select(Homework).where(Homework.class_id == school_class.id))
        ).all()
        for item in items:
            done = item.target in verified if item.kind == "chapter" else False
            if item.kind == "practice":
                done = (
                    await session.scalar(
                        select(func.count()).where(
                            PracticeTask.student_id == child.id,
                            PracticeTask.topic == item.target,
                            PracticeTask.number == 5,
                            PracticeTask.solved_at.is_not(None),
                            PracticeTask.created_at >= item.created_at,
                        )
                    )
                    or 0
                ) > 0
            if not done:
                homework_open += 1
                homework_overdue += today > item.due_date
    moments = [aware(at) for _, at in rewards] + [aware(w.created_at) for w in wins]
    recent = [Win(kind="boss", key=w.topic, stars=w.stars, at=aware(w.created_at)) for w in wins]
    recent += [
        Win(kind="finale", key=key, at=aware(at)) for key, at in rewards if key.endswith("-finale")
    ]
    recent.sort(key=lambda w: w.at, reverse=True)
    last_gift = await session.scalar(
        select(func.max(Praise.created_at)).where(
            Praise.parent_id == parent.id, Praise.student_id == child.id, Praise.kind == "gift"
        )
    )
    gift_ready = aware(last_gift) + GIFT_EVERY if last_gift else None
    return ChildSummary(
        id=child.id,
        name=child.display_name,
        className=school_class.name if school_class else None,
        skin=skin,
        coins=profile.total_coins if profile else 0,
        stars=profile.stars_collected if profile else 0,
        chaptersMonth=chapters_month,
        chaptersTotal=len(season.get("verifiedChapters", [])),
        bossWins=len(wins),
        cleanWins=sum(1 for w in wins if w.misses == 0),
        # The weak skill is never also listed as a strength (a skill can have both counts).
        strengths=[s for s, _ in right.most_common() if s != weak[0]][:2],
        weakSkill=weak[0],
        weakMistakes=weak[1],
        drillsWeek=drills or 0,
        homeworkOpen=homework_open,
        homeworkOverdue=homework_overdue,
        lastActive=max(moments) if moments else None,
        recent=recent[:5],
        giftReadyAt=gift_ready if gift_ready and gift_ready > current else None,
        giftCoins=await gift_coins(session, parent.id),
    )


async def gift_coins(session, parent_id: int) -> int:
    from .billing import PLAN_GIFT_COINS, active_plan  # billing builds on this module

    return PLAN_GIFT_COINS if await active_plan(session, parent_id) else GIFT_COINS


@router.get("/parent/children", response_model=list[ChildSummary])
async def children(user: Parent, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    links = (
        await session.scalars(
            select(FamilyLink)
            .where(FamilyLink.parent_id == user.id)
            .order_by(FamilyLink.created_at)
        )
    ).all()
    result = []
    for link in links:
        child = await session.get(User, link.student_id)
        if child is not None:
            result.append(await summary(session, user, child))
    return result


@router.post("/parent/children", status_code=201, response_model=ChildSummary)
async def add_child(body: AddChild, request: Request, user: Parent, session: Session):
    # Codes are long, but guessing is still capped like a sign-in.
    await enforce_sign_in_limit(request, session, f"family-{user.id}")
    found = await session.scalar(select(FamilyCode).where(FamilyCode.code == body.code))
    if found is None:
        raise HTTPException(404, "family_code_not_found")
    count = await session.scalar(
        select(func.count()).select_from(FamilyLink).where(FamilyLink.parent_id == user.id)
    )
    if await session.get(FamilyLink, (user.id, found.student_id)) is None:
        if (count or 0) >= MAX_CHILDREN:
            raise HTTPException(409, "too_many_children")
        session.add(FamilyLink(parent_id=user.id, student_id=found.student_id, created_at=now()))
        await session.commit()
    child = await session.get(User, found.student_id)
    return await summary(session, user, child)


@router.delete("/parent/children/{student_id}", status_code=204)
async def remove_child(student_id: int, user: Parent, session: Session):
    link = await session.get(FamilyLink, (user.id, student_id))
    if link is None:
        raise HTTPException(404, "child_not_found")
    await session.delete(link)
    await session.commit()
    return Response(status_code=204)


# ---- praise ------------------------------------------------------------------------------


class PraiseIn(BaseModel):
    model_config = {"extra": "forbid"}

    kind: PraiseKind


@router.post("/parent/children/{student_id}/praise", status_code=201, response_model=ChildSummary)
async def send_praise(student_id: int, body: PraiseIn, user: Parent, session: Session):
    child = await linked_child(session, user, student_id)
    coins = 0
    if body.kind == "gift":
        last = await session.scalar(
            select(func.max(Praise.created_at)).where(
                Praise.parent_id == user.id, Praise.student_id == child.id, Praise.kind == "gift"
            )
        )
        if last is not None and now() - aware(last) < GIFT_EVERY:
            raise HTTPException(409, "gift_too_soon")
        coins = await gift_coins(session, user.id)
        await session.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == child.id)
            .values(total_coins=StudentProfile.total_coins + coins)
        )
    session.add(
        Praise(
            parent_id=user.id, student_id=child.id, kind=body.kind, coins=coins, created_at=now()
        )
    )
    await session.commit()
    return await summary(session, user, child)


class PraiseOut(BaseModel):
    id: int
    kind: CardKind
    coins: int
    fromName: str
    at: datetime


@router.get("/me/praise", response_model=list[PraiseOut])
async def my_praise(user: Student, session: Session, response: Response):
    """Unseen cards from the student's parents (newest first)."""
    response.headers["Cache-Control"] = "no-store"
    rows = await session.execute(
        select(Praise, User.display_name)
        .join(User, User.id == Praise.parent_id)
        .where(Praise.student_id == user.id, Praise.seen_at.is_(None))
        .order_by(Praise.created_at.desc())
        .limit(5)
    )
    return [
        PraiseOut(id=p.id, kind=p.kind, coins=p.coins, fromName=name, at=aware(p.created_at))
        for p, name in rows
    ]


@router.post("/me/praise/seen", status_code=204)
async def praise_seen(user: Student, session: Session):
    await session.execute(
        update(Praise)
        .where(Praise.student_id == user.id, Praise.seen_at.is_(None))
        .values(seen_at=now())
    )
    await session.commit()
    return Response(status_code=204)
