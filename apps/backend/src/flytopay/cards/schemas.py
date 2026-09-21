from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProductResponse(BaseModel):
    code: str
    name: str
    scheme: str
    currency: str
    provider_code: str
    enabled: bool


class CardResponse(BaseModel):
    id: UUID
    status: str
    masked_pan: str | None
    last_four: str | None
    balance_minor: int | None
    currency: str
    scale: int
    rental_expires_at: datetime | None = None


class RentalResponse(BaseModel):
    id: UUID
    card_id: UUID
    term_days: int
    status: str
    starts_at: datetime | None
    expires_at: datetime | None
    grace_expires_at: datetime | None
    price_minor: int
    currency: str
    scale: int
