"""Fiction from the configured text provider, student records from the local database."""

import asyncio
import json
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .auth import Session, current_student
from .db import AnalyticsLog, BackpackItem, BossResult, ItemLore, StudentProfile, User
from .schemas import Language
from .shop import CATALOG
from .story import StrictModel, validate_narrative
from .worker import configured_providers

router = APIRouter(prefix="/api/v1")
Student = Annotated[User, Depends(current_student)]
SEASON_ITEMS = {
    "collectible-pizza-token": "pizza-fractions",
    "collectible-yellow-backpack": "school-store-discount",
    "collectible-clue-envelope": "school-quest-map",
    "collectible-prize-book": "library-boxes",
    "collectible-lemonade-recipe": "fair-lemonade",
    "collectible-festival-garland": "fair-garland",
}
LORE = {
    "chef-hat": (
        "Pifik's chef hat from the fair kitchen where the pizzas were cut",
        "В этом колпаке повар ярмарки резал пиццы на равные доли — ни одного лишнего кусочка.",
        "Жәрмеңке аспазы осы қалпақпен пиццаны тең бөліктерге кесетін — бір артық тілім де жоқ.",
    ),
    "space-helmet": (
        "Pifik's space helmet from the Mars greenhouse mission",
        "Шлем вернулся с марсианской теплицы: на стекле ещё видны расчёты траектории.",
        "Дулыға Марс жылыжайынан оралды: әйнегінде әлі де траектория есептері көрінеді.",
    ),
    "kalpak": (
        "Pifik's festive white felt kalpak with golden ornament",
        "Праздничный ак калпак мастер вышил узором, в котором прячется симметрия.",
        "Мерекелік ақ қалпақты шебер симметрия жасырынған өрнекпен кестелеген.",
    ),
    "racer-helmet": (
        "The Road Guardian's old racing helmet from the School Fair",
        "Шлем висел у входа на трассу. Хранитель Дорог надевал его, когда открывал ярмарку.",
        "Дулыға жарыс жолының кіреберісінде ілулі тұратын. "
        "Оны Жол Сақшысы жәрмеңкені ашқанда киетін.",
    ),
    "smart-glasses": (
        "Pifik's glasses with lenses polished by a fair inventor",
        "Мастер ярмарки отполировал линзы так, чтобы за бликами было видно тонкие узоры.",
        "Жәрмеңке шебері шағылысқан жарықтан ұсақ өрнектер көрінсін деп линзаны жылтыратқан.",
    ),
    "yellow-backpack": (
        "Pifik's yellow explorer backpack with a secret map pocket",
        "В подкладке рюкзака спрятан карман для карт, которые боятся дождя.",
        "Сөмкенің астарында жаңбырдан қорқатын карталарға арналған жасырын қалта бар.",
    ),
    "collectible-pizza-token": (
        "A wooden pizza token from the fair cafeteria",
        "Повар вырезал этот жетон, пока тесто поднималось на кухне.",
        "Қамыр көтерілгенше аспаз асүйде осы жетонды ойып жасаған.",
    ),
    "collectible-yellow-backpack": (
        "A yellow school backpack for a fair route map",
        "В школьном магазине этот рюкзак ждал того, кто носит с собой карту.",
        "Мектеп дүкенінде бұл сөмке картасын қасына алып жүретін адамды күтті.",
    ),
    "collectible-clue-envelope": (
        "A sealed envelope found on a schoolyard route",
        "Печать на конверте отливает золотом, когда её освещает солнце.",
        "Күн түскенде конверттің мөрі алтындай жарқырайды.",
    ),
    "collectible-prize-book": (
        "The library's prize book for School Fair explorers",
        "Библиотекарь оставил в книге закладку с маленькой картой ярмарки.",
        "Кітапханашы кітапқа жәрмеңкенің шағын картасы бар бетбелгі қалдырған.",
    ),
    "collectible-lemonade-recipe": (
        "A handwritten fair lemonade recipe",
        "Бумага сохранила запах мяты и лимона из ярмарочной палатки.",
        "Қағазға жәрмеңке шатырындағы жалбыз бен лимонның иісі сіңген.",
    ),
    "collectible-festival-garland": (
        "A festive handmade garland from the School Fair finish",
        "Ленты гирлянды были видны даже с другого конца двора.",
        "Гирлянданың таспалары ауланың арғы шетінен де көрініп тұрды.",
    ),
}


class LoreText(StrictModel):
    story: str = Field(min_length=20, max_length=400)


