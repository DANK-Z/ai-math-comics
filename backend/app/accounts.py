"""Accounts API: student/teacher sign-up and sign-in, class codes, saved progress and coins,
boss-fight analytics and the teacher dashboard.

Coins and stars are never sent by the client. The answer-check endpoint logs every checked
answer of a signed-in student (``record_attempt``); when all rounds of a comic's boss are solved,
the server computes stars from the logged misses and awards coins once.
"""

import json
import re
import secrets
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .assignments import accessible_assignment, assignment_exercise
from .auth import (
    DUMMY_HASH,
    Session,
    create_token,
    current_student,
    current_teacher,
    current_user,
    enforce_sign_in_limit,
    hash_password,
    verify_password,
)
from .db import (
    AnalyticsLog,
    BackpackItem,
    BossResult,
    ProgressReward,
    Role,
    SchoolClass,
    StudentProfile,
    User,
)
from .schemas import Reward

LOGIN = re.compile(r"[a-z0-9_.-]{3,24}")
EMAIL = re.compile(r"[^@\s]{1,64}@[^@\s]{1,185}\.[a-z]{2,24}")
NAME = re.compile(r"[\w .,'\-—–«»()]{1,60}")
SCHOOL = re.compile(r"[A-Z]{2,8}")
CLASS_CODE = re.compile(r"[A-Z0-9-]{4,32}")
CHAPTER = re.compile(r"[a-z0-9-]{1,40}")
GENERATED_EXERCISE = re.compile(
    r"(fractions|equations)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
    r"(?:-r([23]))?"
)
# Cyrillic/Kazakh class letters -> Latin for codes such as KOKSH-5A-2026.
CLASS_LETTERS = dict(
    zip(
        "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЭЮЯӘҒҚҢӨҰҮІ",
        "ABVGDEJZIIKLMNOPRSTUFHCCSEUYAGQNOUUI",
        strict=True,
    )
)


def clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not NAME.fullmatch(value) or any(ch.isdigit() or ch == "_" for ch in value):
        raise ValueError("displayName: letters, spaces and light punctuation")
    return value


def stars_for(misses: int) -> int:
    return 3 if misses == 0 else 2 if misses <= 2 else 1


def coins_for(stars: int) -> int:
    return 10 + 10 * stars


# ---- request / response models ------------------------------------------------------------


class StudentSignup(BaseModel):
    model_config = {"extra": "forbid"}

    login: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=8, max_length=72)
    displayName: str = Field(min_length=1, max_length=60)
    classCode: str | None = Field(default=None, max_length=32)

    @field_validator("login")
    @classmethod
    def _login(cls, value: str) -> str:
        value = value.strip().lower()
        if not LOGIN.fullmatch(value):
            raise ValueError("login: 3-24 latin letters, digits, _ . -")
        return value

    @field_validator("displayName")
    @classmethod
    def _name(cls, value: str) -> str:
        return clean_name(value)

    @field_validator("classCode")
    @classmethod
    def _code(cls, value: str | None) -> str | None:
        return (value or "").strip().upper() or None


class TeacherSignup(BaseModel):
    model_config = {"extra": "forbid"}

    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=72)
    displayName: str = Field(min_length=1, max_length=60)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL.fullmatch(value):
            raise ValueError("email is not valid")
        return value

    @field_validator("displayName")
    @classmethod
    def _name(cls, value: str) -> str:
        return clean_name(value)


class LoginRequest(BaseModel):
    model_config = {"extra": "forbid"}

    login: str = Field(min_length=1, max_length=254)  # a student login or a teacher e-mail
    password: str = Field(min_length=1, max_length=128)


class JoinClass(BaseModel):
    model_config = {"extra": "forbid"}

    code: str = Field(min_length=4, max_length=32)


# One-time coins for progress (chapters 5, finales 10, panel secrets 5), by completed id.
# The list is shared with the frontend: frontend/src/progressRewards.json (the Docker image
# copies it next to the backend).
REWARDS_FILE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "progressRewards.json"
PROGRESS_REWARDS: dict[str, int] = json.loads(REWARDS_FILE.read_text(encoding="utf-8"))["rewards"]


class SeasonUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    completedChapters: list[str] = Field(default_factory=list, max_length=60)
    stickers: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("completedChapters", "stickers")
    @classmethod
    def _ids(cls, values: list[str]) -> list[str]:
        if not all(CHAPTER.fullmatch(v) for v in values):
            raise ValueError("ids: lowercase latin letters, digits and dashes")
        return sorted(set(values))


class ClassCreate(BaseModel):
    model_config = {"extra": "forbid"}

    grade: Literal[5, 6]
    letter: str = Field(min_length=1, max_length=1)
    school: str = Field(default="AMC", max_length=8)

    @field_validator("letter")
    @classmethod
    def _letter(cls, value: str) -> str:
        value = value.upper()
        if value not in CLASS_LETTERS and not re.fullmatch(r"[A-Z]", value):
            raise ValueError("letter: one Cyrillic, Kazakh or Latin letter")
        return value

    @field_validator("school")
    @classmethod
    def _school(cls, value: str) -> str:
        value = value.strip().upper() or "AMC"
        if not SCHOOL.fullmatch(value):
            raise ValueError("school: 2-8 latin letters")
        return value


class ClassInfo(BaseModel):
    id: int
    name: str
    grade: int
    code: str
    teacherName: str | None = None
    students: int | None = None


class Item(BaseModel):
    id: int
    type: str
    key: str
    equipped: bool


class Profile(BaseModel):
    coins: int
    stars: int
    completedChapters: list[str]
    stickers: list[str]
    items: list[Item]


class Me(BaseModel):
    id: int
    role: Role
    displayName: str
    login: str | None = None
    email: str | None = None
    schoolClass: ClassInfo | None = None
    profile: Profile | None = None


class AuthResponse(BaseModel):
    token: str
    user: Me


class BossResultInfo(BaseModel):
    stars: int
    misses: int
    coins: int


class BossState(BaseModel):
    comicId: str
    cleared: int
    misses: int
    result: BossResultInfo | None = None


class TopicStats(BaseModel):
    beaten: int
    bestStars: int
    stars: int


class StudentRow(BaseModel):
    id: int
    displayName: str
    login: str
    stars: int
    coins: int
    bossesBeaten: int
    misses: int
    bestCombo: int
    topics: dict[str, TopicStats]


class HeatCell(BaseModel):
    topic: str
    round: int
    skill: str | None
    students: int
    studentsWithMistakes: int
    mistakeRate: float
    invalidAnswers: int
    commonWrong: list[str]


class Recommendation(BaseModel):
    topic: str
    round: int
    skill: str | None
    mistakeRate: float


class Dashboard(BaseModel):
    schoolClass: ClassInfo
    students: list[StudentRow]
    heatmap: list[HeatCell]
    recommendation: Recommendation | None


# ---- helpers ------------------------------------------------------------------------------


async def class_info(session: AsyncSession, school_class: SchoolClass | None, *, for_teacher=False):
    if school_class is None:
        return None
    teacher = await session.get(User, school_class.teacher_id)
    info = ClassInfo(
        id=school_class.id,
        name=school_class.name,
        grade=school_class.grade,
        code=school_class.code,
        teacherName=teacher.display_name if teacher else None,
    )
    if for_teacher:
        info.students = await session.scalar(
            select(func.count()).select_from(User).where(User.class_id == school_class.id)
        )
    return info


async def me(session: AsyncSession, user: User) -> Me:
    result = Me(
        id=user.id,
        role=user.role,
        displayName=user.display_name,
        login=user.login,
        email=user.email,
    )
    if user.role == Role.student:
        school_class = await session.get(SchoolClass, user.class_id) if user.class_id else None
        result.schoolClass = await class_info(session, school_class)
        profile = await session.get(StudentProfile, user.id)
        items = (
            await session.scalars(select(BackpackItem).where(BackpackItem.student_id == user.id))
        ).all()
        season = (profile.season if profile else None) or {}
        result.profile = Profile(
            coins=profile.total_coins if profile else 0,
            stars=profile.stars_collected if profile else 0,
            completedChapters=season.get("completedChapters", []),
            stickers=season.get("stickers", []),
            items=[
                Item(id=i.id, type=i.item_type, key=i.item_key, equipped=i.is_equipped)
                for i in items
            ],
        )
    return result


