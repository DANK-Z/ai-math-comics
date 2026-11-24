"""The lobby on a class board: students seen on a battle or lesson in the last few minutes."""

from datetime import UTC, datetime, timedelta

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .db import BoardPresence, User

PRESENT_FOR = timedelta(minutes=5)


class Present(BaseModel):
    id: int
    name: str


def short_name(display_name: str) -> str:
    parts = display_name.split()
    if not parts:
        return "?"
    return f"{parts[0]} {parts[1][0]}." if len(parts) > 1 else parts[0]


async def touch(session, board_id: str, student_id: int) -> None:
    """Marks the student as on the board now (called from the student's polls)."""
    seen = await session.get(BoardPresence, (board_id, student_id))
    if seen is not None:
        seen.seen_at = datetime.now(UTC)
        return
    session.add(BoardPresence(board_id=board_id, student_id=student_id, seen_at=datetime.now(UTC)))
    try:
        await session.flush()
    except IntegrityError:  # two polls at once: the other one recorded it
        await session.rollback()


async def present(session, board_id: str, class_id: int) -> list[Present]:
    """Students of the class seen on this board recently, first arrivals first."""
    rows = await session.execute(
        select(User.id, User.display_name)
        .join(BoardPresence, BoardPresence.student_id == User.id)
        .where(
            BoardPresence.board_id == board_id,
            BoardPresence.seen_at >= datetime.now(UTC) - PRESENT_FOR,
            User.class_id == class_id,
        )
        .order_by(BoardPresence.seen_at)
    )
    return [Present(id=i, name=short_name(n)) for i, n in rows]
