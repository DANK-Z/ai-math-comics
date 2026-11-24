"""Lessons on the board and homework with due dates.

Lesson: the teacher puts a bundled chapter on the projector and turns the panels. On the
exercise panel the class opens answering; every student answers from a phone (one answer each,
changeable until the reveal). The board shows how many answered and, after the reveal, how many
were right and the most common wrong answers. Bundled chapters are checked in the browser, so
the teacher's client sends the chapter's whole-number answer when the lesson starts; students
never see it before the reveal.

Homework: a chapter or a review drill with a due date. A chapter counts once the server has
checked the student's answer; a drill counts once the student finished a five-problem drill on that
topic after the homework was set.
"""

import uuid
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from .accounts import PROGRESS_REWARDS
from .answers import parse_equation_answer
from .auth import Session, current_student, current_teacher
from .classroom import own_class, short_name
from .db import (
    ClassLesson,
    Homework,
    LessonAnswer,
    PracticeTask,
    Role,
    SchoolClass,
    StudentProfile,
    User,
)
from .practice import TOPICS
from .presence import Present, present, touch

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]
Teacher = Annotated[User, Depends(current_teacher)]

LESSON_HOURS = 3
CHAPTERS = frozenset(
    key for key in PROGRESS_REWARDS if not key.endswith("-finale") and not key.startswith("secret-")
)
Phase = Literal["reading", "answering", "reveal", "closed"]


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


# ---- lessons -----------------------------------------------------------------------------


class LessonStart(BaseModel):
    model_config = {"extra": "forbid"}

    comicId: str = Field(min_length=1, max_length=64)
    answer: int = Field(ge=0, le=10_000_000)


class LessonUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    panel: int | None = Field(default=None, ge=0, le=20)
    phase: Phase | None = None


class WrongAnswer(BaseModel):
    text: str
    count: int


class LessonBoard(BaseModel):
    id: str
    classId: int
    className: str
    classCode: str
    comicId: str
    panel: int
    phase: Phase
    students: int
    answered: int
    correct: int | None = None
    """Revealed only after the reveal."""
    wrong: list[WrongAnswer] = []
    present: list[Present] = []
    answer: int


class StudentLesson(BaseModel):
    id: str
    comicId: str
    panel: int
    phase: Phase
    myAnswer: str | None = None
    correct: bool | None = None
    """Shown after the reveal."""


class LessonAnswerIn(BaseModel):
    model_config = {"extra": "forbid"}

    answer: str = Field(min_length=1, max_length=32)


async def lesson_board(session, lesson: ClassLesson) -> LessonBoard:
    school_class = await session.get(SchoolClass, lesson.class_id)
    students = len(
        (
            await session.scalars(
                select(User.id).where(User.class_id == lesson.class_id, User.role == Role.student)
            )
        ).all()
    )
    answers = (
        await session.scalars(select(LessonAnswer).where(LessonAnswer.lesson_id == lesson.id))
    ).all()
    revealed = lesson.phase in ("reveal", "closed")
    wrong = Counter(a.text_entered.strip() for a in answers if not a.correct)
    return LessonBoard(
        present=await present(session, lesson.id, lesson.class_id),
        id=lesson.id,
        classId=school_class.id,
        className=school_class.name,
        classCode=school_class.code,
        comicId=lesson.comic_id,
        panel=lesson.panel,
        phase=lesson.phase,
        students=students,
        answered=len(answers),
        correct=sum(a.correct for a in answers) if revealed else None,
        wrong=[WrongAnswer(text=t, count=n) for t, n in wrong.most_common(3)] if revealed else [],
        answer=lesson.answer,
    )


async def teacher_lesson(session, teacher: User, lesson_id: str) -> ClassLesson:
    lesson = await session.get(ClassLesson, lesson_id, populate_existing=True)
    if lesson is None:
        raise HTTPException(404, "lesson_not_found")
    await own_class(session, teacher, lesson.class_id)
    return lesson


