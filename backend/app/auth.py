"""Password hashing, JWT access tokens and role checks.

Students sign in with a login and password (children often have no e-mail), teachers with an
e-mail and password. Tokens are short HS256 JWTs signed with ``JWT_SECRET``; the payload holds
only the user id and role. Passwords are hashed with Argon2 (pwdlib).
"""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.ext.asyncio import AsyncSession

from .db import Database, Role, User

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


def create_token(user: User, secret: str, lifetime: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user.id), "role": user.role.value, "iat": now, "exp": now + lifetime}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


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
    payload = decode_token(credentials.credentials, request.app.state.jwt_secret)
    user = await session.get(User, int(payload["sub"])) if payload else None
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
    payload = decode_token(credentials.credentials, request.app.state.jwt_secret)
    return await session.get(User, int(payload["sub"])) if payload else None


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
