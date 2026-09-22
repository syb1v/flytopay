from datetime import UTC, date, datetime
from typing import Annotated
from uuid import UUID, uuid5

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.csrf import verify_csrf
from flytopay.auth.session import current_user_id
from flytopay.cards.models import CardProduct
from flytopay.db.session import get_db
from flytopay.integrations.caas2328.client import CaaSClient
from flytopay.issuance.models import IssuanceRequest
from flytopay.ratelimit import rate_limit
from flytopay.security.sealed import seal_json

QUOTE_NAMESPACE = uuid5(UUID(int=0), "flytopay.quote")


def _quote_uuid(idempotency_key: str) -> UUID:
    return uuid5(QUOTE_NAMESPACE, idempotency_key)

router = APIRouter(prefix="/api/v1/issuance", tags=["Issuance"], dependencies=[Depends(verify_csrf)])


SUPPORTED_COUNTRIES = frozenset({"US", "GB", "DE", "AE", "TR"})
MIN_CARDHOLDER_AGE = 18
MAX_CARDHOLDER_AGE = 120


class CardholderPayload(BaseModel):
    product_code: str = Field(min_length=1, max_length=64)
    amount_minor: int = Field(gt=0)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    phone: str = Field(pattern=r"^\+[1-9]\d{7,14}$")
    date_of_birth: date
    country: str = Field(min_length=2, max_length=2)
    address: str = Field(min_length=2, max_length=160)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=1, max_length=80)
    zip_code: str = Field(min_length=2, max_length=20)

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, value: str) -> str:
        upper = value.upper()
        if upper not in SUPPORTED_COUNTRIES:
            raise ValueError(f"Unsupported cardholder country: {upper}")
        return upper

    @field_validator("date_of_birth")
    @classmethod
    def validate_age(cls, value: date) -> date:
        today = datetime.now(UTC).date()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if not MIN_CARDHOLDER_AGE <= age <= MAX_CARDHOLDER_AGE:
            raise ValueError(f"Cardholder must be between {MIN_CARDHOLDER_AGE} and {MAX_CARDHOLDER_AGE} years old")
        if value > today:
            raise ValueError("Date of birth cannot be in the future")
        return value


class ProductPrice(BaseModel):
    product_code: str
    currency: str
    scale: int
    amount_minor: int | None = None
    fee_minor: int | None = None
    total_charge_minor: int | None = None
    available: bool = True


@router.get("/prices", response_model=list[ProductPrice])
async def prices(user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> list[ProductPrice]:
    result = await db.execute(select(CardProduct).where(CardProduct.enabled.is_(True)).order_by(CardProduct.created_at))
    products = list(result.scalars())
    caas = CaaSClient()
    prices: list[ProductPrice] = []
    for product in products:
        price = ProductPrice(product_code=product.code, currency=product.currency, scale=2)
        if caas.is_configured:
            try:
                quote = await caas.quote(operation="issue", amount_minor=5000, product_code=product.code)
                price.amount_minor = quote.get("amountMinor")
                price.fee_minor = quote.get("feeMinor")
                price.total_charge_minor = quote.get("totalChargeMinor")
            except (RuntimeError, ValueError):
                price.available = False
        else:
            price.available = False
        prices.append(price)
    return prices


@router.post("/quote")
async def quote(
    payload: CardholderPayload,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if not await rate_limit("issuance:quote", str(user_id), limit=15):
        raise HTTPException(status_code=429, detail="Too many quote requests")
    existing = None
    if idempotency_key:
        result = await db.execute(select(IssuanceRequest).where(IssuanceRequest.user_id == user_id, IssuanceRequest.id == _quote_uuid(idempotency_key)))
        existing = result.scalar_one_or_none()
        if existing is not None:
            return {"success": True, "status": 200, "data": {"issuanceId": str(existing.id), "productCode": existing.product_code, "currency": existing.currency, "amountMinor": existing.amount_minor, "feeMinor": existing.fee_minor, "totalChargeMinor": existing.total_charge_minor, "planCode": None, "planVersion": None, "duplicate": True}}
    product = (await db.execute(select(CardProduct).where(CardProduct.code == payload.product_code, CardProduct.enabled.is_(True)))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product unavailable")
    caas = CaaSClient()
    if not caas.is_configured:
        raise HTTPException(status_code=503, detail="CaaS API is not configured")
    from flytopay.integrations.caas2328.limits import get_limits

    limits = await get_limits(caas)
    if payload.amount_minor < limits.min_issue_minor:
        raise HTTPException(status_code=422, detail=f"funding.below_minimum:{limits.min_issue_minor}")
    try:
        result = await caas.quote(operation="issue", amount_minor=payload.amount_minor, product_code=product.code)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Quote service unavailable") from exc
    request = IssuanceRequest(user_id=user_id, product_code=product.code, provider_code=product.provider_code, country=payload.country, term_days=30, amount_minor=payload.amount_minor, fee_minor=result.get("feeMinor"), total_charge_minor=result.get("totalChargeMinor"), currency=product.currency, protected_cardholder=seal_json(payload.model_dump(mode="json")))
    if idempotency_key:
        request.id = _quote_uuid(idempotency_key)
    db.add(request)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(select(IssuanceRequest).where(IssuanceRequest.id == _quote_uuid(idempotency_key or "")))
        winner = result.scalar_one_or_none()
        if winner is not None:
            return {"success": True, "status": 200, "data": {"issuanceId": str(winner.id), "productCode": winner.product_code, "currency": winner.currency, "amountMinor": winner.amount_minor, "feeMinor": winner.fee_minor, "totalChargeMinor": winner.total_charge_minor, "planCode": None, "planVersion": None, "duplicate": True}}
        raise
    return {"success": True, "status": 200, "data": {"issuanceId": str(request.id), "productCode": product.code, "currency": product.currency, "amountMinor": payload.amount_minor, "feeMinor": result.get("feeMinor"), "totalChargeMinor": result.get("totalChargeMinor"), "planCode": result.get("planCode"), "planVersion": result.get("planVersion")}}


@router.post("/{issuance_id}/issue")
async def issue_from_wallet(
    issuance_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    """Issue a real card, paying the quoted total from the Flytopay wallet."""
    from flytopay.cards.issuance import IssuanceError, start_issuance

    if not await rate_limit("issuance:issue", str(user_id), limit=5):
        raise HTTPException(status_code=429, detail="Too many issuance requests")
    try:
        card = await start_issuance(db, user_id, issuance_id)
    except IssuanceError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.code) from exc
    return {"success": True, "status": 202, "data": {"cardId": str(card.id), "status": card.status, "orderId": card.issue_order_id}}