@router.post("/teacher/classes/{class_id}/lessons", status_code=201, response_model=LessonBoard)
async def start_lesson(class_id: int, body: LessonStart, user: Teacher, session: Session):
    if body.comicId not in CHAPTERS:
        raise HTTPException(422, "unknown_chapter")
    school_class = await own_class(session, user, class_id)
    active = (
        await session.scalars(
            select(ClassLesson).where(
                ClassLesson.class_id == school_class.id, ClassLesson.phase != "closed"
            )
        )
    ).all()
    for old in active:  # one lesson at a time per class
        old.phase = "closed"
    lesson = ClassLesson(
        id=str(uuid.uuid4()),
        class_id=school_class.id,
        comic_id=body.comicId,
        answer=body.answer,
        panel=0,
        phase="reading",
        created_at=now(),
    )
    session.add(lesson)
    await session.commit()
    return await lesson_board(session, lesson)


@router.get("/teacher/lessons/{lesson_id}", response_model=LessonBoard)
async def get_lesson(lesson_id: str, user: Teacher, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await lesson_board(session, await teacher_lesson(session, user, lesson_id))


@router.post("/teacher/lessons/{lesson_id}", response_model=LessonBoard)
async def update_lesson(lesson_id: str, body: LessonUpdate, user: Teacher, session: Session):
    lesson = await teacher_lesson(session, user, lesson_id)
    if body.panel is not None:
        lesson.panel = body.panel
    if body.phase is not None:
        lesson.phase = body.phase
    await session.commit()
    return await lesson_board(session, lesson)


async def class_of(session, user: User) -> SchoolClass:
    school_class = await session.get(SchoolClass, user.class_id) if user.class_id else None
    if school_class is None:
        raise HTTPException(404, "no_class")
    return school_class


async def current_lesson(session, class_id: int) -> ClassLesson | None:
    lesson = await session.scalar(
        select(ClassLesson)
        .where(ClassLesson.class_id == class_id, ClassLesson.phase != "closed")
        .order_by(ClassLesson.created_at.desc())
        .limit(1)
        .execution_options(populate_existing=True)
    )
    if lesson is None or now() - aware(lesson.created_at) > timedelta(hours=LESSON_HOURS):
        return None
    return lesson


async def student_lesson(session, lesson: ClassLesson, student: User) -> StudentLesson:
    mine = await session.get(LessonAnswer, (lesson.id, student.id), populate_existing=True)
    revealed = lesson.phase in ("reveal", "closed")
    return StudentLesson(
        id=lesson.id,
        comicId=lesson.comic_id,
        panel=lesson.panel,
        phase=lesson.phase,
        myAnswer=mine.text_entered if mine else None,
        correct=mine.correct if mine and revealed else None,
    )


@router.get("/me/lesson", response_model=StudentLesson | None)
async def my_lesson(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    lesson = await current_lesson(session, (await class_of(session, user)).id)
    if lesson is None:
        return None
    await touch(session, lesson.id, user.id)  # the board's lobby
    await session.commit()
    return await student_lesson(session, lesson, user)


@router.post("/me/lesson/{lesson_id}/answer", response_model=StudentLesson)
async def answer_lesson(lesson_id: str, body: LessonAnswerIn, user: Student, session: Session):
    school_class = await class_of(session, user)
    lesson = await session.get(ClassLesson, lesson_id, populate_existing=True)
    if lesson is None or lesson.class_id != school_class.id:
        raise HTTPException(404, "lesson_not_found")
    if lesson.phase != "answering":
        raise HTTPException(409, "not_answering")
    value = parse_equation_answer(body.answer)
    if value is None:
        raise HTTPException(422, "invalid_answer")
    correct = value == lesson.answer
    mine = await session.get(LessonAnswer, (lesson.id, user.id))
    if mine is None:
        session.add(
            LessonAnswer(
                lesson_id=lesson.id,
                student_id=user.id,
                text_entered=body.answer.strip()[:32],
                correct=correct,
                created_at=now(),
            )
        )
    else:
        mine.text_entered, mine.correct = body.answer.strip()[:32], correct
    await session.commit()
    return await student_lesson(session, lesson, user)


# ---- homework ----------------------------------------------------------------------------


class HomeworkIn(BaseModel):
    model_config = {"extra": "forbid"}

    kind: Literal["chapter", "practice"]
    target: str = Field(min_length=1, max_length=64)
    dueDate: date


class HomeworkStudent(BaseModel):
    id: int
    name: str
    done: bool


class HomeworkOut(BaseModel):
    id: str
    kind: Literal["chapter", "practice"]
    target: str
    dueDate: date
    createdAt: datetime
    overdue: bool
    done: int
    total: int
    students: list[HomeworkStudent] = []


class MyHomework(BaseModel):
    id: str
    kind: Literal["chapter", "practice"]
    target: str
    dueDate: date
    overdue: bool
    done: bool


async def done_students(session, item: Homework, students: list[User]) -> set[int]:
    ids = [s.id for s in students]
    if not ids:
        return set()
    if item.kind == "chapter":
        profiles = (
            await session.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(ids)))
        ).all()
        return {
            p.user_id
            for p in profiles
            if item.target in (p.season or {}).get("verifiedChapters", [])
        }
    finished = await session.execute(
        select(PracticeTask.student_id).where(
            PracticeTask.student_id.in_(ids),
            PracticeTask.topic == item.target,
            PracticeTask.number == 5,
            PracticeTask.solved_at.is_not(None),
            PracticeTask.created_at >= item.created_at,
        )
    )
    return {row[0] for row in finished}


