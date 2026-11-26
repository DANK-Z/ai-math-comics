"""Lessons on the board and homework with due dates.

Lesson: the teacher puts a bundled chapter on the projector and turns the panels. On the
exercise panel the class opens answering; every student answers from a phone (one answer each,
changeable until the reveal). The board shows how many answered and, after the reveal, how many
were right and the most common wrong answers. Bundled chapters are checked in the browser, so
the teacher's client sends the chapter's whole-number answer when the lesson starts; students
never see it before the reveal.

After the reveal the class can try once more (the board shows the first try next to the
second), and a mini-quiz of 3–5 exercises of other chapters can follow: points for right and
quick answers, a podium whose stars count in the class league. An optional timer reveals a
question by itself when the time is up or everyone has answered. The class page lists the last
lessons: who was right on each try, so the teacher can set a drill for those who slipped.

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
from sqlalchemy import func, select

from .accounts import PROGRESS_REWARDS
from .answers import parse_equation_answer
from .auth import Session, current_student, current_teacher
from .classroom import own_class, short_name
from .db import (
    ClassLesson,
    Homework,
    LessonAnswer,
    LessonAward,
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
Phase = Literal["reading", "answering", "reveal", "podium", "closed"]
TIMERS = (0, 30, 60, 90)
QUIZ_TIMER = 30  # a quiz question is always timed (the class's timer, or 30 seconds)
QUIZ_POINTS, SPEED_POINTS = 100, 50
PODIUM_STARS = (3, 2, 1)
REPORT_LESSONS = 10


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
    phase: Literal["reading", "answering", "reveal", "closed"] | None = None
    timer: int | None = None
    """Seconds for answering: 0 (no timer), 30, 60 or 90."""
    retry: bool = False
    """After the reveal of the chapter's exercise: the class answers once more."""


class QuizTask(BaseModel):
    model_config = {"extra": "forbid"}

    comicId: str = Field(min_length=1, max_length=64)
    answer: int = Field(ge=0, le=10_000_000)


class QuizStart(BaseModel):
    model_config = {"extra": "forbid"}

    tasks: list[QuizTask] = Field(min_length=3, max_length=5)


class WrongAnswer(BaseModel):
    text: str
    count: int


class ChartBar(BaseModel):
    text: str
    count: int
    correct: bool


class PodiumRow(BaseModel):
    id: int
    name: str
    points: int
    place: int
    stars: int


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
    chart: list[ChartBar] = []
    """Answers by value after the reveal: the right one and the most common slips."""
    present: list[Present] = []
    answeredIds: list[int] = []
    """Who has answered the open question (names only, never the answers)."""
    waiting: list[str] = []
    """Classmates who have not answered yet, while answering is open."""
    answer: int
    attempt: int = 1
    firstAnswered: int | None = None
    firstCorrect: int | None = None
    """The first try, shown next to the second one."""
    step: int = 0
    quiz: list[str] = []
    """The mini-quiz chapters (their exercises are the questions); step k is quiz[k - 1]."""
    timer: int = 0
    secondsLeft: int | None = None
    podium: list[PodiumRow] = []


class StudentLesson(BaseModel):
    id: str
    comicId: str
    panel: int
    phase: Phase
    myAnswer: str | None = None
    correct: bool | None = None
    """Shown after the reveal."""
    attempt: int = 1
    step: int = 0
    stepComicId: str | None = None
    """The chapter whose exercise is asked now (a quiz question)."""
    quizSize: int = 0
    secondsLeft: int | None = None
    points: int = 0
    place: int | None = None
    stars: int = 0


class LessonAnswerIn(BaseModel):
    model_config = {"extra": "forbid"}

    answer: str = Field(min_length=1, max_length=32)


def step_answer(lesson: ClassLesson) -> int:
    if lesson.step and lesson.quiz:
        return int(lesson.quiz[lesson.step - 1]["answer"])
    return lesson.answer


def step_comic(lesson: ClassLesson) -> str:
    if lesson.step and lesson.quiz:
        return lesson.quiz[lesson.step - 1]["comicId"]
    return lesson.comic_id


def seconds_left(lesson: ClassLesson) -> int | None:
    if lesson.phase != "answering" or lesson.deadline is None:
        return None
    return max(0, round((aware(lesson.deadline) - now()).total_seconds()))


def open_answering(lesson: ClassLesson) -> None:
    lesson.phase = "answering"
    lesson.answering_at = now()
    seconds = lesson.timer or (QUIZ_TIMER if lesson.step else 0)
    lesson.deadline = now() + timedelta(seconds=seconds) if seconds else None


async def roster(session, class_id: int) -> list[User]:
    return list(
        (
            await session.scalars(
                select(User)
                .where(User.class_id == class_id, User.role == Role.student)
                .order_by(User.display_name)
            )
        ).all()
    )


