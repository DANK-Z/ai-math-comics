"""Fair shop and backpack: students spend server-awarded coins on Pifik skins, hero-card
frames and titles.

The catalog lives here (prices are server-owned). Buying is atomic: the profile row is locked,
coins are taken with a conditional UPDATE (never below zero) and the item is added in the same
transaction. Each skin can be bought once. One skin is worn at a time; it is the profile's
``avatar_item_id`` and changes Pifik's picture everywhere in the app. Frames and titles work
the same way: one of each type is worn at a time (``is_equipped`` on the backpack item).
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from .auth import Session, current_student
from .db import BackpackItem, StudentProfile, User

SkinKey = Literal[
    "smart-glasses", "yellow-backpack", "racer-helmet", "chef-hat", "space-helmet", "kalpak"
]
CATALOG: dict[str, dict] = {
    "smart-glasses": {"type": "skin", "price": 40},
    "yellow-backpack": {"type": "skin", "price": 50},
    "racer-helmet": {"type": "skin", "price": 60},
    "chef-hat": {"type": "skin", "price": 55},
    "space-helmet": {"type": "skin", "price": 70},
    "kalpak": {"type": "skin", "price": 75},
    # Frames around the hero card's picture.
    "frame-sunny": {"type": "frame", "price": 30},
    "frame-steppe": {"type": "frame", "price": 45},
    "frame-space": {"type": "frame", "price": 45},
    "frame-gold": {"type": "frame", "price": 80},
    # Titles under the student's name.
    "title-explorer": {"type": "title", "price": 20},
    "title-fractions": {"type": "title", "price": 25},
    "title-equations": {"type": "title", "price": 25},
    "title-fair-hero": {"type": "title", "price": 35},
}
WEARABLE = ("skin", "frame", "title")


class ShopItem(BaseModel):
    id: str
    type: str
    price: int
    owned: bool
    equipped: bool
    backpackItemId: int | None = None


class Shop(BaseModel):
    coins: int
    equippedSkin: str | None
    # Skins (shown on Pifik); frames and titles come separately in ``cosmetics``.
    items: list[ShopItem]
    cosmetics: list[ShopItem] = []


class BuyRequest(BaseModel):
    model_config = {"extra": "forbid"}

    itemId: str = Field(min_length=1, max_length=40)


class EquipRequest(BaseModel):
    model_config = {"extra": "forbid"}

    # A backpack item id, or null to take off what is worn in ``slot``.
    itemId: int | None
    slot: Literal["skin", "frame", "title"] = "skin"


router = APIRouter(prefix="/api/v1")
Student = Annotated[User, Depends(current_student)]


async def profile_for(session, student: User, *, lock: bool = False) -> StudentProfile:
    # populate_existing: always read fresh values (coins change through UPDATE statements).
    query = (
        select(StudentProfile)
        .where(StudentProfile.user_id == student.id)
        .execution_options(populate_existing=True)
    )
    if lock:
        query = query.with_for_update()
    profile = await session.scalar(query)
    if profile is None:
        profile = StudentProfile(user_id=student.id, total_coins=0, stars_collected=0, season={})
        session.add(profile)
        await session.flush()
    return profile


async def build_shop(session, student: User) -> Shop:
    profile = await profile_for(session, student)
    owned = {
        item.item_key: item
        for item in (
            await session.scalars(select(BackpackItem).where(BackpackItem.student_id == student.id))
        ).all()
    }
    equipped = next(
        (i.item_key for i in owned.values() if i.is_equipped and i.item_type == "skin"), None
    )

    def entry(key: str, info: dict) -> ShopItem:
        item = owned.get(key)
        return ShopItem(
            id=key,
            type=info["type"],
            price=info["price"],
            owned=item is not None,
            equipped=bool(item and item.is_equipped),
            backpackItemId=item.id if item else None,
        )

    return Shop(
        coins=profile.total_coins,
        equippedSkin=equipped,
        items=[entry(k, i) for k, i in CATALOG.items() if i["type"] == "skin"],
        cosmetics=[entry(k, i) for k, i in CATALOG.items() if i["type"] != "skin"],
    )


@router.get("/shop", response_model=Shop)
async def read_shop(user: Student, session: Session):
    return await build_shop(session, user)


@router.post("/shop/buy", status_code=201, response_model=Shop)
async def buy(body: BuyRequest, user: Student, session: Session):
    info = CATALOG.get(body.itemId)
    if info is None:
        raise HTTPException(404, "item_not_found")
    # Lock the profile so two purchases from the same student run one after another.
    await profile_for(session, user, lock=True)
    owned = await session.scalar(
        select(BackpackItem.id).where(
            BackpackItem.student_id == user.id, BackpackItem.item_key == body.itemId
        )
    )
    if owned is not None:
        await session.rollback()
        raise HTTPException(409, "already_owned")
    paid = await session.execute(
        update(StudentProfile)
        .where(StudentProfile.user_id == user.id, StudentProfile.total_coins >= info["price"])
        .values(total_coins=StudentProfile.total_coins - info["price"])
    )
    if paid.rowcount != 1:
        await session.rollback()
        raise HTTPException(409, "not_enough_coins")
    session.add(
        BackpackItem(
            student_id=user.id, item_type=info["type"], item_key=body.itemId, is_equipped=False
        )
    )
    await session.commit()
    return await build_shop(session, user)


@router.post("/backpack/equip", response_model=Shop)
async def equip(body: EquipRequest, user: Student, session: Session):
    profile = await profile_for(session, user, lock=True)
    items = (
        await session.scalars(select(BackpackItem).where(BackpackItem.student_id == user.id))
    ).all()
    chosen = None
    slot = body.slot
    if body.itemId is not None:
        chosen = next((i for i in items if i.id == body.itemId), None)
        if chosen is None:  # someone else's item, or unknown
            raise HTTPException(404, "item_not_found")
        if chosen.item_type not in WEARABLE:
            raise HTTPException(422, "not_wearable")
        slot = chosen.item_type
    for item in items:
        if item.item_type == slot:
            item.is_equipped = item is chosen
    if slot == "skin":
        profile.avatar_item_id = chosen.id if chosen else None
    await session.commit()
    return await build_shop(session, user)