def is_overdue(item: Homework) -> bool:
    almaty_today = (now() + timedelta(hours=5)).date()
    return almaty_today > item.due_date


async def class_students(session, class_id: int) -> list[User]:
    return list(
        (
            await session.scalars(
                select(User)
                .where(User.class_id == class_id, User.role == Role.student)
                .order_by(User.display_name)
            )
        ).all()
    )


@router.post("/teacher/classes/{class_id}/homework", status_code=201, response_model=HomeworkOut)
async def set_homework(class_id: int, body: HomeworkIn, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    if body.kind == "chapter" and body.target not in CHAPTERS:
        raise HTTPException(422, "unknown_chapter")
    if body.kind == "practice" and body.target not in TOPICS:
        raise HTTPException(422, "unknown_topic")
    item = Homework(
        id=str(uuid.uuid4()),
        class_id=school_class.id,
        kind=body.kind,
        target=body.target,
        due_date=body.dueDate,
        created_at=now(),
    )
    session.add(item)
    await session.commit()
    return (await class_homework(class_id, user, session))[0]


@router.get("/teacher/classes/{class_id}/homework", response_model=list[HomeworkOut])
async def class_homework(class_id: int, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    students = await class_students(session, school_class.id)
    items = (
        await session.scalars(
            select(Homework)
            .where(Homework.class_id == school_class.id)
            .order_by(Homework.created_at.desc())
        )
    ).all()
    result = []
    for item in items:
        done = await done_students(session, item, students)
        result.append(
            HomeworkOut(
                id=item.id,
                kind=item.kind,
                target=item.target,
                dueDate=item.due_date,
                createdAt=item.created_at,
                overdue=is_overdue(item),
                done=len(done),
                total=len(students),
                students=[
                    HomeworkStudent(id=s.id, name=short_name(s.display_name), done=s.id in done)
                    for s in students
                ],
            )
        )
    return result


@router.delete("/teacher/homework/{homework_id}", status_code=204)
async def delete_homework(homework_id: str, user: Teacher, session: Session):
    item = await session.get(Homework, homework_id)
    if item is None:
        raise HTTPException(404, "homework_not_found")
    await own_class(session, user, item.class_id)
    await session.delete(item)
    await session.commit()
    return Response(status_code=204)


@router.get("/me/homework", response_model=list[MyHomework])
async def my_homework(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    school_class = await class_of(session, user)
    items = (
        await session.scalars(
            select(Homework)
            .where(Homework.class_id == school_class.id)
            .order_by(Homework.due_date, Homework.created_at)
        )
    ).all()
    result = []
    for item in items:
        done = user.id in await done_students(session, item, [user])
        # Old finished homework drops off the list after a week.
        if done and (now() + timedelta(hours=5)).date() > item.due_date + timedelta(days=7):
            continue
        result.append(
            MyHomework(
                id=item.id,
                kind=item.kind,
                target=item.target,
                dueDate=item.due_date,
                overdue=is_overdue(item) and not done,
                done=done,
            )
        )
    return result