async def answers_of(session, lesson: ClassLesson, step: int, attempt: int) -> list[LessonAnswer]:
    return list(
        (
            await session.scalars(
                select(LessonAnswer)
                .where(
                    LessonAnswer.lesson_id == lesson.id,
                    LessonAnswer.step == step,
                    LessonAnswer.attempt == attempt,
                )
                .execution_options(populate_existing=True)
            )
        ).all()
    )


async def settle(session, lesson: ClassLesson) -> None:
    """A timed question reveals itself when the time is up or the whole class has answered."""
    if lesson.phase != "answering" or lesson.deadline is None:
        return
    students = len(await roster(session, lesson.class_id))
    answered = len(await answers_of(session, lesson, lesson.step, lesson.attempt))
    if now() >= aware(lesson.deadline) or (students and answered >= students):
        lesson.phase = "reveal"
        lesson.deadline = None
        await session.commit()


def value_text(text: str) -> str:
    value = parse_equation_answer(text)
    return str(value) if value is not None else text.strip()


def chart_of(answers: list[LessonAnswer], right: int) -> list[ChartBar]:
    counts = Counter(value_text(a.text_entered) for a in answers)
    bars = [ChartBar(text=t, count=n, correct=t == str(right)) for t, n in counts.most_common(5)]
    if str(right) in counts and not any(b.correct for b in bars):
        bars[-1] = ChartBar(text=str(right), count=counts[str(right)], correct=True)
    return sorted(bars, key=lambda b: (not b.correct, -b.count))


async def podium_of(session, lesson: ClassLesson) -> list[PodiumRow]:
    rows = await session.execute(
        select(LessonAward, User.display_name)
        .join(User, User.id == LessonAward.student_id)
        .where(LessonAward.lesson_id == lesson.id)
        .order_by(LessonAward.place)
    )
    return [
        PodiumRow(
            id=a.student_id, name=short_name(name), points=a.points, place=a.place, stars=a.stars
        )
        for a, name in rows
    ]


