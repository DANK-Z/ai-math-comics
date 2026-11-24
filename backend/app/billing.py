"""Parent billing: the «Семья» plan and coin packs for a child.

No payment provider is connected yet, so ``payments_mode`` is ``test``: a purchase is recorded
with status ``test`` and takes effect at once, without money (capped per day so nobody mints
coins). With a provider, the same products and the ``payments`` table stay; only the step that
confirms the money changes. ``off`` hides purchases.

The plan lasts 30 days from payment (a repeat payment extends it). While it is active the weekly
gift is 50 coins instead of 20 and the parent's children may make three times more comics a day.
Coins bought for a child arrive as a card on the child's home page; like gifts they are not
earnings, so the class league ignores them.
"""

from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import func, select, update

from .auth import Session
from .db import FamilyLink, FamilyPlan, Payment, Praise, StudentProfile
from .family import ChildSummary, Parent, linked_child, summary

router = APIRouter(prefix="/api/parent")

PLAN_DAYS = timedelta(days=30)
PLANS = {"family": {"price": 1990}}
PACKS = {
    "coins-100": {"coins": 100, "price": 490},
    "coins-300": {"coins": 300, "price": 1290},
    "coins-700": {"coins": 700, "price": 2490},
}
TEST_PAYMENTS_PER_DAY = 5
PLAN_GIFT_COINS = 50
PLAN_COMIC_FACTOR = 3


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


async def active_plan(session, parent_id: int) -> FamilyPlan | None:
    plan = await session.get(FamilyPlan, parent_id)
    return plan if plan is not None and aware(plan.paid_until) > now() else None


async def child_has_plan(session, student_id: int) -> bool:
    """Any parent of this child has an active plan (more comics a day)."""
    found = await session.scalar(
        select(FamilyPlan.parent_id)
        .join(FamilyLink, FamilyLink.parent_id == FamilyPlan.parent_id)
        .where(FamilyLink.student_id == student_id, FamilyPlan.paid_until > now())
        .limit(1)
    )
    return found is not None


class Product(BaseModel):
    id: str
    price: int
    coins: int = 0


class PaymentOut(BaseModel):
    id: int
    product: str
    amount: int
    coins: int
    childId: int | None
    status: str
    at: datetime


class Billing(BaseModel):
    mode: Literal["test", "off"]
    plan: str | None
    paidUntil: datetime | None
    plans: list[Product]
    packs: list[Product]
    history: list[PaymentOut]


def mode_of(request: Request) -> str:
    mode = request.app.state.settings.payments_mode
    return mode if mode in ("test", "off") else "off"


async def billing_for(session, request: Request, parent) -> Billing:
    plan = await active_plan(session, parent.id)
    rows = (
        await session.scalars(
            select(Payment)
            .where(Payment.parent_id == parent.id)
            .order_by(Payment.created_at.desc())
            .limit(10)
        )
    ).all()
    return Billing(
        mode=mode_of(request),
        plan=plan.plan if plan else None,
        paidUntil=aware(plan.paid_until) if plan else None,
        plans=[Product(id=k, price=v["price"]) for k, v in PLANS.items()],
        packs=[Product(id=k, price=v["price"], coins=v["coins"]) for k, v in PACKS.items()],
        history=[
            PaymentOut(
                id=p.id,
                product=p.product,
                amount=p.amount_kzt,
                coins=p.coins,
                childId=p.student_id,
                status=p.status,
                at=aware(p.created_at),
            )
            for p in rows
        ],
    )


async def take_payment(session, request: Request, parent, product: str, amount: int, **extra):
    """Records a payment. Test mode: no money, at most a few a day."""
    if mode_of(request) != "test":
        raise HTTPException(403, "payments_off")
    today = await session.scalar(
        select(func.count()).where(
            Payment.parent_id == parent.id, Payment.created_at >= now() - timedelta(days=1)
        )
    )
    if (today or 0) >= TEST_PAYMENTS_PER_DAY:
        raise HTTPException(429, "payments_limit")
    payment = Payment(
        parent_id=parent.id,
        product=product,
        amount_kzt=amount,
        status="test",
        created_at=now(),
        **extra,
    )
    session.add(payment)
    return payment


@router.get("/billing", response_model=Billing)
async def read_billing(request: Request, user: Parent, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return await billing_for(session, request, user)


class PlanIn(BaseModel):
    model_config = {"extra": "forbid"}

    plan: Literal["family"]


@router.post("/billing/plan", status_code=201, response_model=Billing)
async def buy_plan(body: PlanIn, request: Request, user: Parent, session: Session):
    await take_payment(session, request, user, body.plan, PLANS[body.plan]["price"], coins=0)
    plan = await session.get(FamilyPlan, user.id)
    start = max(now(), aware(plan.paid_until)) if plan else now()
    if plan is None:
        session.add(FamilyPlan(parent_id=user.id, plan=body.plan, paid_until=start + PLAN_DAYS))
    else:
        plan.plan = body.plan
        plan.paid_until = start + PLAN_DAYS
    await session.commit()
    return await billing_for(session, request, user)


class PackIn(BaseModel):
    model_config = {"extra": "forbid"}

    pack: Literal["coins-100", "coins-300", "coins-700"]


@router.post("/children/{student_id}/coins", status_code=201, response_model=ChildSummary)
async def buy_coins(
    student_id: int, body: PackIn, request: Request, user: Parent, session: Session
):
    child = await linked_child(session, user, student_id)
    pack = PACKS[body.pack]
    await take_payment(
        session, request, user, body.pack, pack["price"], coins=pack["coins"], student_id=child.id
    )
    paid = await session.execute(
        update(StudentProfile)
        .where(StudentProfile.user_id == child.id)
        .values(total_coins=StudentProfile.total_coins + pack["coins"])
    )
    if paid.rowcount != 1:
        session.add(StudentProfile(user_id=child.id, total_coins=pack["coins"], season={}))
    session.add(
        Praise(
            parent_id=user.id,
            student_id=child.id,
            kind="coins",
            coins=pack["coins"],
            created_at=now(),
        )
    )
    await session.commit()
    return await summary(session, user, child)