async def find_class(session: AsyncSession, code: str) -> SchoolClass:
    code = code.strip().upper()
    found = None
    if CLASS_CODE.fullmatch(code):
        found = await session.scalar(select(SchoolClass).where(SchoolClass.code == code))
    if found is None:
        raise HTTPException(404, "class_not_found")
    return found


def issue(request: Request, user: User) -> str:
    settings = request.app.state.settings
    return create_token(user, request.app.state.jwt_secret, timedelta(hours=settings.jwt_hours))


# ---- answer analytics (called from the check endpoint) -------------------------------------


def parse_generated_exercise(exercise_id: str) -> tuple[str, str, int] | None:
    """`equations-<comic>-r2` -> ("equations", "<comic>", 2)."""
    match = GENERATED_EXERCISE.fullmatch(exercise_id)
    if match is None:
        return None
    topic, comic_id, round_number = match.groups()
    return topic, comic_id, int(round_number or 1)


async def record_attempt(
    session: AsyncSession,
    student: User,
    exercise_id: str,
    skill: str | None,
    status: str,
    text: str,
    comic_exercises: list[str],
) -> Reward | None:
    parsed = parse_generated_exercise(exercise_id)
    if parsed is None:
        return None
    topic, comic_id, round_number = parsed
    previous = await session.scalar(
        select(func.count())
        .select_from(AnalyticsLog)
        .where(
            AnalyticsLog.student_id == student.id,
            AnalyticsLog.exercise_id == exercise_id,
            AnalyticsLog.status != "correct",
        )
    )
    session.add(
        AnalyticsLog(
            student_id=student.id,
            comic_id=comic_id,
            exercise_id=exercise_id,
            topic=topic,
            skill=skill,
            round_number=round_number,
            status=status,
            mistake_count=previous + (status != "correct"),
            text_entered=text.strip()[:64],
        )
    )
    await session.flush()
    reward = None
    if status == "correct":
        reward = await award_if_beaten(session, student, comic_id, topic, comic_exercises)
    await session.commit()
    return reward


async def award_if_beaten(
    session: AsyncSession, student: User, comic_id: str, topic: str, comic_exercises: list[str]
) -> Reward | None:
    logs = (
        await session.scalars(
            select(AnalyticsLog).where(
                AnalyticsLog.student_id == student.id, AnalyticsLog.comic_id == comic_id
            )
        )
    ).all()
    solved = {log.exercise_id for log in logs if log.status == "correct"}
    if not comic_exercises or not set(comic_exercises) <= solved:
        return None
    already = await session.scalar(
        select(BossResult).where(
            BossResult.student_id == student.id, BossResult.comic_id == comic_id
        )
    )
    if already is not None:
        return None
    # Misses before each round was first solved.
    misses = 0
    first_correct = {}
    for log in sorted(logs, key=lambda log: log.id):
        if log.status == "correct":
            first_correct.setdefault(log.exercise_id, log.id)
        elif log.exercise_id not in first_correct:
            misses += 1
    stars = stars_for(misses)
    coins = coins_for(stars)
    profile = await session.get(StudentProfile, student.id)
    if profile is None:
        profile = StudentProfile(user_id=student.id, total_coins=0, stars_collected=0, season={})
        session.add(profile)
    try:
        async with session.begin_nested():
            session.add(
                BossResult(
                    student_id=student.id,
                    comic_id=comic_id,
                    topic=topic,
                    stars=stars,
                    misses=misses,
                    coins=coins,
                )
            )
    except IntegrityError:  # a parallel request already awarded this boss
        return None
    profile.total_coins += coins
    profile.stars_collected += stars
    return Reward(coins=coins, stars=stars, misses=misses, totalCoins=profile.total_coins)


# ---- dashboard -----------------------------------------------------------------------------


