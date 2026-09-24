from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.management import search_users
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.session import current_user_id
from flytopay.cards.models import Rental, UserCard
from flytopay.config import telegram_admin_ids
from flytopay.db.models import TelegramAccount, User
from flytopay.db.session import get_db
from flytopay.ledger.models import Wallet
from flytopay.payments.models import PaymentAttempt

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


async def admin_user_id(user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> UUID:
    telegram_id = await db.scalar(select(TelegramAccount.telegram_id).where(TelegramAccount.user_id == user_id))
    if telegram_id not in telegram_admin_ids():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user_id


@router.get("/status")
async def admin_status(
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    telegram_id = await db.scalar(select(TelegramAccount.telegram_id).where(TelegramAccount.user_id == user_id))
    return {"success": True, "data": {"isAdmin": telegram_id in telegram_admin_ids()}}


@router.get("/overview")
async def overview(_: Annotated[UUID, Depends(admin_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    return {"success": True, "data": {"users": await db.scalar(select(func.count()).select_from(User)) or 0, "telegramAccounts": await db.scalar(select(func.count()).select_from(TelegramAccount)) or 0, "cards": await db.scalar(select(func.count()).select_from(UserCard)) or 0, "demoCards": await db.scalar(select(func.count()).select_from(UserCard).where(UserCard.is_demo.is_(True))) or 0, "rentals": await db.scalar(select(func.count()).select_from(Rental)) or 0, "payments": await db.scalar(select(func.count()).select_from(PaymentAttempt)) or 0, "wallets": await db.scalar(select(func.count()).select_from(Wallet)) or 0}}


@router.get("/users")
async def users(
    principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = "", status: str | None = None, activity: str | None = None,
    page: int = 1, limit: int = 20, sort: str = "createdAt", order: str = "desc",
) -> dict[str, object]:
    return await search_users(principal, db, q, status, activity, page, limit, sort, order)


@router.get("/cards")
async def cards(_: Annotated[UUID, Depends(admin_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    result = await db.execute(select(UserCard.id, UserCard.user_id, UserCard.status, UserCard.last_four, UserCard.is_demo, UserCard.created_at).order_by(UserCard.created_at.desc()).limit(100))
    return {"success": True, "data": [{"cardId": str(card_id), "userId": str(user_id), "status": status, "lastFour": last_four, "isDemo": is_demo, "createdAt": created_at.isoformat()} for card_id, user_id, status, last_four, is_demo, created_at in result.all()]}


@router.get("/payments")
async def payments(_: Annotated[UUID, Depends(admin_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    result = await db.execute(select(PaymentAttempt.id, PaymentAttempt.user_id, PaymentAttempt.provider, PaymentAttempt.status, PaymentAttempt.amount_minor, PaymentAttempt.currency, PaymentAttempt.created_at).order_by(PaymentAttempt.created_at.desc()).limit(100))
    return {"success": True, "data": [{"paymentId": str(payment_id), "userId": str(user_id), "provider": provider, "status": status, "amountMinor": amount_minor, "currency": currency, "createdAt": created_at.isoformat()} for payment_id, user_id, provider, status, amount_minor, currency, created_at in result.all()]}


@router.get("/issuances")
async def issuances(_: Annotated[UUID, Depends(admin_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    result = await db.execute(select(Rental.id, Rental.user_id, Rental.card_id, Rental.term_days, Rental.status, Rental.expires_at).order_by(Rental.created_at.desc()).limit(100))
    return {"success": True, "data": [{"issuanceId": str(issuance_id), "userId": str(user_id), "cardId": str(card_id), "termDays": term_days, "status": status, "expiresAt": expires_at.isoformat() if expires_at else None} for issuance_id, user_id, card_id, term_days, status, expires_at in result.all()]}
