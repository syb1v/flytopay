"""CRUD endpoints for products, prices, and fee policies."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.cards.models import CardProduct
from flytopay.catalog.models import FeePolicy, ProductPrice
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1/admin/catalog", tags=["Admin Catalog"])
ReadCatalog = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.products.read"))]


class ProductPatch(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    enabled: bool
    max_cards_per_cardholder: int | None = Field(default=None, ge=1, le=100)


class PriceCreate(BaseModel):
    term_days: int = Field(ge=1, le=3650)
    amount_minor: int = Field(ge=0)
    fee_minor: int = Field(default=0, ge=0)
    currency: str = Field(min_length=3, max_length=3)
    scale: int = Field(default=2, ge=0, le=4)


@router.get("/products")
async def products(_: ReadCatalog, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(CardProduct).order_by(CardProduct.created_at.desc()))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "code": row.code, "name": row.name,
        "scheme": row.scheme, "currency": row.currency, "enabled": row.enabled,
        "cardType": row.card_type, "isDemo": row.is_demo if hasattr(row, "is_demo") else False,
        "maxCardsPerCardholder": row.max_cards_per_cardholder} for row in rows]}


@router.patch("/products/{product_id}", dependencies=[Depends(verify_csrf)])
async def update_product(
    product_id: UUID, body: ProductPatch,
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.products.write"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    product = await db.get(CardProduct, product_id)
    if product is None:
        raise HTTPException(404, "Product not found")
    product.name, product.enabled, product.max_cards_per_cardholder = body.name.strip(), body.enabled, body.max_cards_per_cardholder
    await db.commit()
    return {"success": True, "data": {"id": str(product.id), "name": product.name, "enabled": product.enabled}}


@router.get("/products/{product_id}/prices")
async def prices(product_id: UUID, _: ReadCatalog, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(ProductPrice).where(ProductPrice.product_id == product_id).order_by(ProductPrice.term_days, ProductPrice.effective_from.desc()))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "termDays": row.term_days, "amountMinor": row.amount_minor,
        "feeMinor": row.fee_minor, "currency": row.currency, "scale": row.scale,
        "effectiveFrom": row.effective_from.isoformat(), "effectiveTo": row.effective_to.isoformat() if row.effective_to else None,
        "isActive": row.is_active} for row in rows]}


@router.post("/products/{product_id}/prices", dependencies=[Depends(verify_csrf)])
async def create_price(
    product_id: UUID, body: PriceCreate,
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.prices.write"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if await db.get(CardProduct, product_id) is None:
        raise HTTPException(404, "Product not found")
    currency = body.currency.upper()
    if currency not in {"USD", "EUR", "RUB"}:
        raise HTTPException(422, "Unsupported currency")
    now = datetime.now(UTC)
    active = (await db.execute(select(ProductPrice).where(ProductPrice.product_id == product_id, ProductPrice.term_days == body.term_days,
        ProductPrice.currency == currency, ProductPrice.is_active.is_(True), ProductPrice.effective_to.is_(None)))).scalars().all()
    for row in active:
        row.effective_to = now
        row.is_active = False
    price = ProductPrice(product_id=product_id, term_days=body.term_days, amount_minor=body.amount_minor, fee_minor=body.fee_minor,
                         currency=currency, scale=body.scale, effective_from=now)
    db.add(price)
    await db.commit()
    return {"success": True, "data": {"id": str(price.id), "termDays": price.term_days, "amountMinor": price.amount_minor,
        "currency": price.currency, "effectiveFrom": price.effective_from.isoformat()}}


@router.get("/products/{product_id}/fees")
async def fees(product_id: UUID, _: ReadCatalog, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    policy = await db.scalar(select(FeePolicy).where(FeePolicy.product_id == product_id))
    return {"success": True, "data": None if policy is None else {"id": str(policy.id), "issueFeeMinor": policy.issue_fee_minor,
        "fundFeeBps": policy.fund_fee_bps, "unloadFeeBps": policy.unload_fee_bps, "currency": policy.currency, "scale": policy.scale}}
