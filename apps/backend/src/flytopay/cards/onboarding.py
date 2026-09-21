from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.cards.models import CardProduct
from flytopay.db.session import get_db
from flytopay.integrations.caas2328.client import CaaSClient
from flytopay.issuance.models import IssuanceRequest
from flytopay.security.sealed import seal_json

router = APIRouter(prefix="/api/v1/issuance", tags=["Issuance"])


class CardholderPayload(BaseModel):
    product_code: str = Field(min_length=1, max_length=64)
    amount_minor: int = Field(gt=0)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: str
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
        return value.upper()


@router.post("/quote")
async def quote(payload: CardholderPayload, user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    product = (await db.execute(select(CardProduct).where(CardProduct.code == payload.product_code, CardProduct.enabled.is_(True)))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product unavailable")
    caas = CaaSClient()
    if not caas.is_configured:
        raise HTTPException(status_code=503, detail="CaaS API is not configured")
    try:
        result = await caas.quote(operation="issue", amount_minor=payload.amount_minor, product_code=product.code)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Quote service unavailable") from exc
    request = IssuanceRequest(user_id=user_id, product_code=product.code, provider_code=product.provider_code, country=payload.country, term_days=30, amount_minor=payload.amount_minor, fee_minor=result.get("feeMinor"), total_charge_minor=result.get("totalChargeMinor"), currency=product.currency, protected_cardholder=seal_json(payload.model_dump(mode="json")))
    db.add(request)
    await db.commit()
    return {"success": True, "status": 200, "data": {"issuanceId": str(request.id), "productCode": product.code, "currency": product.currency, "amountMinor": payload.amount_minor, "feeMinor": result.get("feeMinor"), "totalChargeMinor": result.get("totalChargeMinor"), "planCode": result.get("planCode"), "planVersion": result.get("planVersion")}}
