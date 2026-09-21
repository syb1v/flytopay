from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.db.session import get_db
from flytopay.issuance.models import IssuanceRequest
from flytopay.payments.service import PaymentService

router = APIRouter(prefix="/api/v1/issuance", tags=["Issuance"])
payment_service = PaymentService()


@router.post("/{issuance_id}/checkout")
async def issuance_checkout(issuance_id: UUID, provider: str, return_url: str, idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")], user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key is required")
    request = (await db.execute(select(IssuanceRequest).where(IssuanceRequest.id == issuance_id, IssuanceRequest.user_id == user_id))).scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=404, detail="Issuance request not found")
    if request.total_charge_minor is None:
        raise HTTPException(status_code=409, detail="Issuance quote is not ready")
    try:
        attempt = await payment_service.create_checkout(db, user_id, provider=provider, purpose=f"issuance:{issuance_id}", amount_minor=request.total_charge_minor, currency=request.currency, scale=request.scale, return_url=return_url, idempotency_key=idempotency_key)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    request.payment_attempt_id = attempt.id
    request.status = "awaiting_payment"
    await db.commit()
    return {"success": True, "status": 201, "data": {"issuanceId": str(request.id), "paymentId": str(attempt.id), "paymentStatus": attempt.status, "checkoutUrl": attempt.checkout_url}}
