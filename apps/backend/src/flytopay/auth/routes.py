import json
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import SESSION_COOKIE, create_session, current_user_id
from flytopay.auth.telegram import TelegramInitDataError, validate_init_data
from flytopay.config import get_settings
from flytopay.db.models import TelegramAccount, User
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class TelegramLoginRequest(BaseModel):
    init_data: str


@router.post("/telegram")
async def telegram_login(payload: TelegramLoginRequest, response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    try:
        values = validate_init_data(payload.init_data, get_settings().telegram_bot_token or "")
    except TelegramInitDataError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram authentication") from exc
    try:
        telegram_user = json.loads(values["user"])
        telegram_id = int(telegram_user["id"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail="Telegram user payload is invalid") from exc
    account_result = await db.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == telegram_id))
    account = account_result.scalar_one_or_none()
    if account is None:
        user = User()
        db.add(user)
        await db.flush()
        account = TelegramAccount(user_id=user.id, telegram_id=telegram_id, username=telegram_user.get("username"))
        db.add(account)
    token, session = await create_session(db, account.user_id)
    await db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=get_settings().app_env == "production", samesite="lax", max_age=30 * 24 * 60 * 60)
    return {"success": True, "status": 200, "data": {"userId": str(account.user_id), "sessionId": str(session.id)}}


@router.post("/logout")
async def logout(
    response: Response,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)],
    user_id: Annotated[object, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    # Revoke by the same token after the dependency has validated it.
    from flytopay.auth.session import _hash_token
    from flytopay.db.models import Session
    result = await db.execute(select(Session).where(Session.token_hash == _hash_token(session_token or "")))
    session = result.scalar_one_or_none()
    if session:
        from datetime import UTC, datetime
        session.revoked_at = datetime.now(UTC)
        await db.commit()
    response.delete_cookie(SESSION_COOKIE)
    return {"success": True, "status": 200, "data": {"loggedOut": True}}
