from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.csrf import verify_csrf
from flytopay.auth.session import current_user_id
from flytopay.config import get_settings
from flytopay.db.session import get_db
from flytopay.payments.service import IdempotencyConflictError, PaymentService
from flytopay.ratelimit import rate_limit

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"], dependencies=[Depends(verify_csrf)])
service = PaymentService()


class CheckoutCreate(BaseModel):
    provider: str = Field(pattern="^(platega|pay2328|telegram_stars)$")
    purpose: str = Field(min_length=1, max_length=48)
    amount_minor: int = Field(gt=0, le=100_000_00)
    currency: str = Field(min_length=3, max_length=3)
    scale: int = Field(ge=0, le=8)
    return_url: str = Field(min_length=1, max_length=2048)


def _return_url_allowed(return_url: str) -> bool:
    from urllib.parse import urlparse

    settings = get_settings()
    allowed_hosts = {urlparse(settings.web_origin).hostname, urlparse(settings.api_origin).hostname}
    parsed = urlparse(return_url)
    return parsed.scheme in {"http", "https"} and parsed.hostname in allowed_hosts


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutCreate,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")],
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Idempotency-Key is required")
    if not _return_url_allowed(payload.return_url):
        raise HTTPException(status_code=422, detail="return_url must point to a Flytopay origin")
    if not await rate_limit("payments:checkout", str(user_id), limit=20):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many checkout requests")
    try:
        attempt = await service.create_checkout(db, user_id, **payload.model_dump(), idempotency_key=idempotency_key)
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Payment provider is unavailable") from exc
    return {"success": True, "status": 201, "data": {"paymentId": str(attempt.id), "status": attempt.status, "checkoutUrl": attempt.checkout_url}}
