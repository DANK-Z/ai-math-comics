"""Password hashing, JWT access tokens and role checks.

Students sign in with a login and password (children often have no e-mail), teachers with an
e-mail and password. Tokens are short HS256 JWTs signed with ``JWT_SECRET``; the payload holds
only the user id and role. Passwords are hashed with Argon2 (pwdlib).
"""

import hmac
import secrets
from datetime import UTC, datetime, timedelta
from time import time
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .db import Database, Role, SignInWindow, User

ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return password_hash.verify(password, hashed)
    except Exception:  # malformed hash: treat as a wrong password
        return False


# Spent on unknown logins too, so response time does not reveal which logins exist.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


async def consume(
    request: Request,
    session: AsyncSession,
    windows: list[tuple[str, int, int]],
    error: str,
) -> None:
    """Reserves one use in every (label, seconds, limit) window, or raises 429 with Retry-After.

    Shared by sign-in, sign-up and comic generation. Keys are HMAC digests, so the table
    never stores a login, a name or an IP.
    """
    insert = sqlite_insert if session.get_bind().dialect.name == "sqlite" else postgres_insert
    secret = request.app.state.jwt_secret.encode()
    now = int(time())
    # Loading the signed-in user already opened a read transaction: end it first.
    if session.in_transaction():
        await session.commit()

    async with session.begin():
        await session.execute(delete(SignInWindow).where(SignInWindow.expires_at <= now))
        for label, duration, limit in windows:
            key = hmac.digest(secret, label.encode(), "sha256").hex()
            expires = (now // duration + 1) * duration
            stmt = insert(SignInWindow).values(key=key, expires_at=expires, attempts=1)
            stmt = stmt.on_conflict_do_update(
                index_elements=[SignInWindow.key, SignInWindow.expires_at],
                set_={"attempts": SignInWindow.attempts + 1},
                where=SignInWindow.attempts < limit,
            ).returning(SignInWindow.attempts)
            if (await session.execute(stmt)).scalar_one_or_none() is None:
                retry_after = expires - now
                # Raised inside the transaction: nothing is reserved when any window is full.
                raise HTTPException(429, error, headers={"Retry-After": str(retry_after)})


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def enforce_sign_in_limit(request: Request, session: AsyncSession, login: str) -> None:
    """Reserve an attempt before verifying any password, including for unknown logins."""
    ip = client_ip(request)
    # Students at a school may share an IP. Give the network more room than each login.
    windows = [(f"ip\0{ip}", 60, 60), (f"login\0{ip}\0{login}", 300, 8)]
    await consume(request, session, windows, "sign_in_rate_limited")


async def enforce_generation_limit(request: Request, session: AsyncSession, user) -> None:
    """Daily comic generation limits: the whole site, each signed-in user, each guest network."""
    settings = request.app.state.settings
    day = 24 * 3600
    windows = []
    if settings.generation_daily_total:
        windows.append(("gen\0all", day, settings.generation_daily_total))
    if user is None:
        if not settings.generation_guests:
            raise HTTPException(401, "sign_in_to_create")
        if settings.generation_daily_guest:
            windows.append((f"gen\0ip\0{client_ip(request)}", day, settings.generation_daily_guest))
    else:
        per_user = (
            settings.generation_daily_teacher
            if user.role == Role.teacher
            else settings.generation_daily_student
        )
        if per_user and user.role == Role.student:
            from .billing import PLAN_COMIC_FACTOR, child_has_plan  # billing imports this module

            if await child_has_plan(session, user.id):
                per_user *= PLAN_COMIC_FACTOR
        if per_user:
            windows.append((f"gen\0user\0{user.id}", day, per_user))
    if windows:
        await consume(request, session, windows, "generation_limit")


def password_mark(user: User, secret: str) -> str:
    """A short fingerprint of the user's password hash: a new password retires old tokens."""
    return hmac.new(secret.encode(), user.hashed_password.encode(), "sha256").hexdigest()[:16]


def create_token(user: User, secret: str, lifetime: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "pv": password_mark(user, secret),
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


async def token_user(request: Request, session: AsyncSession, token: str) -> User | None:
    """The token's user, unless the token is invalid, expired or older than the password."""
    secret = request.app.state.jwt_secret
    payload = decode_token(token, secret)
    user = await session.get(User, int(payload["sub"])) if payload else None
    if user is None or not hmac.compare_digest(
        str(payload.get("pv", "")), password_mark(user, secret)
    ):
        return None
    return user


def decode_token(token: str, secret: str) -> dict | None:
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp"]})
    except jwt.PyJWTError:
        return None
    return payload if str(payload.get("sub", "")).isdigit() else None


def get_database(request: Request) -> Database:
    return request.app.state.database


async def get_session(request: Request):
    async for session in get_database(request).session():
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]


async def optional_user(
    request: Request,
    session: Session,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User | None:
    """The signed-in user, or None for guests. An invalid token is an error, not a guest."""
    if credentials is None:
        return None
    user = await token_user(request, session, credentials.credentials)
    if user is None:
        raise HTTPException(401, "invalid_token", headers={"WWW-Authenticate": "Bearer"})
    return user


async def lenient_user(
    request: Request,
    session: Session,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User | None:
    """Like optional_user, but an expired or invalid token simply means a guest.

    Used where guests are welcome (answer checks), so a stale token never blocks play.
    """
    if credentials is None:
        return None
    return await token_user(request, session, credentials.credentials)


async def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(401, "not_authenticated", headers={"WWW-Authenticate": "Bearer"})
    return user


async def current_student(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != Role.student:
        raise HTTPException(403, "students_only")
    return user


async def current_teacher(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != Role.teacher:
        raise HTTPException(403, "teachers_only")
    return user
