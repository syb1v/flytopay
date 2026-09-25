"""Referral statistics, settings, payouts, and partnership administration."""

import hashlib
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.models import TelegramAccount
from flytopay.db.session import get_db
from flytopay.referrals.models import PayoutRequest, ReferralLedgerEntry, ReferralLink, ReferralSetting

router = APIRouter(prefix="/api/v1/admin/referrals", tags=["Admin Referrals"])
ReadReferrals = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.referrals.read"))]
WriteReferrals = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.referrals.write"))]


class ReferralSettingsInput(BaseModel):
    commission_bps: int = Field(ge=0, le=10000)
    minimum_payout_minor: int = Field(ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    is_enabled: bool


class PayoutDecision(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


def _settings_payload(settings: ReferralSetting | None) -> dict[str, object] | None:
    if settings is None:
        return None
    return {"commissionBps": settings.commission_bps, "minimumPayoutMinor": settings.minimum_payout_minor,
            "currency": settings.currency, "enabled": settings.is_enabled}


@router.get("/overview")
async def overview(_: ReadReferrals, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    settings = (await db.execute(select(ReferralSetting).order_by(ReferralSetting.created_at.desc()).limit(1))).scalar_one_or_none()
    total_links = await db.scalar(select(func.count()).select_from(ReferralLink)) or 0
    total_entries = await db.scalar(select(func.count()).select_from(ReferralLedgerEntry)) or 0
    accrued = await db.scalar(select(func.sum(ReferralLedgerEntry.amount_minor)).where(ReferralLedgerEntry.status == "accrued")) or 0
    paid = await db.scalar(select(func.sum(ReferralLedgerEntry.amount_minor)).where(ReferralLedgerEntry.status == "paid")) or 0
    pending_payouts = await db.scalar(select(func.count()).select_from(PayoutRequest).where(PayoutRequest.status == "pending")) or 0
    return {"success": True, "data": {"settings": _settings_payload(settings), "links": total_links,
        "ledgerEntries": total_entries, "accruedMinor": accrued, "paidMinor": paid, "pendingPayouts": pending_payouts}}


@router.put("/settings", dependencies=[Depends(verify_csrf)])
async def update_settings(
    body: ReferralSettingsInput,
    request: Request,
    principal: WriteReferrals,
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    settings = (await db.execute(select(ReferralSetting).order_by(ReferralSetting.created_at.desc()).limit(1))).scalar_one_or_none()
    values = body.model_dump()
    values["currency"] = body.currency.upper()
    if settings is None:
        settings = ReferralSetting(**values)
        db.add(settings)
    else:
        for key, value in values.items():
            setattr(settings, key, value)
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "referral.settings", settings.id, "Referral settings updated", key_hash)
    await db.commit()
    return {"success": True, "data": _settings_payload(settings)}


@router.get("/payouts")
async def payouts(_: ReadReferrals, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(PayoutRequest).order_by(PayoutRequest.created_at.desc()).limit(200))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "userId": str(row.user_id), "amountMinor": row.amount_minor,
        "currency": row.currency, "status": row.status, "createdAt": row.created_at.isoformat(),
        "processedAt": row.processed_at.isoformat() if row.processed_at else None} for row in rows]}


async def _payout_decision(action: str, payout_id: UUID, body: PayoutDecision, request: Request,
                           principal: AdminPrincipal, db: AsyncSession, key: str | None) -> dict[str, object]:
    if not key:
        raise HTTPException(400, "Idempotency-Key is required")
    payout = await db.get(PayoutRequest, payout_id)
    if payout is None:
        raise HTTPException(404, "Payout not found")
    if payout.status != "pending":
        raise HTTPException(409, "Payout already processed")
    payout.status = "approved" if action == "approve" else "rejected"
    payout.processed_at = datetime.now(UTC)
    key_hash = hashlib.sha256(f"{principal.user_id}:{key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, f"payout.{action}", payout.id, body.reason.strip(), key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(payout.id), "status": payout.status}}


@router.post("/payouts/{payout_id}/approve", dependencies=[Depends(verify_csrf)])
async def approve_payout(payout_id: UUID, body: PayoutDecision, request: Request, principal: WriteReferrals,
                         db: Annotated[AsyncSession, Depends(get_db)],
                         idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _payout_decision("approve", payout_id, body, request, principal, db, idempotency_key)


@router.post("/payouts/{payout_id}/reject", dependencies=[Depends(verify_csrf)])
async def reject_payout(payout_id: UUID, body: PayoutDecision, request: Request, principal: WriteReferrals,
                        db: Annotated[AsyncSession, Depends(get_db)],
                        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _payout_decision("reject", payout_id, body, request, principal, db, idempotency_key)


@router.get("/partners")
async def partners(
    _: ReadReferrals,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, object]:
    rows = (await db.execute(
        select(ReferralLink.referrer_user_id, func.count(ReferralLink.id))
        .group_by(ReferralLink.referrer_user_id)
        .order_by(func.count(ReferralLink.id).desc())
        .limit(limit)
    )).all()
    items = []
    for referrer_id, invited in rows:
        accrued = await db.scalar(select(func.coalesce(func.sum(ReferralLedgerEntry.amount_minor), 0)).where(
            ReferralLedgerEntry.referrer_user_id == referrer_id, ReferralLedgerEntry.status == "accrued")) or 0
        paid = await db.scalar(select(func.coalesce(func.sum(ReferralLedgerEntry.amount_minor), 0)).where(
            ReferralLedgerEntry.referrer_user_id == referrer_id, ReferralLedgerEntry.status == "paid")) or 0
        telegram_id = await db.scalar(select(TelegramAccount.telegram_id).where(
            TelegramAccount.user_id == referrer_id))
        items.append({"userId": str(referrer_id), "telegramId": telegram_id, "invited": invited,
                      "accruedMinor": accrued, "paidMinor": paid})
    return {"success": True, "data": items}


@router.get("/tree")
async def tree(
    _: ReadReferrals,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: UUID,
) -> dict[str, object]:
    links = (await db.execute(select(ReferralLink).where(ReferralLink.referrer_user_id == user_id)
                              .order_by(ReferralLink.created_at.desc()).limit(200))).scalars().all()
    items = []
    for link in links:
        telegram_id = await db.scalar(select(TelegramAccount.telegram_id).where(
            TelegramAccount.user_id == link.referred_user_id))
        earned = await db.scalar(select(func.coalesce(func.sum(ReferralLedgerEntry.amount_minor), 0)).where(
            ReferralLedgerEntry.referred_user_id == link.referred_user_id,
            ReferralLedgerEntry.referrer_user_id == user_id)) or 0
        items.append({"linkId": str(link.id), "referredUserId": str(link.referred_user_id),
                      "telegramId": telegram_id, "status": link.status,
                      "earnedMinor": earned, "createdAt": link.created_at.isoformat()})
    return {"success": True, "data": {"userId": str(user_id), "items": items, "total": len(items)}}
