"""Opaque cookie sessions; raw session tokens are never persisted."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.db.models import Session, User
from flytopay.db.session import get_db

SESSION_COOKIE = "flytopay_session"
SESSION_TTL = timedelta(days=30)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(db: AsyncSession, user_id: UUID) -> tuple[str, Session]:
    token = secrets.token_urlsafe(48)
    session = Session(user_id=user_id, token_hash=_hash_token(token), expires_at=datetime.now(UTC) + SESSION_TTL)
    db.add(session)
    await db.flush()
    return token, session


async def current_user_id(
    db: Annotated[AsyncSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> UUID:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    result = await db.execute(select(Session).where(Session.token_hash == _hash_token(session_token)))
    session = result.scalar_one_or_none()
    if session is None or session.revoked_at is not None or session.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user_status = await db.scalar(select(User.status).where(User.id == session.user_id))
    if user_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account unavailable")
    return session.user_id


async def revoke_user_sessions(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        update(Session)
        .where(Session.user_id == user_id, Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    return result.rowcount or 0
