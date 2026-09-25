"""Campaign and promotion administration endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.session import get_db
from flytopay.marketing.models import Campaign, CampaignEvent, PromoCode, PromoGroup

router = APIRouter(prefix="/api/v1/admin/marketing", tags=["Admin Marketing"])
ReadMarketing = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.read"))]


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    start_parameter: str = Field(pattern=r"^[a-zA-Z0-9_-]{2,128}$")
    source: str | None = Field(default=None, max_length=128)
    channel: str | None = Field(default=None, max_length=128)
    budget_minor: int | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)


class PromoCodeCreate(BaseModel):
    code: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    discount_bps: int = Field(default=0, ge=0, le=10000)
    bonus_minor: int = Field(default=0, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    max_redemptions: int | None = Field(default=None, ge=1)
    expires_at: str | None = None


class CampaignPatch(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    source: str | None = Field(default=None, max_length=128)
    channel: str | None = Field(default=None, max_length=128)
    is_active: bool


class PromoCodePatch(BaseModel):
    discount_bps: int = Field(default=0, ge=0, le=10000)
    bonus_minor: int = Field(default=0, ge=0)
    max_redemptions: int | None = Field(default=None, ge=1)
    is_active: bool


@router.get("/campaigns")
async def campaigns(_: ReadMarketing, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))).scalars().all()
    items = []
    for row in rows:
        registrations = await db.scalar(select(func.count(CampaignEvent.id)).where(CampaignEvent.campaign_id == row.id, CampaignEvent.event == "registration")) or 0
        conversions = await db.scalar(select(func.count(CampaignEvent.id)).where(CampaignEvent.campaign_id == row.id, CampaignEvent.event == "payment")) or 0
        revenue = await db.scalar(select(func.sum(CampaignEvent.revenue_minor)).where(CampaignEvent.campaign_id == row.id)) or 0
        items.append({"id": str(row.id), "name": row.name, "startParameter": row.start_parameter, "source": row.source, "channel": row.channel, "isActive": row.is_active, "registrations": registrations, "conversions": conversions, "revenueMinor": revenue})
    return {"success": True, "data": items}


@router.post("/campaigns", dependencies=[Depends(verify_csrf)])
async def create_campaign(body: CampaignCreate, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    campaign = Campaign(name=body.name.strip(), start_parameter=body.start_parameter, source=body.source, channel=body.channel, budget_minor=body.budget_minor, currency=body.currency.upper())
    db.add(campaign)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(409, "Campaign parameter already exists") from exc
    return {"success": True, "data": {"id": str(campaign.id), "name": campaign.name, "startParameter": campaign.start_parameter}}


@router.get("/campaigns/{campaign_id}")
async def campaign_detail(campaign_id: UUID, _: ReadMarketing, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    return {"success": True, "data": {"id": str(campaign.id), "name": campaign.name,
        "startParameter": campaign.start_parameter, "source": campaign.source, "channel": campaign.channel,
        "budgetMinor": campaign.budget_minor, "currency": campaign.currency, "isActive": campaign.is_active,
        "startsAt": campaign.starts_at.isoformat() if campaign.starts_at else None,
        "endsAt": campaign.ends_at.isoformat() if campaign.ends_at else None}}


@router.patch("/campaigns/{campaign_id}", dependencies=[Depends(verify_csrf)])
async def update_campaign(campaign_id: UUID, body: CampaignPatch, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    campaign.name, campaign.source, campaign.channel, campaign.is_active = body.name.strip(), body.source, body.channel, body.is_active
    await db.commit()
    return {"success": True, "data": {"id": str(campaign.id), "name": campaign.name, "isActive": campaign.is_active}}


@router.delete("/campaigns/{campaign_id}", dependencies=[Depends(verify_csrf)])
async def delete_campaign(campaign_id: UUID, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    campaign.is_active = False
    await db.commit()
    return {"success": True, "data": {"id": str(campaign.id), "isActive": campaign.is_active}}


@router.get("/promo-codes")
async def promo_codes(_: ReadMarketing, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(PromoCode).order_by(PromoCode.created_at.desc()))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "code": row.code, "discountBps": row.discount_bps, "bonusMinor": row.bonus_minor, "currency": row.currency, "redemptions": row.redemptions, "maxRedemptions": row.max_redemptions, "isActive": row.is_active, "expiresAt": row.expires_at.isoformat() if row.expires_at else None} for row in rows]}


@router.post("/promo-codes", dependencies=[Depends(verify_csrf)])
async def create_promo_code(body: PromoCodeCreate, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    promo = PromoCode(code=body.code.upper(), discount_bps=body.discount_bps, bonus_minor=body.bonus_minor, currency=body.currency.upper(), max_redemptions=body.max_redemptions)
    db.add(promo)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(409, "Promo code already exists") from exc
    return {"success": True, "data": {"id": str(promo.id), "code": promo.code}}


@router.get("/promo-codes/{promo_id}")
async def promo_code_detail(promo_id: UUID, _: ReadMarketing, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    promo = await db.get(PromoCode, promo_id)
    if promo is None:
        raise HTTPException(404, "Promo code not found")
    return {"success": True, "data": {"id": str(promo.id), "code": promo.code,
        "discountBps": promo.discount_bps, "bonusMinor": promo.bonus_minor, "currency": promo.currency,
        "maxRedemptions": promo.max_redemptions, "maxRedemptionsPerUser": promo.max_redemptions_per_user,
        "redemptions": promo.redemptions, "isActive": promo.is_active,
        "expiresAt": promo.expires_at.isoformat() if promo.expires_at else None}}


@router.patch("/promo-codes/{promo_id}", dependencies=[Depends(verify_csrf)])
async def update_promo_code(promo_id: UUID, body: PromoCodePatch, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    promo = await db.get(PromoCode, promo_id)
    if promo is None:
        raise HTTPException(404, "Promo code not found")
    for key, value in body.model_dump().items():
        setattr(promo, key, value)
    await db.commit()
    return {"success": True, "data": {"id": str(promo.id), "code": promo.code, "isActive": promo.is_active}}


@router.delete("/promo-codes/{promo_id}", dependencies=[Depends(verify_csrf)])
async def archive_promo_code(promo_id: UUID, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.marketing.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    promo = await db.get(PromoCode, promo_id)
    if promo is None:
        raise HTTPException(404, "Promo code not found")
    promo.is_active = False
    await db.commit()
    return {"success": True, "data": {"id": str(promo.id), "isActive": promo.is_active}}


@router.get("/promo-groups")
async def promo_groups(_: ReadMarketing, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(PromoGroup).order_by(PromoGroup.name))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "name": row.name, "description": row.description, "isActive": row.is_active} for row in rows]}