def best_combo(logs: list[AnalyticsLog]) -> int:
    best = streak = 0
    for log in logs:
        streak = streak + 1 if log.status == "correct" else 0
        best = max(best, streak)
    return best


async def build_dashboard(session: AsyncSession, school_class: SchoolClass) -> Dashboard:
    students = (
        await session.scalars(
            select(User).where(User.class_id == school_class.id, User.role == Role.student)
        )
    ).all()
    ids = [s.id for s in students]
    profiles = {
        p.user_id: p
        for p in (
            await session.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(ids)))
        ).all()
    }
    results = defaultdict(list)
    for r in (
        await session.scalars(select(BossResult).where(BossResult.student_id.in_(ids)))
    ).all():
        results[r.student_id].append(r)
    logs = defaultdict(list)
    for log in (
        await session.scalars(
            select(AnalyticsLog).where(AnalyticsLog.student_id.in_(ids)).order_by(AnalyticsLog.id)
        )
    ).all():
        logs[log.student_id].append(log)

    rows = []
    for student in students:
        topics: dict[str, TopicStats] = {}
        for r in results[student.id]:
            stats = topics.setdefault(r.topic, TopicStats(beaten=0, bestStars=0, stars=0))
            stats.beaten += 1
            stats.stars += r.stars
            stats.bestStars = max(stats.bestStars, r.stars)
        profile = profiles.get(student.id)
        rows.append(
            StudentRow(
                id=student.id,
                displayName=student.display_name,
                login=student.login or "",
                stars=profile.stars_collected if profile else 0,
                coins=profile.total_coins if profile else 0,
                bossesBeaten=len(results[student.id]),
                misses=sum(log.status != "correct" for log in logs[student.id]),
                bestCombo=best_combo(logs[student.id]),
                topics=topics,
            )
        )
    rows.sort(key=lambda row: (-row.stars, row.misses, row.displayName.casefold()))

    cells: dict[tuple[str, int, str | None], dict] = {}
    for student_logs in logs.values():
        for log in student_logs:
            cell = cells.setdefault(
                (log.topic, log.round_number, log.skill),
                {"students": set(), "mistakes": set(), "invalid": 0, "wrong": Counter()},
            )
            cell["students"].add(log.student_id)
            if log.status != "correct":
                cell["mistakes"].add(log.student_id)
                cell["wrong"][log.text_entered] += 1
            if log.status == "invalid":
                cell["invalid"] += 1
    heatmap = [
        HeatCell(
            topic=topic,
            round=round_number,
            skill=skill,
            students=len(cell["students"]),
            studentsWithMistakes=len(cell["mistakes"]),
            mistakeRate=round(len(cell["mistakes"]) / len(cell["students"]), 2),
            invalidAnswers=cell["invalid"],
            commonWrong=[text for text, _ in cell["wrong"].most_common(3) if text],
        )
        for (topic, round_number, skill), cell in sorted(
            cells.items(), key=lambda item: (item[0][0], item[0][1], item[0][2] or "")
        )
    ]
    # Recommend the hardest skill once at least two students tried it and half of them slipped.
    candidates = [c for c in heatmap if c.students >= 2 and c.mistakeRate >= 0.5]
    hardest = max(candidates, key=lambda c: (c.mistakeRate, c.students), default=None)
    return Dashboard(
        schoolClass=await class_info(session, school_class, for_teacher=True),
        students=rows,
        heatmap=heatmap,
        recommendation=Recommendation(
            topic=hardest.topic,
            round=hardest.round,
            skill=hardest.skill,
            mistakeRate=hardest.mistakeRate,
        )
        if hardest
        else None,
    )


async def new_class_code(session: AsyncSession, school: str, grade: int, letter: str) -> str:
    base = f"{school}-{grade}{CLASS_LETTERS.get(letter, letter)}-{datetime.now(UTC).year}"
    code = base
    for suffix in range(2, 100):
        taken = await session.scalar(select(SchoolClass.id).where(SchoolClass.code == code))
        if taken is None:
            return code
        code = f"{base}-{suffix}"
    return f"{base}-{secrets.token_hex(2).upper()}"


# ---- routes --------------------------------------------------------------------------------

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]
Teacher = Annotated[User, Depends(current_teacher)]


