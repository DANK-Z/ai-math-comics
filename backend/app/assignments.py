"""Private teacher drafts and immutable class assignments."""

import hmac
import json
from datetime import date
from fractions import Fraction
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .answers import parse_equation_answer
from .auth import Session, current_student, current_teacher
from .db import AnalyticsLog, AssignedComic, AssignmentHint, Role, SchoolClass, User
from .problems import EquationProblem, choose_problem
from .providers import ProviderError
from .schemas import (
    Boss,
    BossKind,
    BossRound,
    Comic,
    JobAccepted,
    JobRequest,
    JobStatus,
    Language,
    StoryOptions,
)
from .story import validate_narrative
from .worker import configured_providers

Teacher = Annotated[User, Depends(current_teacher)]
Student = Annotated[User, Depends(current_student)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
router = APIRouter(prefix="/api")


class DraftRequest(JobRequest):
    story: StoryOptions


class LocalTask(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: ShortText
    hint1: ShortText
    hint2: ShortText


class Task(BaseModel):
    boss: BossKind
    answer: str = Field(min_length=1, max_length=40)
    ru: LocalTask
    kk: LocalTask


class LocalEdits(BaseModel):
    title: Title
    panels: list[ShortText] = Field(min_length=6, max_length=6)


class Publication(BaseModel):
    classId: int
    dueDate: date | None = None
    task: Task
    ru: LocalEdits
    kk: LocalEdits


class AssignmentInfo(BaseModel):
    id: str
    title: str
    dueDate: date | None
    completed: bool = False


class AssignmentStudent(BaseModel):
    id: int
    name: str
    completed: bool
    hints: list[int]


class AssignmentReport(AssignmentInfo):
    students: list[AssignmentStudent]


class Draft(BaseModel):
    ru: Comic
    kk: Comic
    task: Task


class DraftJob(JobStatus):
    publicationStatus: Literal["draft", "published"] = "draft"
    title: str | None = None


class GeneratedTask(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    choice: Literal[0, 1, 2]
    ruHint1: ShortText
    ruHint2: ShortText
    kkHint1: ShortText
    kkHint2: ShortText


def task_for(problem) -> Task:
    local = {}
    for lang in ("ru", "kk"):
        hint1, hint2 = problem.hints(lang)
        local[lang] = LocalTask(prompt=problem.prompt(lang), hint1=hint1, hint2=hint2)
    return Task(
        boss="x-master" if problem.topic == "equations" else "fraction-slime",
        answer=str(problem.expected),
        **local,
    )


def required_draft(request: Request, comic_id: str, teacher: User) -> dict:
    store = request.app.state.store
    if store.draft_author(comic_id=comic_id) != teacher.id:
        raise HTTPException(404, "draft_not_found")
    payload = store.comic(comic_id)
    if payload is None:
        raise HTTPException(404, "draft_not_found")
    return payload


async def accessible_assignment(session: Session, assignment_id: str, user: User | None):
    if len(assignment_id) != 36:
        return None
    assignment = await session.get(AssignedComic, assignment_id)
    if assignment is None:
        return None
    if user is not None:
        if user.role == Role.student and user.class_id == assignment.class_id:
            return assignment
        if user.role == Role.teacher:
            school_class = await session.get(SchoolClass, assignment.class_id)
            if school_class is not None and school_class.teacher_id == user.id:
                return assignment
    raise HTTPException(404, "comic_not_found")


def assignment_exercise(assignment: AssignedComic) -> str:
    return assignment.content["ru"]["exercise"]["id"]


async def assignment_for_exercise(session: Session, exercise_id: str, user: User | None):
    assignment = await accessible_assignment(session, exercise_id.partition("-")[2], user)
    return (
        assignment
        if assignment is not None and assignment_exercise(assignment) == exercise_id
        else None
    )


def summary(assignment: AssignedComic, lang: Language, *, completed=False) -> AssignmentInfo:
    return AssignmentInfo(
        id=assignment.id,
        title=assignment.content[lang]["title"],
        dueDate=assignment.due_date,
        completed=completed,
    )


def art_token(request: Request, comic_id: str) -> str:
    return hmac.digest(
        request.app.state.jwt_secret.encode(),
        f"teacher-art:{comic_id}".encode(),
        "sha256",
    ).hex()


def absolute_art(request: Request, comic: Comic, private_source: str | None = None) -> Comic:
    base = request.app.state.settings.public_base_url.rstrip("/")
    for panel in comic.panels:
        url = panel.imageUrl
        if url:
            panel.imageUrl = f"{base}{url}"
            if private_source and url.startswith(f"/api/comic-images/{private_source}/"):
                panel.imageUrl += f"?art={art_token(request, private_source)}"
    return comic


@router.post("/teacher/comic-drafts", status_code=202)
def create_draft(body: DraftRequest, request: Request, teacher: Teacher) -> JobAccepted:
    job_id = request.app.state.store.enqueue(body, teacher.id, teacher_draft=True)
    return JobAccepted(jobId=job_id)


@router.get("/teacher/comic-drafts", response_model_exclude_unset=True)
async def list_drafts(
    request: Request,
    teacher: Teacher,
    session: Session,
    lang: Language = "ru",
) -> list[DraftJob]:
    store = request.app.state.store
    jobs = [store.job(job_id) for job_id in store.draft_ids(teacher.id)]
    published = {
        row.comic_id: row.content[lang]["title"]
        for row in (
            await session.scalars(
                select(AssignedComic).where(
                    AssignedComic.comic_id.in_([job.comicId for job in jobs if job.comicId]),
                )
            )
        ).all()
    }
    return [
        DraftJob(
            **job.model_dump(exclude_unset=True),
            publicationStatus="published" if job.comicId in published else "draft",
            title=published.get(job.comicId)
            or (store.comic(job.comicId)[lang]["title"] if job.comicId else None),
        )
        for job in jobs
    ]


@router.get("/teacher/comic-drafts/{comic_id}")
def read_draft(comic_id: str, request: Request, teacher: Teacher) -> Draft:
    payload = required_draft(request, comic_id, teacher)
    source = request.app.state.store.draft_exercise(comic_id)
    comics = {lang: Comic.model_validate(payload[lang]) for lang in ("ru", "kk")}
    task = Task(
        boss=comics["ru"].boss.kind,
        answer=source["expected"],
        **{
            lang: LocalTask(prompt=comic.exercise.prompt, hint1=hints[0], hint2=hints[1])
            for lang, comic in comics.items()
            for hints in [source["hints"][lang]]
        },
    )
    return Draft(
        task=task,
        **{lang: absolute_art(request, comic, comic_id) for lang, comic in comics.items()},
    )


@router.get("/teacher/problem-bank")
def problem_bank(_: Teacher) -> list[Task]:
    return [
        task_for(EquationProblem("mul_add", 2, 5, 15)),
        task_for(EquationProblem("mul_sub", 3, 4, 20)),
    ]


@router.post("/teacher/comic-task")
async def create_task(body: JobRequest, request: Request, _: Teacher) -> Task:
    tasks = [task_for(choose_problem(body)) for _ in range(3)]
    prompt = json.dumps(
        {
            "instruction": "Choose one classroom problem suitable for this grade. Return its "
            "zero-based index as choice. Write two short hints for it in Russian and Kazakh. "
            "Hint 1 recalls the rule. Hint 2 points to the next step. Never state the solution. "
            "Use no digits, symbols, number words, or computed values in the four hint strings.",
            "grade": body.grade,
            "candidates": [{"ru": task.ru.prompt, "kk": task.kk.prompt} for task in tasks],
        },
        ensure_ascii=False,
    )
    try:
        async with configured_providers(request.app.state.settings) as (text, _image):
            generated = GeneratedTask.model_validate(
                await text.generate(prompt, GeneratedTask.model_json_schema())
            )
        task = tasks[generated.choice]
        for lang in ("ru", "kk"):
            for step in (1, 2):
                line = getattr(generated, f"{lang}Hint{step}")
                validate_narrative(line, f"{lang}.hint{step}")
                setattr(getattr(task, lang), f"hint{step}", line)
    except ProviderError as exc:
        raise HTTPException(502, exc.code) from None
    except (ValidationError, ValueError):
        raise HTTPException(502, "invalid_provider_output") from None
    return task


@router.post("/teacher/comic-drafts/{comic_id}/publish", status_code=201)
async def publish(
    comic_id: str, body: Publication, request: Request, teacher: Teacher, session: Session
) -> AssignmentInfo:
    school_class = await session.get(SchoolClass, body.classId)
    if school_class is None or school_class.teacher_id != teacher.id:
        raise HTTPException(404, "class_not_found")
    source = required_draft(request, comic_id, teacher)
    expected = parse_equation_answer(body.task.answer)
    if expected is None:
        raise HTTPException(422, "invalid_teacher_answer")
    if body.task.boss == "x-master" and expected.denominator != 1:
        raise HTTPException(422, "invalid_teacher_answer")
    published = select(AssignedComic).where(AssignedComic.comic_id == comic_id)
    existing = await session.scalar(published)
    if existing is not None:
        if existing.class_id != body.classId:
            raise HTTPException(409, "draft_already_published")
        return summary(existing, "ru")
    assignment_id = str(uuid4())
    topic = "equations" if body.task.boss == "x-master" else "fractions"
    exercise_id = f"{topic}-{assignment_id}"
    content = {"expected": str(expected), "hints": {}}
    for lang in ("ru", "kk"):
        comic = Comic.model_validate(source[lang])
        edits, task = getattr(body, lang), getattr(body.task, lang)
        comic.id = assignment_id
        comic.title = edits.title
        comic.exercise.id = exercise_id
        comic.exercise.prompt = task.prompt
        comic.exercise.answerFormat = "whole-number" if topic == "equations" else None
        comic.boss = Boss(
            kind=body.task.boss,
            rounds=[
                BossRound(
                    exerciseId=exercise_id,
                    prompt=task.prompt,
                    answerFormat=comic.exercise.answerFormat,
                )
            ],
        )
        for panel, line in zip(comic.panels, edits.panels, strict=True):
            panel.text = line
        content[lang] = comic.model_dump()
        content["hints"][lang] = [task.hint1, task.hint2]
    row = AssignedComic(
        id=assignment_id,
        class_id=body.classId,
        comic_id=comic_id,
        due_date=body.dueDate,
        content=content,
    )
    session.add(row)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        row = await session.scalar(published)
        if row is None:
            raise
        if row.class_id != body.classId:
            raise HTTPException(409, "draft_already_published") from None
    return summary(row, "ru")


@router.get("/me/assigned-comics")
async def student_assignments(
    student: Student, session: Session, lang: Language = "ru"
) -> list[AssignmentInfo]:
    if student.class_id is None:
        return []
    rows = (
        await session.scalars(
            select(AssignedComic)
            .where(
                AssignedComic.class_id == student.class_id,
            )
            .order_by(AssignedComic.created_at.desc(), AssignedComic.id)
        )
    ).all()
    completed = set(
        (
            await session.scalars(
                select(AnalyticsLog.comic_id).where(
                    AnalyticsLog.student_id == student.id,
                    AnalyticsLog.status == "correct",
                    AnalyticsLog.comic_id.in_([row.id for row in rows]),
                )
            )
        ).all()
    )
    return [summary(row, lang, completed=row.id in completed) for row in rows]


@router.get("/teacher/classes/{class_id}/assigned-comics")
async def reports(
    class_id: int, teacher: Teacher, session: Session, lang: Language = "ru"
) -> list[AssignmentReport]:
    school_class = await session.get(SchoolClass, class_id)
    if school_class is None or school_class.teacher_id != teacher.id:
        raise HTTPException(404, "class_not_found")
    rows = (
        await session.scalars(
            select(AssignedComic)
            .where(
                AssignedComic.class_id == class_id,
            )
            .order_by(AssignedComic.created_at.desc(), AssignedComic.id)
        )
    ).all()
    students = (
        await session.scalars(
            select(User)
            .where(
                User.class_id == class_id,
                User.role == Role.student,
            )
            .order_by(User.display_name, User.id)
        )
    ).all()
    ids = [row.id for row in rows]
    student_ids = [student.id for student in students]
    wins = {}
    for log in (
        await session.scalars(
            select(AnalyticsLog)
            .where(
                AnalyticsLog.comic_id.in_(ids),
                AnalyticsLog.student_id.in_(student_ids),
                AnalyticsLog.status == "correct",
            )
            .order_by(AnalyticsLog.id)
        )
    ).all():
        wins.setdefault((log.comic_id, log.student_id), log.created_at)
    hints = {}
    for hint in (
        await session.scalars(
            select(AssignmentHint)
            .where(
                AssignmentHint.assignment_id.in_(ids),
                AssignmentHint.student_id.in_(student_ids),
            )
            .order_by(AssignmentHint.step)
        )
    ).all():
        key = (hint.assignment_id, hint.student_id)
        if key not in wins or hint.opened_at <= wins[key]:
            hints.setdefault(key, []).append(hint.step)
    return [
        AssignmentReport(
            **summary(row, lang).model_dump(),
            students=[
                AssignmentStudent(
                    id=student.id,
                    name=student.display_name,
                    completed=(row.id, student.id) in wins,
                    hints=hints.get((row.id, student.id), []),
                )
                for student in students
            ],
        )
        for row in rows
    ]


async def record_assignment_hint(
    session: Session, assignment: AssignedComic, user: User, step: int
):
    key = (assignment.id, user.id, step)
    if await session.get(AssignmentHint, key) is None:
        session.add(AssignmentHint(assignment_id=assignment.id, student_id=user.id, step=step))
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()


def assignment_answer(assignment: AssignedComic) -> Fraction:
    return Fraction(assignment.content["expected"])
