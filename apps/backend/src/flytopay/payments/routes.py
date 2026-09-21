from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.db.session import get_db
from flytopay.payments.service import PaymentService

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])
service = PaymentService()


class CheckoutCreate(BaseModel):
    provider: str = Field(pattern="^(platega|pay2328|telegram_stars)$")
    purpose: str = Field(min_length=1, max_length=48)
    amount_minor: int = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    scale: int = Field(ge=0, le=8)
    return_url: str = Field(min_length=1, max_length=2048)


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutCreate,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")],
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Idempotency-Key is required")
    try:
        attempt = await service.create_checkout(db, user_id, **payload.model_dump(), idempotency_key=idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Payment provider is unavailable") from exc
    return {"success": True, "status": 201, "data": {"paymentId": str(attempt.id), "status": attempt.status, "checkoutUrl": attempt.checkout_url}}
