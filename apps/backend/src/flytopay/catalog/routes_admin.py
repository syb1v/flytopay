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
from flytopay.integrations.caas2328.client import CaaSClient, CaaSError

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


class FeePolicyInput(BaseModel):
    issue_fee_minor: int = Field(default=0, ge=0)
    fund_fee_bps: int = Field(default=0, ge=0, le=10000)
    unload_fee_bps: int = Field(default=0, ge=0, le=10000)
    markup_bps: int = Field(default=0, ge=0, le=10000)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    scale: int = Field(default=2, ge=0, le=4)


@router.get("/products")
async def products(_: ReadCatalog, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(CardProduct).order_by(CardProduct.created_at.desc()))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "code": row.code, "name": row.name,
        "scheme": row.scheme, "currency": row.currency, "enabled": row.enabled,
        "cardType": row.card_type, "isDemo": row.is_demo if hasattr(row, "is_demo") else False,
        "maxCardsPerCardholder": row.max_cards_per_cardholder} for row in rows]}


@router.get("/products/{product_id}")
async def product_detail(product_id: UUID, _: ReadCatalog, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    product = await db.get(CardProduct, product_id)
    if product is None:
        raise HTTPException(404, "Product not found")
    return {"success": True, "data": {"id": str(product.id), "code": product.code, "name": product.name,
        "scheme": product.scheme, "currency": product.currency, "enabled": product.enabled,
        "cardType": product.card_type, "maxCardsPerCardholder": product.max_cards_per_cardholder,
        "features": product.features, "controls": product.controls}}


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
        "fundFeeBps": policy.fund_fee_bps, "unloadFeeBps": policy.unload_fee_bps, "markupBps": policy.markup_bps,
        "currency": policy.currency, "scale": policy.scale}}


@router.put("/products/{product_id}/fees", dependencies=[Depends(verify_csrf)])
async def update_fees(
    product_id: UUID, body: FeePolicyInput,
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.prices.write"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if await db.get(CardProduct, product_id) is None:
        raise HTTPException(404, "Product not found")
    policy = await db.scalar(select(FeePolicy).where(FeePolicy.product_id == product_id))
    values = body.model_dump()
    values["currency"] = body.currency.upper()
    if policy is None:
        policy = FeePolicy(product_id=product_id, **values)
        db.add(policy)
    else:
        for key, value in values.items():
            setattr(policy, key, value)
    await db.commit()
    return {"success": True, "data": {"id": str(policy.id), "issueFeeMinor": policy.issue_fee_minor,
        "fundFeeBps": policy.fund_fee_bps, "unloadFeeBps": policy.unload_fee_bps, "markupBps": policy.markup_bps,
        "currency": policy.currency, "scale": policy.scale}}


@router.get("/products/{product_id}/pricing-preview")
async def pricing_preview(
    product_id: UUID,
    _: ReadCatalog,
    db: Annotated[AsyncSession, Depends(get_db)],
    amount_minor: int = 1000,
) -> dict[str, object]:
    """Retail prices versus the provider's live fee grid, per-operation costs, and markup math."""
    product = await db.get(CardProduct, product_id)
    if product is None:
        raise HTTPException(404, "Product not found")
    prices = (await db.execute(select(ProductPrice).where(
        ProductPrice.product_id == product_id, ProductPrice.is_active.is_(True)
    ).order_by(ProductPrice.term_days).limit(10))).scalars().all()
    policy = await db.scalar(select(FeePolicy).where(FeePolicy.product_id == product_id))

    provider: dict[str, object] = {"configured": False}
    costs: list[dict[str, object]] = []
    client = CaaSClient()
    if client.is_configured:
        provider["configured"] = True
        declared_scale = 2
        declared_currency = product.currency
        try:
            grid = await client.account_pricing(product_code=product.code)
            provider["pricing"] = grid
            declared_scale = int(grid.get("scale") or 2)
            declared_currency = str(grid.get("currency") or product.currency)
            for fee in grid.get("fees") or []:
                if not isinstance(fee, dict):
                    continue
                flat = int(fee.get("flatMinor") or 0)
                bps = int(fee.get("bps") or 0)
                minimum = int(fee.get("minMinor") or 0)
                computed = flat + bps * amount_minor // 10000
                costs.append({
                    "feeItem": fee.get("feeItem"), "collection": fee.get("collection"),
                    "chargedFrom": fee.get("chargedFrom"), "flatMinor": flat, "bps": bps,
                    "minMinor": minimum, "period": fee.get("period"),
                    "costAtAmountMinor": max(minimum, computed),
                })
        except (CaaSError, RuntimeError) as exc:
            provider["pricingError"] = str(exc)
        try:
            quote = await client.quote(operation="issue", amount_minor=amount_minor, product_code=product.code)
            provider["quote"] = quote
        except (CaaSError, RuntimeError) as exc:
            provider["quoteError"] = str(exc)

    def quote_fee_for(data: object) -> int | None:
        if not isinstance(data, dict):
            return None
        fee = data.get("feeMinor")
        if isinstance(fee, int):
            return fee
        total = data.get("totalChargeMinor")
        if isinstance(total, int):
            return total - int(data.get("amountMinor") or amount_minor)
        return None

    reference_fee = quote_fee_for(provider.get("quote"))
    markup_bps = policy.markup_bps if policy else 0
    suggested_retail = None
    if isinstance(reference_fee, int):
        suggested_retail = (reference_fee * (10000 + markup_bps) + 9999) // 10000

    items = []
    for price in prices:
        cost = reference_fee if len(prices) == 1 else None
        if len(prices) > 1:
            try:
                cost = quote_fee_for(await client.quote(
                    operation="issue", amount_minor=price.amount_minor, product_code=product.code
                ))
            except (CaaSError, RuntimeError):
                cost = None
        margin_minor = price.amount_minor - cost if isinstance(cost, int) else None
        items.append({
            "id": str(price.id), "termDays": price.term_days, "amountMinor": price.amount_minor,
            "feeMinor": price.fee_minor, "currency": price.currency,
            "providerCostMinor": cost, "marginMinor": margin_minor,
            "marginBps": round(margin_minor * 10000 / price.amount_minor) if margin_minor is not None and price.amount_minor else None,
            "belowCost": margin_minor is not None and margin_minor < 0,
        })
    return {"success": True, "data": {
        "productCode": product.code, "providerCode": product.provider_code,
        "quoteAmountMinor": amount_minor, "providerFeeMinor": reference_fee,
        "currency": declared_currency, "scale": declared_scale,
        "suggestedRetailMinor": suggested_retail, "markupBps": markup_bps,
        "feePolicy": None if policy is None else {
            "issueFeeMinor": policy.issue_fee_minor, "fundFeeBps": policy.fund_fee_bps,
            "unloadFeeBps": policy.unload_fee_bps, "markupBps": policy.markup_bps,
            "currency": policy.currency, "scale": policy.scale,
        },
        "costs": costs, "prices": items, "provider": provider}}