async def lesson_board(session, lesson: ClassLesson) -> LessonBoard:
    await settle(session, lesson)
    school_class = await session.get(SchoolClass, lesson.class_id)
    students = await roster(session, lesson.class_id)
    answers = await answers_of(session, lesson, lesson.step, lesson.attempt)
    revealed = lesson.phase in ("reveal", "podium", "closed")
    right = step_answer(lesson)
    wrong = Counter(a.text_entered.strip() for a in answers if not a.correct)
    answered = {a.student_id for a in answers}
    first = None
    if lesson.step == 0 and lesson.attempt == 2:
        first = await answers_of(session, lesson, 0, 1)
    return LessonBoard(
        present=await present(session, lesson.id, lesson.class_id),
        id=lesson.id,
        classId=school_class.id,
        className=school_class.name,
        classCode=school_class.code,
        comicId=lesson.comic_id,
        panel=lesson.panel,
        phase=lesson.phase,
        students=len(students),
        answered=len(answers),
        correct=sum(a.correct for a in answers) if revealed else None,
        wrong=[WrongAnswer(text=t, count=n) for t, n in wrong.most_common(3)] if revealed else [],
        chart=chart_of(answers, right) if revealed else [],
        answeredIds=sorted(answered),
        waiting=[short_name(s.display_name) for s in students if s.id not in answered]
        if lesson.phase == "answering"
        else [],
        answer=right,
        attempt=lesson.attempt,
        firstAnswered=len(first) if first is not None else None,
        firstCorrect=sum(a.correct for a in first) if first is not None else None,
        step=lesson.step,
        quiz=[t["comicId"] for t in lesson.quiz or []],
        timer=lesson.timer,
        secondsLeft=seconds_left(lesson),
        podium=await podium_of(session, lesson) if lesson.phase in ("podium", "closed") else [],
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
        attempt=1,
        step=0,
        timer=0,
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
    if body.timer is not None:
        if body.timer not in TIMERS:
            raise HTTPException(422, "invalid_timer")
        lesson.timer = body.timer
        if lesson.phase == "answering" and lesson.step == 0:  # the timer starts now
            lesson.deadline = now() + timedelta(seconds=body.timer) if body.timer else None
    if body.panel is not None:
        lesson.panel = body.panel
    if body.retry:
        if lesson.step != 0 or lesson.attempt != 1 or lesson.phase != "reveal":
            raise HTTPException(409, "no_retry")
        lesson.attempt = 2
        open_answering(lesson)
    elif body.phase is not None and body.phase != lesson.phase:
        if body.phase == "answering":
            open_answering(lesson)
        else:
            lesson.phase = body.phase
            lesson.deadline = None
    await session.commit()
    return await lesson_board(session, lesson)


@router.post("/teacher/lessons/{lesson_id}/quiz", response_model=LessonBoard)
async def start_quiz(lesson_id: str, body: QuizStart, user: Teacher, session: Session):
    """The mini-quiz after the chapter: a few exercises of other chapters, one by one."""
    lesson = await teacher_lesson(session, user, lesson_id)
    if any(t.comicId not in CHAPTERS for t in body.tasks):
        raise HTTPException(422, "unknown_chapter")
    if lesson.quiz or lesson.phase == "closed":
        raise HTTPException(409, "quiz_started")
    lesson.quiz = [t.model_dump() for t in body.tasks]
    lesson.step = 1
    open_answering(lesson)
    await session.commit()
    return await lesson_board(session, lesson)


@router.post("/teacher/lessons/{lesson_id}/quiz/next", response_model=LessonBoard)
async def next_question(lesson_id: str, user: Teacher, session: Session):
    """The next quiz question; after the last one, the podium (its stars go to the league)."""
    lesson = await teacher_lesson(session, user, lesson_id)
    await settle(session, lesson)
    if not lesson.quiz or lesson.phase != "reveal":
        raise HTTPException(409, "not_revealed")
    if lesson.step < len(lesson.quiz):
        lesson.step += 1
        open_answering(lesson)
    else:
        await award_podium(session, lesson)
        lesson.phase = "podium"
    await session.commit()
    return await lesson_board(session, lesson)


async def award_podium(session, lesson: ClassLesson) -> None:
    totals: Counter[int] = Counter()
    rows = await session.scalars(
        select(LessonAnswer).where(LessonAnswer.lesson_id == lesson.id, LessonAnswer.step > 0)
    )
    for a in rows:
        totals[a.student_id] += a.points
    names = {s.id: s.display_name for s in await roster(session, lesson.class_id)}
    ranked = sorted(
        (i for i in totals if totals[i] > 0 and i in names),
        key=lambda i: (-totals[i], names[i].casefold()),
    )
    for place, student_id in enumerate(ranked[: len(PODIUM_STARS)], start=1):
        if await session.get(LessonAward, (lesson.id, student_id)) is None:
            session.add(
                LessonAward(
                    lesson_id=lesson.id,
                    student_id=student_id,
                    place=place,
                    points=totals[student_id],
                    stars=PODIUM_STARS[place - 1],
                    created_at=now(),
                )
            )


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
    mine = await session.get(
        LessonAnswer, (lesson.id, student.id, lesson.step, lesson.attempt), populate_existing=True
    )
    revealed = lesson.phase in ("reveal", "podium", "closed")
    points = 0
    if lesson.quiz:
        points = (
            await session.scalar(
                select(func.coalesce(func.sum(LessonAnswer.points), 0)).where(
                    LessonAnswer.lesson_id == lesson.id,
                    LessonAnswer.student_id == student.id,
                    LessonAnswer.step > 0,
                )
            )
        ) or 0
    award = await session.get(LessonAward, (lesson.id, student.id))
    return StudentLesson(
        id=lesson.id,
        comicId=lesson.comic_id,
        panel=lesson.panel,
        phase=lesson.phase,
        myAnswer=mine.text_entered if mine else None,
        correct=mine.correct if mine and revealed else None,
        attempt=lesson.attempt,
        step=lesson.step,
        stepComicId=step_comic(lesson) if lesson.step else None,
        quizSize=len(lesson.quiz or []),
        secondsLeft=seconds_left(lesson),
        points=int(points) if revealed or lesson.phase == "podium" else 0,
        place=award.place if award else None,
        stars=award.stars if award else 0,
    )


@router.get("/me/lesson", response_model=StudentLesson | None)
async def my_lesson(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    lesson = await current_lesson(session, (await class_of(session, user)).id)
    if lesson is None:
        return None
    await touch(session, lesson.id, user.id)  # the board's lobby
    await session.commit()
    await settle(session, lesson)
    return await student_lesson(session, lesson, user)


@router.post("/me/lesson/{lesson_id}/answer", response_model=StudentLesson)
async def answer_lesson(lesson_id: str, body: LessonAnswerIn, user: Student, session: Session):
    school_class = await class_of(session, user)
    lesson = await session.get(ClassLesson, lesson_id, populate_existing=True)
    if lesson is None or lesson.class_id != school_class.id:
        raise HTTPException(404, "lesson_not_found")
    await settle(session, lesson)
    if lesson.phase != "answering":
        raise HTTPException(409, "not_answering")
    value = parse_equation_answer(body.answer)
    if value is None:
        raise HTTPException(422, "invalid_answer")
    correct = value == step_answer(lesson)
    points = 0
    if lesson.step and correct:
        opened = aware(lesson.answering_at) if lesson.answering_at else now()
        seconds = (now() - opened).total_seconds()
        points = QUIZ_POINTS + max(0, SPEED_POINTS - int(seconds * SPEED_POINTS / QUIZ_TIMER))
    text = body.answer.strip()[:32]
    key = (lesson.id, user.id, lesson.step, lesson.attempt)
    mine = await session.get(LessonAnswer, key)
    if mine is None:
        session.add(
            LessonAnswer(
                lesson_id=lesson.id,
                student_id=user.id,
                step=lesson.step,
                attempt=lesson.attempt,
                text_entered=text,
                correct=correct,
                points=points,
                created_at=now(),
            )
        )
    else:
        mine.text_entered, mine.correct, mine.points = text, correct, points
    await session.commit()
    await settle(session, lesson)
    return await student_lesson(session, lesson, user)


# ---- lesson reports ----------------------------------------------------------------------


class ReportStudent(BaseModel):
    id: int
    name: str
    first: bool | None = None
    """True / False: right or wrong on the first try; None: no answer."""
    second: bool | None = None


class ReportTry(BaseModel):
    answered: int
    correct: int


class LessonReport(BaseModel):
    id: str
    comicId: str
    createdAt: datetime
    first: ReportTry
    second: ReportTry | None = None
    students: list[ReportStudent]
    quiz: list[str] = []
    podium: list[PodiumRow] = []


@router.get("/teacher/classes/{class_id}/lesson-reports", response_model=list[LessonReport])
async def lesson_reports(class_id: int, user: Teacher, session: Session, response: Response):
    """The last lessons of the class: who got the exercise right, on each try."""
    response.headers["Cache-Control"] = "no-store"
    school_class = await own_class(session, user, class_id)
    students = await roster(session, school_class.id)
    lessons = (
        await session.scalars(
            select(ClassLesson)
            .where(ClassLesson.class_id == school_class.id)
            .order_by(ClassLesson.created_at.desc())
            .limit(REPORT_LESSONS)
        )
    ).all()
    result = []
    for lesson in lessons:
        tries = {1: {}, 2: {}}
        for a in await session.scalars(
            select(LessonAnswer).where(LessonAnswer.lesson_id == lesson.id, LessonAnswer.step == 0)
        ):
            tries.setdefault(a.attempt, {})[a.student_id] = a.correct
        if not tries[1] and not lesson.quiz:
            continue  # opened and closed without answers

        def summary(answers: dict[int, bool]) -> ReportTry:
            return ReportTry(answered=len(answers), correct=sum(answers.values()))

        result.append(
            LessonReport(
                id=lesson.id,
                comicId=lesson.comic_id,
                createdAt=lesson.created_at,
                first=summary(tries[1]),
                second=summary(tries[2]) if lesson.attempt == 2 else None,
                students=[
                    ReportStudent(
                        id=s.id,
                        name=short_name(s.display_name),
                        first=tries[1].get(s.id),
                        second=tries[2].get(s.id),
                    )
                    for s in students
                ],
                quiz=[t["comicId"] for t in lesson.quiz or []],
                podium=await podium_of(session, lesson),
            )
        )
    return result


# ---- homework ----------------------------------------------------------------------------


class HomeworkIn(BaseModel):
    model_config = {"extra": "forbid"}

    kind: Literal["chapter", "practice"]
    target: str = Field(min_length=1, max_length=64)
    dueDate: date
    studentIds: list[int] | None = Field(default=None, min_length=1, max_length=60)
    """Only these students (a drill for those who slipped in a lesson)."""


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
    targeted: bool = False
    """Set for some students only."""


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
    student_ids = None
    if body.studentIds is not None:
        mine = {s.id for s in await class_students(session, school_class.id)}
        student_ids = sorted(set(body.studentIds))
        if not set(student_ids) <= mine:
            raise HTTPException(422, "unknown_student")
    item = Homework(
        id=str(uuid.uuid4()),
        class_id=school_class.id,
        kind=body.kind,
        target=body.target,
        due_date=body.dueDate,
        student_ids=student_ids,
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
        group = [s for s in students if item.student_ids is None or s.id in item.student_ids]
        done = await done_students(session, item, group)
        result.append(
            HomeworkOut(
                id=item.id,
                kind=item.kind,
                target=item.target,
                dueDate=item.due_date,
                createdAt=item.created_at,
                overdue=is_overdue(item),
                done=len(done),
                total=len(group),
                students=[
                    HomeworkStudent(id=s.id, name=short_name(s.display_name), done=s.id in done)
                    for s in group
                ],
                targeted=item.student_ids is not None,
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
        if item.student_ids is not None and user.id not in item.student_ids:
            continue
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
