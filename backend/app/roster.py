"""Class roster tools for teachers: student accounts made by the teacher, password resets and
the review-drill report.

Fifth-graders often have no e-mail and forget passwords, so the teacher can create accounts for
the class (login from the child's name, an easy random password shown once) and give a new
password to a student of their own class. Only the teacher who owns the class can do this.
"""

import secrets
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from .accounts import clean_name
from .auth import Session, current_teacher, hash_password
from .classroom import own_class
from .db import PracticeTask, Role, StudentProfile, User

router = APIRouter(prefix="/api")
Teacher = Annotated[User, Depends(current_teacher)]

MAX_NEW_STUDENTS = 40
REPORT_DAYS = 30
PRACTICE_LENGTH = 5

_LATIN = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh",
    "щ": "sh", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    "ә": "a", "ғ": "g", "қ": "k", "ң": "n", "ө": "o", "ұ": "u", "ү": "u", "һ": "h", "і": "i",
}  # fmt: skip
_WORDS = ("kit", "sun", "star", "book", "fox", "tree", "sky", "moon", "rain", "leaf", "cat", "owl")


def latin(name: str) -> str:
    return "".join(_LATIN.get(ch, ch) for ch in name.lower() if ch.isalnum() or ch in _LATIN)


def easy_password() -> str:
    """Easy to type for a child, e.g. «fox-4821» (not a secret phrase, just a door key)."""
    return f"{secrets.choice(_WORDS)}-{secrets.randbelow(9000) + 1000}"


async def unique_login(session, display_name: str) -> str:
    base = "".join(ch for ch in latin(display_name.split()[0]) if ch.isascii() and ch.isalnum())
    base = (base or "student")[:14]
    for _ in range(50):
        login = f"{base}{secrets.randbelow(900) + 100}"
        if await session.scalar(select(User.id).where(User.login == login)) is None:
            return login
    raise HTTPException(503, "no_free_login")


class NewStudents(BaseModel):
    model_config = {"extra": "forbid"}

    names: list[str] = Field(min_length=1, max_length=MAX_NEW_STUDENTS)

    @field_validator("names")
    @classmethod
    def _names(cls, values: list[str]) -> list[str]:
        return [clean_name(v) for v in values]


class StudentCredentials(BaseModel):
    id: int
    displayName: str
    login: str
    password: str


async def class_student(session, school_class, student_id: int) -> User:
    student = await session.get(User, student_id)
    if student is None or student.role != Role.student or student.class_id != school_class.id:
        raise HTTPException(404, "student_not_found")
    return student


@router.post(
    "/teacher/classes/{class_id}/students",
    status_code=201,
    response_model=list[StudentCredentials],
)
async def create_students(class_id: int, body: NewStudents, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    created: list[StudentCredentials] = []
    for name in body.names:
        password = easy_password()
        student = User(
            login=await unique_login(session, name),
            display_name=name,
            hashed_password=hash_password(password),
            role=Role.student,
            class_id=school_class.id,
        )
        session.add(student)
        await session.flush()
        session.add(StudentProfile(user_id=student.id, total_coins=0, stars_collected=0, season={}))
        created.append(
            StudentCredentials(
                id=student.id, displayName=name, login=student.login, password=password
            )
        )
    await session.commit()
    return created


@router.post(
    "/teacher/classes/{class_id}/students/{student_id}/password",
    response_model=StudentCredentials,
)
async def reset_password(class_id: int, student_id: int, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    student = await class_student(session, school_class, student_id)
    password = easy_password()
    student.hashed_password = hash_password(password)
    await session.commit()
    return StudentCredentials(
        id=student.id, displayName=student.display_name, login=student.login, password=password
    )


# ---- review-drill report -----------------------------------------------------------------


class PracticeRow(BaseModel):
    id: int
    displayName: str
    drills: int
    finished: int
    solved: int
    topics: dict[str, int]
    lastAt: datetime | None = None


class PracticeReport(BaseModel):
    days: int
    students: list[PracticeRow]


@router.get("/teacher/classes/{class_id}/practice", response_model=PracticeReport)
async def practice_report(class_id: int, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    students = (
        await session.scalars(
            select(User)
            .where(User.class_id == school_class.id, User.role == Role.student)
            .order_by(User.display_name)
        )
    ).all()
    since = datetime.now(UTC) - timedelta(days=REPORT_DAYS)
    rows = (
        await session.execute(
            select(
                PracticeTask.student_id,
                PracticeTask.run_id,
                PracticeTask.topic,
                PracticeTask.number,
                PracticeTask.solved_at,
                PracticeTask.created_at,
            ).where(
                PracticeTask.student_id.in_([s.id for s in students] or [0]),
                PracticeTask.created_at >= since,
            )
        )
    ).all()
    runs: dict[int, set[str]] = defaultdict(set)
    finished: Counter[int] = Counter()
    solved: Counter[int] = Counter()
    topics: dict[int, Counter[str]] = defaultdict(Counter)
    last: dict[int, datetime] = {}
    for student_id, run_id, topic, number, solved_at, created_at in rows:
        runs[student_id].add(run_id)
        moment = solved_at or created_at
        if student_id not in last or moment > last[student_id]:
            last[student_id] = moment
        if solved_at is not None:
            solved[student_id] += 1
            topics[student_id][topic] += 1
            finished[student_id] += number == PRACTICE_LENGTH
    report = [
        PracticeRow(
            id=s.id,
            displayName=s.display_name,
            drills=len(runs[s.id]),
            finished=finished[s.id],
            solved=solved[s.id],
            topics=dict(topics[s.id]),
            lastAt=last.get(s.id),
        )
        for s in students
    ]
    report.sort(key=lambda r: (-r.solved, r.displayName.casefold()))
    return PracticeReport(days=REPORT_DAYS, students=report)
