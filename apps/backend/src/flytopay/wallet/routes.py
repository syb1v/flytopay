from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.db.session import get_db
from flytopay.ledger.models import Wallet

router = APIRouter(prefix="/api/v1/wallet", tags=["Wallet"])


class WalletResponse(BaseModel):
    currency: str
    scale: int
    available_minor: int
    reserved_minor: int
    total_minor: int


@router.get("", response_model=WalletResponse)
async def get_wallet(user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> WalletResponse:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = Wallet(user_id=user_id)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    return WalletResponse(currency=wallet.currency, scale=wallet.scale, available_minor=wallet.available_minor, reserved_minor=wallet.reserved_minor, total_minor=wallet.available_minor + wallet.reserved_minor)