@router.post("/auth/students", status_code=201, response_model=AuthResponse)
async def sign_up_student(body: StudentSignup, request: Request, session: Session):
    await enforce_sign_in_limit(request, session, f"signup-{body.login}")
    school_class = await find_class(session, body.classCode) if body.classCode else None
    user = User(
        login=body.login,
        display_name=body.displayName,
        hashed_password=hash_password(body.password),
        role=Role.student,
        class_id=school_class.id if school_class else None,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(409, "login_taken") from None
    session.add(StudentProfile(user_id=user.id, total_coins=0, stars_collected=0, season={}))
    await session.commit()
    return AuthResponse(token=issue(request, user), user=await me(session, user))


@router.post("/auth/teachers", status_code=201, response_model=AuthResponse)
async def sign_up_teacher(body: TeacherSignup, request: Request, session: Session):
    await enforce_sign_in_limit(request, session, f"signup-{body.email}")
    user = User(
        email=body.email,
        display_name=body.displayName,
        hashed_password=hash_password(body.password),
        role=Role.teacher,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        raise HTTPException(409, "email_taken") from None
    return AuthResponse(token=issue(request, user), user=await me(session, user))


class QuickJoin(BaseModel):
    """Join a class from the board's QR code with just a name (no password to remember)."""

    model_config = {"extra": "forbid"}

    classCode: str = Field(min_length=4, max_length=32)
    displayName: str = Field(min_length=1, max_length=60)
    # A random key the phone keeps; it is this account's password, so the same phone can sign
    # in again later. Nobody can take over an account by typing a classmate's name.
    deviceKey: str = Field(min_length=24, max_length=72)

    @field_validator("displayName")
    @classmethod
    def _name(cls, value: str) -> str:
        return clean_name(value)

    @field_validator("classCode")
    @classmethod
    def _code(cls, value: str) -> str:
        return value.strip().upper()


@router.post("/auth/quick-join", status_code=201, response_model=AuthResponse)
async def quick_join(body: QuickJoin, request: Request, session: Session):
    # Shares the sign-in counters: a school network can join a class, not flood it.
    await enforce_sign_in_limit(request, session, f"join\0{body.classCode}\0{body.displayName}")
    school_class = await find_class(session, body.classCode)
    from .roster import unique_login  # roster imports this module

    user = User(
        login=await unique_login(session, body.displayName),
        display_name=body.displayName,
        hashed_password=hash_password(body.deviceKey),
        role=Role.student,
        class_id=school_class.id,
    )
    session.add(user)
    await session.flush()
    session.add(StudentProfile(user_id=user.id, total_coins=0, stars_collected=0, season={}))
    await session.commit()
    return AuthResponse(token=issue(request, user), user=await me(session, user))


@router.post("/auth/login", response_model=AuthResponse)
async def sign_in(body: LoginRequest, request: Request, session: Session):
    name = body.login.strip().lower()
    await enforce_sign_in_limit(request, session, name)
    column = User.email if "@" in name else User.login
    user = await session.scalar(select(User).where(column == name))
    if user is None:
        verify_password(body.password, DUMMY_HASH)
        raise HTTPException(401, "wrong_login_or_password")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "wrong_login_or_password")
    return AuthResponse(token=issue(request, user), user=await me(session, user))


@router.get("/me", response_model=Me, response_model_exclude_none=True)
async def read_me(user: Annotated[User, Depends(current_user)], session: Session):
    return await me(session, user)


@router.post("/me/class", response_model=Me, response_model_exclude_none=True)
async def join_class(body: JoinClass, user: Student, session: Session):
    school_class = await find_class(session, body.code)
    user.class_id = school_class.id
    await session.commit()
    return await me(session, user)


@router.put("/me/progress", response_model=Me, response_model_exclude_none=True)
async def save_progress(body: SeasonUpdate, user: Student, session: Session):
    """Merge the browser's season progress into the saved one (progress only grows).

    The first report of a rewarded chapter or finale pays its coins once: each reward is a
    ``ProgressReward`` row keyed by student and reward, so a replay, a reload or a parallel
    request cannot pay it twice. If two requests race, the second one hits the primary key,
    rolls back and runs again, now seeing the reward as already paid.
    """
    for attempt in range(2):
        try:
            await merge_progress(session, user, body)
            break
        except IntegrityError:
            await session.rollback()
            if attempt:
                raise
    return await me(session, user)


async def merge_progress(session: AsyncSession, user: User, body: SeasonUpdate) -> None:
    profile = await session.scalar(
        select(StudentProfile)
        .where(StudentProfile.user_id == user.id)
        .execution_options(populate_existing=True)
    )
    season = dict(profile.season or {})
    for key, values in (("completedChapters", body.completedChapters), ("stickers", body.stickers)):
        season[key] = sorted(set(season.get(key, [])) | set(values))
    profile.season = season
    wanted = set(body.completedChapters) & PROGRESS_REWARDS.keys()
    paid: set[str] = set()
    if wanted:
        query = select(ProgressReward.reward_key).where(
            ProgressReward.student_id == user.id, ProgressReward.reward_key.in_(wanted)
        )
        paid = set((await session.scalars(query)).all())
    new = sorted(wanted - paid)
    for key in new:
        session.add(ProgressReward(student_id=user.id, reward_key=key, coins=PROGRESS_REWARDS[key]))
    if new:
        await session.flush()  # the primary key rejects a reward another request just paid
        await session.execute(
            update(StudentProfile)
            .where(StudentProfile.user_id == user.id)
            .values(total_coins=StudentProfile.total_coins + sum(PROGRESS_REWARDS[k] for k in new))
        )
    await session.commit()
    await session.refresh(profile)


@router.get("/me/boss/{comic_id}", response_model=BossState, response_model_exclude_none=True)
async def boss_state(comic_id: str, user: Student, session: Session, request: Request):
    assignment = await accessible_assignment(session, comic_id, user)
    exercises = (
        [assignment_exercise(assignment)]
        if assignment is not None
        else request.app.state.store.comic_exercises(comic_id)
    )
    logs = (
        await session.scalars(
            select(AnalyticsLog)
            .where(AnalyticsLog.student_id == user.id, AnalyticsLog.comic_id == comic_id)
            .order_by(AnalyticsLog.id)
        )
    ).all()
    solved = {log.exercise_id for log in logs if log.status == "correct"}
    # Rounds are fought in order: count the solved prefix.
    cleared = 0
    for exercise_id in exercises:
        if exercise_id not in solved:
            break
        cleared += 1
    result = await session.scalar(
        select(BossResult).where(BossResult.student_id == user.id, BossResult.comic_id == comic_id)
    )
    return BossState(
        comicId=comic_id,
        cleared=cleared,
        misses=sum(log.status != "correct" for log in logs),
        result=BossResultInfo(stars=result.stars, misses=result.misses, coins=result.coins)
        if result
        else None,
    )


@router.post("/teacher/classes", status_code=201, response_model=ClassInfo)
async def create_class(body: ClassCreate, user: Teacher, session: Session):
    school_class = SchoolClass(
        teacher_id=user.id,
        name=f"{body.grade} «{body.letter}»",
        grade=body.grade,
        code=await new_class_code(session, body.school, body.grade, body.letter),
    )
    session.add(school_class)
    await session.commit()
    return await class_info(session, school_class, for_teacher=True)


@router.get("/teacher/classes", response_model=list[ClassInfo])
async def list_classes(user: Teacher, session: Session):
    classes = (
        await session.scalars(
            select(SchoolClass).where(SchoolClass.teacher_id == user.id).order_by(SchoolClass.id)
        )
    ).all()
    return [await class_info(session, c, for_teacher=True) for c in classes]


@router.get("/teacher/classes/{class_id}", response_model=Dashboard)
async def class_dashboard(class_id: int, user: Teacher, session: Session):
    school_class = await session.get(SchoolClass, class_id)
    if school_class is None or school_class.teacher_id != user.id:
        raise HTTPException(404, "class_not_found")  # never reveal other teachers' classes
    return await build_dashboard(session, school_class)
