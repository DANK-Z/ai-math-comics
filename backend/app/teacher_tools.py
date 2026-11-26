"""Teacher tools: curriculum objective codes, printable drills and the teacher's own comic tasks.

Objective codes: the teacher writes the codes of the official curriculum's learning objectives
next to a chapter once («5.1.2.1; 5.1.2.3»); they show in the lesson launcher and on printouts.
The app does not guess them: the teacher's lesson plan is the source.

Printable drill: N problems of a practice topic with an answer key, for a class without phones.

Teacher's own task: the teacher writes a problem (in Russian and Kazakh), picks a hero and a
backdrop from a bundled chapter; students see it as a comic panel in «Мой класс» and answer it,
the server checks the answer and the teacher sees who solved it.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from .answers import parse_equation_answer
from .auth import Session, current_student, current_teacher
from .classroom import own_class, short_name
from .db import ObjectiveCodes, Role, SchoolClass, TeacherTask, TeacherTaskAnswer, User
from .lessons import CHAPTERS
from .practice import TOPICS, make_problem

router = APIRouter(prefix="/api")
Teacher = Annotated[User, Depends(current_teacher)]
Student = Annotated[User, Depends(current_student)]
Hero = Literal["aldiyar", "aruna", "pifik", "timur", "dana"]
MAX_PRINT = 20


def now() -> datetime:
    return datetime.now(UTC)


# ---- objective codes -----------------------------------------------------------------------


class CodesIn(BaseModel):
    model_config = {"extra": "forbid"}

    codes: str = Field(max_length=80)


@router.get("/teacher/objective-codes", response_model=dict[str, str])
async def objective_codes(user: Teacher, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    rows = await session.scalars(select(ObjectiveCodes).where(ObjectiveCodes.teacher_id == user.id))
    return {r.comic_id: r.codes for r in rows}


@router.put("/teacher/objective-codes/{comic_id}", response_model=dict[str, str])
async def set_objective_codes(
    comic_id: str, body: CodesIn, user: Teacher, session: Session, response: Response
):
    if comic_id not in CHAPTERS:
        raise HTTPException(404, "unknown_chapter")
    codes = " ".join(body.codes.split())
    row = await session.get(ObjectiveCodes, (user.id, comic_id))
    if not codes:
        if row is not None:
            await session.delete(row)
    elif row is None:
        session.add(ObjectiveCodes(teacher_id=user.id, comic_id=comic_id, codes=codes))
    else:
        row.codes = codes
    await session.commit()
    return await objective_codes(user, session, response)


# ---- printable drill -----------------------------------------------------------------------


class PrintProblem(BaseModel):
    prompt: str
    answer: str


@router.get("/teacher/print/drill", response_model=list[PrintProblem])
async def print_drill(
    user: Teacher,
    topic: Annotated[str, Query()],
    count: Annotated[int, Query(ge=1, le=MAX_PRINT)] = 10,
    grade: Annotated[int, Query(ge=5, le=6)] = 5,
    lang: Annotated[Literal["ru", "kk"], Query()] = "ru",
):
    if topic not in TOPICS:
        raise HTTPException(422, "unknown_topic")
    # Avoid repeats on one sheet; a small topic may still repeat after enough tries.
    problems, seen = [], set()
    for _ in range(count * 10):
        problem = make_problem(topic, grade)
        if problem.prompt(lang) in seen:
            continue
        seen.add(problem.prompt(lang))
        problems.append(problem)
        if len(problems) == count:
            break
    while len(problems) < count:
        problems.append(make_problem(topic, grade))
    return [PrintProblem(prompt=p.prompt(lang), answer=answer_text(p.expected)) for p in problems]


def answer_text(value) -> str:
    """12, 3/4 or 4,2 — the way a student writes it."""
    if value.denominator == 1:
        return str(value.numerator)
    if 10 % value.denominator == 0 or 100 % value.denominator == 0:
        return f"{float(value):g}".replace(".", ",")
    return f"{value.numerator}/{value.denominator}"


# ---- the teacher's own tasks ---------------------------------------------------------------


class TaskIn(BaseModel):
    model_config = {"extra": "forbid"}

    hero: Hero
    scene: str = Field(min_length=1, max_length=64)
    textRu: str = Field(min_length=3, max_length=300)
    textKk: str = Field(default="", max_length=300)
    answer: str = Field(min_length=1, max_length=20)
    hintRu: str | None = Field(default=None, max_length=200)
    hintKk: str | None = Field(default=None, max_length=200)


class TaskStudent(BaseModel):
    id: int
    name: str
    solved: bool
    tries: int


class TaskOut(BaseModel):
    id: str
    hero: Hero
    scene: str
    textRu: str
    textKk: str
    hintRu: str | None = None
    hintKk: str | None = None
    answer: str | None = None
    """Only for the teacher."""
    createdAt: datetime
    solved: int = 0
    total: int = 0
    students: list[TaskStudent] = []
    mySolved: bool | None = None
    myTries: int | None = None


def task_base(task: TeacherTask, *, teacher: bool) -> dict:
    return {
        "id": task.id,
        "hero": task.hero,
        "scene": task.scene,
        "textRu": task.text_ru,
        "textKk": task.text_kk or task.text_ru,
        "hintRu": task.hint_ru,
        "hintKk": task.hint_kk or task.hint_ru,
        "answer": task.answer if teacher else None,
        "createdAt": task.created_at,
    }


async def class_tasks_report(session, school_class: SchoolClass) -> list[TaskOut]:
    students = (
        await session.scalars(
            select(User)
            .where(User.class_id == school_class.id, User.role == Role.student)
            .order_by(User.display_name)
        )
    ).all()
    tasks = (
        await session.scalars(
            select(TeacherTask)
            .where(TeacherTask.class_id == school_class.id)
            .order_by(TeacherTask.created_at.desc())
        )
    ).all()
    result = []
    for task in tasks:
        answers = {
            a.student_id: a
            for a in await session.scalars(
                select(TeacherTaskAnswer).where(TeacherTaskAnswer.task_id == task.id)
            )
        }
        rows = [
            TaskStudent(
                id=s.id,
                name=short_name(s.display_name),
                solved=bool(answers.get(s.id) and answers[s.id].solved_at),
                tries=answers[s.id].tries if s.id in answers else 0,
            )
            for s in students
        ]
        result.append(
            TaskOut(
                **task_base(task, teacher=True),
                solved=sum(r.solved for r in rows),
                total=len(rows),
                students=rows,
            )
        )
    return result


@router.post("/teacher/classes/{class_id}/tasks", status_code=201, response_model=TaskOut)
async def create_teacher_task(class_id: int, body: TaskIn, user: Teacher, session: Session):
    school_class = await own_class(session, user, class_id)
    if body.scene not in CHAPTERS:
        raise HTTPException(422, "unknown_scene")
    if parse_equation_answer(body.answer) is None:
        raise HTTPException(422, "invalid_answer")
    task = TeacherTask(
        id=str(uuid.uuid4()),
        class_id=school_class.id,
        hero=body.hero,
        scene=body.scene,
        text_ru=body.textRu.strip(),
        text_kk=body.textKk.strip(),
        answer=body.answer.strip(),
        hint_ru=(body.hintRu or "").strip() or None,
        hint_kk=(body.hintKk or "").strip() or None,
        created_at=now(),
    )
    session.add(task)
    await session.commit()
    return next(t for t in await class_tasks_report(session, school_class) if t.id == task.id)


@router.get("/teacher/classes/{class_id}/tasks", response_model=list[TaskOut])
async def teacher_tasks(class_id: int, user: Teacher, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await class_tasks_report(session, await own_class(session, user, class_id))


@router.delete("/teacher/tasks/{task_id}", status_code=204)
async def delete_teacher_task(task_id: str, user: Teacher, session: Session):
    task = await session.get(TeacherTask, task_id)
    if task is None:
        raise HTTPException(404, "task_not_found")
    await own_class(session, user, task.class_id)
    await session.delete(task)
    await session.commit()
    return Response(status_code=204)


@router.get("/me/tasks", response_model=list[TaskOut])
async def my_tasks(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    if not user.class_id:
        return []
    tasks = (
        await session.scalars(
            select(TeacherTask)
            .where(TeacherTask.class_id == user.class_id)
            .order_by(TeacherTask.created_at.desc())
            .limit(10)
        )
    ).all()
    result = []
    for task in tasks:
        mine = await session.get(TeacherTaskAnswer, (task.id, user.id))
        result.append(
            TaskOut(
                **task_base(task, teacher=False),
                mySolved=bool(mine and mine.solved_at),
                myTries=mine.tries if mine else 0,
            )
        )
    return result


class TaskAnswerIn(BaseModel):
    model_config = {"extra": "forbid"}

    answer: str = Field(min_length=1, max_length=32)


class TaskAnswerOut(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    tries: int


@router.post("/me/tasks/{task_id}/answer", response_model=TaskAnswerOut)
async def answer_teacher_task(task_id: str, body: TaskAnswerIn, user: Student, session: Session):
    task = await session.get(TeacherTask, task_id)
    if task is None or task.class_id != user.class_id:
        raise HTTPException(404, "task_not_found")
    value = parse_equation_answer(body.answer)
    if value is None:
        return TaskAnswerOut(status="invalid", tries=0)
    mine = await session.get(TeacherTaskAnswer, (task.id, user.id))
    if mine is None:
        mine = TeacherTaskAnswer(task_id=task.id, student_id=user.id, tries=0)
        session.add(mine)
    if mine.solved_at is not None:
        return TaskAnswerOut(status="correct", tries=mine.tries)
    mine.tries += 1
    right = value == parse_equation_answer(task.answer)
    if right:
        mine.solved_at = now()
    await session.commit()
    return TaskAnswerOut(status="correct" if right else "incorrect", tries=mine.tries)
