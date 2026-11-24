"""Server checks for the chapters bundled with the frontend.

The browser checks a bundled chapter instantly (and gives the chapter's targeted hints); in live
mode it also sends the answer here. A correct answer from a signed-in student is recorded as a
verified chapter, which is what pays the chapter's coins, opens its secret's and finale's coins
and marks homework done. Guests get the status only.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .accounts import CHAPTER_ANSWERS, verify_chapter
from .answers import parse_equation_answer
from .auth import Session, lenient_user
from .db import Role, User

router = APIRouter(prefix="/api")
Viewer = Annotated[User | None, Depends(lenient_user)]


class ChapterAnswer(BaseModel):
    model_config = {"extra": "forbid"}

    answer: str = Field(min_length=1, max_length=64)


class ChapterCheck(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    verified: bool


def expected(exercise_id: str):
    entry = CHAPTER_ANSWERS.get(exercise_id)
    if entry is None:
        raise HTTPException(404, "exercise_not_found")
    return entry, parse_equation_answer(entry["answer"])


@router.post("/chapters/{exercise_id}/check", response_model=ChapterCheck)
async def check_chapter(exercise_id: str, body: ChapterAnswer, user: Viewer, session: Session):
    entry, answer = expected(exercise_id)
    value = parse_equation_answer(body.answer)
    status = "invalid" if value is None else "correct" if value == answer else "incorrect"
    verified = status == "correct" and user is not None and user.role == Role.student
    if verified:
        await verify_chapter(session, user, entry["comicId"])
    return ChapterCheck(status=status, verified=verified)
