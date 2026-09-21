from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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


@router.get("/overview")
async def overview(_: Annotated[UUID, Depends(admin_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    return {"success": True, "data": {"users": await db.scalar(select(func.count()).select_from(User)) or 0, "telegramAccounts": await db.scalar(select(func.count()).select_from(TelegramAccount)) or 0, "cards": await db.scalar(select(func.count()).select_from(UserCard)) or 0, "demoCards": await db.scalar(select(func.count()).select_from(UserCard).where(UserCard.is_demo.is_(True))) or 0, "rentals": await db.scalar(select(func.count()).select_from(Rental)) or 0, "payments": await db.scalar(select(func.count()).select_from(PaymentAttempt)) or 0, "wallets": await db.scalar(select(func.count()).select_from(Wallet)) or 0}}