class LoreResponse(StrictModel):
    story: str
    source: Literal["generated", "prepared"]
    student: str
    owned: bool
    acquiredAt: datetime | None
    victoryAt: datetime | None
    perfect: bool
    combo: int


async def victory_record(session: Session, student_id: int):
    victory = await session.scalar(
        select(BossResult)
        .where(BossResult.student_id == student_id)
        .order_by(BossResult.created_at.desc(), BossResult.id.desc())
        .limit(1)
    )
    if victory is None:
        return None, 0
    logs = (
        await session.scalars(
            select(AnalyticsLog)
            .where(
                AnalyticsLog.student_id == student_id,
                AnalyticsLog.comic_id == victory.comic_id,
                AnalyticsLog.created_at <= victory.created_at,
            )
            .order_by(AnalyticsLog.id)
        )
    ).all()
    solved = set()
    best = streak = 0
    for log in logs:
        if log.exercise_id in solved:
            continue
        if log.status == "correct":
            solved.add(log.exercise_id)
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return victory, best


async def write_lore(settings, item: str, lang: Language, progress: str) -> str | None:
    if not (settings.gemini_api_key if settings.provider == "gemini" else settings.api_key):
        return None
    prompt = json.dumps(
        {
            "item": item,
            "language": lang,
            "theme": progress,
            "task": "Write a brief fictional origin for this item in Cyrillic. "
            "Suitable for ages ten to twelve. Do not mention the current owner or claim "
            "any player did something. Use no digits, links or markup. Two sentences at most.",
        }
    )
    try:
        async with configured_providers(settings) as (text, _image):
            raw = await asyncio.wait_for(text.generate(prompt, LoreText.model_json_schema()), 15)
        story = LoreText.model_validate(raw).story.strip()
        if any(char in story for char in "[]<>") or len(story) < 20:
            return None
        validate_narrative(story, "item.story")
        return story
    except Exception:
        # Fiction is optional. Never return provider content or credentials as an error.
        return None


async def cached_lore(
    request: Request, session: Session, key: tuple[int, str, Language], setting: str, theme: str
) -> str | None:
    # Do not hold a database transaction while waiting for the lock or provider.
    await session.rollback()
    lock = request.app.state.lore_locks.setdefault(key, asyncio.Lock())
    async with lock:
        cached = await session.get(ItemLore, key)
        if cached is not None:
            return cached.story
        await session.rollback()
        student_id, item_key, lang = key
        story = await write_lore(request.app.state.settings, setting, lang, theme)
        if story is None:
            return None
        session.add(ItemLore(student_id=student_id, item_key=item_key, locale=lang, story=story))
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            existing = await session.get(ItemLore, key)
            if existing is None:
                raise
            return existing.story
        return story


@router.post("/items/{item_key}/lore", response_model=LoreResponse)
async def reveal_lore(
    item_key: str,
    request: Request,
    student: Student,
    session: Session,
    lang: Language = "ru",
):
    template = LORE.get(item_key)
    if template is None:
        raise HTTPException(404, "item_not_found")
    item = None
    owned = False
    if item_key in CATALOG:
        item = await session.scalar(
            select(BackpackItem).where(
                BackpackItem.student_id == student.id,
                BackpackItem.item_key == item_key,
            )
        )
        owned = item is not None
    else:
        profile = await session.get(StudentProfile, student.id)
        completed = (profile.season or {}).get("completedChapters", []) if profile else []
        owned = SEASON_ITEMS[item_key] in completed
        if not owned:
            raise HTTPException(404, "item_not_found")
    player_id, player_name = student.id, student.display_name
    victory, combo = await victory_record(session, player_id)
    perfect = victory is not None and victory.misses == 0
    acquired_at = item.acquired_at.replace(tzinfo=item.acquired_at.tzinfo or UTC) if item else None
    victory_at = (
        victory.created_at.replace(tzinfo=victory.created_at.tzinfo or UTC) if victory else None
    )
    error_theme = "precision" if perfect else "perseverance" if victory else "curiosity"
    key = (player_id, item_key, lang)
    story = await cached_lore(request, session, key, template[0], error_theme)
    return LoreResponse(
        story=story or template[1 if lang == "ru" else 2],
        source="generated" if story else "prepared",
        student=player_name,
        owned=owned,
        acquiredAt=acquired_at,
        victoryAt=victory_at,
        perfect=perfect,
        combo=combo,
    )
