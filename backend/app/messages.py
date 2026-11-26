"""Messages between a teacher and a child's parents, about one student.

The teacher writes from the student's card (a template like «пропустил две домашки» or own
words), optionally with a link («Посмотреть» opens the homework); every parent linked to the
child gets it. A parent answers in the same thread. Each side sees its threads, newest first,
with unread counts. Only a teacher of the child's class and the child's linked parents talk.
"""

from collections import defaultdict
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from .auth import Session, current_teacher
from .classroom import own_class, short_name
from .db import FamilyLink, Message, Role, SchoolClass, User
from .family import Parent

router = APIRouter(prefix="/api")
Teacher = Annotated[User, Depends(current_teacher)]
THREAD_MESSAGES = 30


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


class MessageIn(BaseModel):
    model_config = {"extra": "forbid"}

    text: str = Field(min_length=1, max_length=500)
    link: str | None = Field(default=None, max_length=80, pattern=r"^#/[\w\-/?=&]*$")


class MessageOut(BaseModel):
    id: int
    sender: Literal["teacher", "parent"]
    text: str
    link: str | None = None
    at: datetime
    read: bool


class Thread(BaseModel):
    teacherId: int
    teacherName: str
    parentId: int
    parentName: str
    studentId: int
    studentName: str
    unread: int
    messages: list[MessageOut]


async def thread_list(session, where) -> list[Thread]:
    rows = (
        await session.scalars(select(Message).where(where).order_by(Message.created_at.desc()))
    ).all()
    groups: defaultdict[tuple[int, int, int], list[Message]] = defaultdict(list)
    for m in rows:
        groups[(m.teacher_id, m.parent_id, m.student_id)].append(m)
    ids = {i for key in groups for i in key}
    names = (
        {u.id: u.display_name for u in await session.scalars(select(User).where(User.id.in_(ids)))}
        if ids
        else {}
    )
    return [
        Thread(
            teacherId=t,
            teacherName=names.get(t, ""),
            parentId=p,
            parentName=names.get(p, ""),
            studentId=s,
            studentName=short_name(names.get(s, "")),
            unread=0,
            messages=[
                MessageOut(
                    id=m.id,
                    sender=m.sender,
                    text=m.text,
                    link=m.link,
                    at=aware(m.created_at),
                    read=m.read_at is not None,
                )
                for m in reversed(items[:THREAD_MESSAGES])
            ],
        )
        for (t, p, s), items in groups.items()
    ]


def unread_for(thread: Thread, me: Literal["teacher", "parent"]) -> Thread:
    thread.unread = sum(1 for m in thread.messages if m.sender != me and not m.read)
    return thread


@router.post("/teacher/students/{student_id}/messages", response_model=list[Thread])
async def teacher_writes(student_id: int, body: MessageIn, user: Teacher, session: Session):
    student = await session.get(User, student_id)
    if student is None or student.role != Role.student or not student.class_id:
        raise HTTPException(404, "student_not_found")
    await own_class(session, user, student.class_id)
    parents = (
        await session.scalars(
            select(FamilyLink.parent_id).where(FamilyLink.student_id == student_id)
        )
    ).all()
    if not parents:
        raise HTTPException(409, "no_parents")
    for parent_id in parents:
        session.add(
            Message(
                teacher_id=user.id,
                parent_id=parent_id,
                student_id=student_id,
                sender="teacher",
                text=body.text.strip(),
                link=body.link,
                created_at=now(),
            )
        )
    await session.commit()
    threads = await thread_list(
        session, (Message.teacher_id == user.id) & (Message.student_id == student_id)
    )
    return [unread_for(t, "teacher") for t in threads]


@router.get("/teacher/messages", response_model=list[Thread])
async def teacher_threads(user: Teacher, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    threads = await thread_list(session, Message.teacher_id == user.id)
    return [unread_for(t, "teacher") for t in threads]


@router.get("/teacher/students/{student_id}/parents", response_model=int)
async def parents_count(student_id: int, user: Teacher, session: Session):
    """How many parents follow the student (0: there is nobody to write to)."""
    student = await session.get(User, student_id)
    if student is None or not student.class_id:
        raise HTTPException(404, "student_not_found")
    await own_class(session, user, student.class_id)
    return len(
        (
            await session.scalars(
                select(FamilyLink.parent_id).where(FamilyLink.student_id == student_id)
            )
        ).all()
    )


@router.get("/parent/messages", response_model=list[Thread])
async def parent_threads(user: Parent, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    threads = await thread_list(session, Message.parent_id == user.id)
    return [unread_for(t, "parent") for t in threads]


class ReplyIn(MessageIn):
    teacherId: int
    studentId: int


@router.post("/parent/messages", response_model=list[Thread])
async def parent_replies(body: ReplyIn, user: Parent, session: Session):
    """A parent answers a teacher who wrote about their child (or writes to the class teacher)."""
    link = await session.get(FamilyLink, (user.id, body.studentId))
    student = await session.get(User, body.studentId) if link else None
    school_class = (
        await session.get(SchoolClass, student.class_id) if student and student.class_id else None
    )
    if school_class is None or school_class.teacher_id != body.teacherId:
        raise HTTPException(404, "teacher_not_found")
    session.add(
        Message(
            teacher_id=body.teacherId,
            parent_id=user.id,
            student_id=body.studentId,
            sender="parent",
            text=body.text.strip(),
            created_at=now(),
        )
    )
    await session.commit()
    return await parent_threads(user, session, Response())


class ReadIn(BaseModel):
    model_config = {"extra": "forbid"}

    otherId: int
    studentId: int


@router.post("/teacher/messages/read", status_code=204)
async def teacher_read(body: ReadIn, user: Teacher, session: Session):
    await mark_read(session, user.id, body.otherId, body.studentId, reader="teacher")
    return Response(status_code=204)


@router.post("/parent/messages/read", status_code=204)
async def parent_read(body: ReadIn, user: Parent, session: Session):
    await mark_read(session, body.otherId, user.id, body.studentId, reader="parent")
    return Response(status_code=204)


async def mark_read(session, teacher_id: int, parent_id: int, student_id: int, *, reader: str):
    await session.execute(
        update(Message)
        .where(
            Message.teacher_id == teacher_id,
            Message.parent_id == parent_id,
            Message.student_id == student_id,
            Message.sender != reader,
            Message.read_at.is_(None),
        )
        .values(read_at=now())
    )
    await session.commit()
