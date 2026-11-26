"""Seasonal events: a goal for a few weeks and a frame that can be won only then.

Each event runs between two dates (Almaty time) every year; the goal is to solve the daily task
on a number of days within the event. Reaching it lets the student claim the event's frame
(once; not sold in the shop).
"""

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select

from .auth import Session, current_student
from .daily import DAILY_PREFIX, almaty_today
from .db import BackpackItem, PracticeTask, User

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]

# id: (start month, start day, end month, end day, days of daily tasks, frame)
EVENTS: dict[str, tuple[int, int, int, int, int, str]] = {
    "knowledge": (9, 1, 9, 30, 10, "frame-knowledge"),
    "winter": (11, 20, 1, 10, 12, "frame-winter"),
    "nauryz": (3, 10, 3, 31, 10, "frame-nauryz"),
}


class EventOut(BaseModel):
    id: str
    start: date
    end: date
    target: int
    progress: int
    frame: str
    claimed: bool


def window(event_id: str, today: date) -> tuple[date, date] | None:
    sm, sd, em, ed, _, _ = EVENTS[event_id]
    for year in (today.year - 1, today.year):
        start = date(year, sm, sd)
        end = date(year + (1 if (em, ed) < (sm, sd) else 0), em, ed)
        if start <= today <= end:
            return start, end
    return None


def current_event(today: date) -> tuple[str, date, date] | None:
    for event_id in EVENTS:
        span = window(event_id, today)
        if span:
            return event_id, *span
    return None


async def event_out(session, user: User, event_id: str, start: date, end: date) -> EventOut:
    _, _, _, _, target, frame = EVENTS[event_id]
    runs = await session.scalars(
        select(PracticeTask.run_id).where(
            PracticeTask.student_id == user.id,
            PracticeTask.run_id.like(DAILY_PREFIX + "%"),
            PracticeTask.solved_at.is_not(None),
        )
    )
    days = {date.fromisoformat(r.removeprefix(DAILY_PREFIX)) for r in runs}
    owned = await session.scalar(
        select(BackpackItem.id).where(
            BackpackItem.student_id == user.id, BackpackItem.item_key == frame
        )
    )
    return EventOut(
        id=event_id,
        start=start,
        end=end,
        target=target,
        progress=sum(1 for d in days if start <= d <= end),
        frame=frame,
        claimed=owned is not None,
    )


@router.get("/me/event", response_model=EventOut | None)
async def my_event(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    found = current_event(almaty_today())
    return await event_out(session, user, *found) if found else None


@router.post("/me/event/claim", response_model=EventOut)
async def claim(user: Student, session: Session):
    found = current_event(almaty_today())
    if not found:
        raise HTTPException(404, "no_event")
    out = await event_out(session, user, *found)
    if out.claimed:
        raise HTTPException(409, "already_claimed")
    if out.progress < out.target:
        raise HTTPException(409, "not_yet")
    session.add(
        BackpackItem(
            student_id=user.id,
            item_type="frame",
            item_key=out.frame,
            is_equipped=False,
            acquired_at=datetime.now(UTC),
        )
    )
    await session.commit()
    return await event_out(session, user, *found)
