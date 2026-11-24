"""The server's copy of the bundled chapters' answers matches the frontend's chapter files."""

import re
from pathlib import Path

from app.accounts import CHAPTER_ANSWERS, PROGRESS_REWARDS

FRONTEND_API = Path(__file__).resolve().parents[2] / "frontend" / "src" / "api"


def definition(sources: dict[str, str], exercise_id: str) -> str | None:
    """The source text from the chapter definition with this exercise id onwards."""
    for text in sources.values():
        index = text.find(f"exerciseId: '{exercise_id}'")
        if index < 0:  # exerciseId: SOME_CONSTANT, where SOME_CONSTANT = '<id>'
            constant = re.search(r"(\w+) = '" + re.escape(exercise_id) + "'", text)
            index = text.find(f"exerciseId: {constant.group(1)}") if constant else -1
        if index >= 0:
            return text[index:]
    return None


def test_every_answer_matches_the_frontend_chapter():
    sources = {p.name: p.read_text(encoding="utf-8") for p in FRONTEND_API.glob("*.ts")}
    for exercise_id, entry in CHAPTER_ANSWERS.items():
        if exercise_id == "pizza-share":  # the demo chapter is checked by the generic endpoint
            continue
        text = definition(sources, exercise_id)
        assert text is not None, f"{exercise_id} is not in the frontend chapters"
        found = re.search(r"\n  answer: (\d+),", text)
        assert found and found.group(1) == entry["answer"], exercise_id


def test_every_chapter_with_coins_can_be_checked():
    checked = {entry["comicId"] for entry in CHAPTER_ANSWERS.values()}
    chapters = {
        key
        for key in PROGRESS_REWARDS
        if not key.endswith("-finale") and not key.startswith("secret-")
    }
    assert chapters == checked
