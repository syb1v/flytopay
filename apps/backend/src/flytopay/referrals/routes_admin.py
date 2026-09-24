"""Referral statistics and payout administration."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.db.session import get_db
from flytopay.referrals.models import PayoutRequest, ReferralLedgerEntry, ReferralLink, ReferralSetting

router = APIRouter(prefix="/api/v1/admin/referrals", tags=["Admin Referrals"])
ReadReferrals = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.referrals.read"))]


@router.get("/overview")
async def overview(_: ReadReferrals, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    settings = (await db.execute(select(ReferralSetting).order_by(ReferralSetting.created_at.desc()).limit(1))).scalar_one_or_none()
    total_links = await db.scalar(select(func.count()).select_from(ReferralLink)) or 0
    total_entries = await db.scalar(select(func.count()).select_from(ReferralLedgerEntry)) or 0
    accrued = await db.scalar(select(func.sum(ReferralLedgerEntry.amount_minor)).where(ReferralLedgerEntry.status == "accrued")) or 0
    pending_payouts = await db.scalar(select(func.count()).select_from(PayoutRequest).where(PayoutRequest.status == "pending")) or 0
    return {"success": True, "data": {"settings": None if settings is None else {"commissionBps": settings.commission_bps, "minimumPayoutMinor": settings.minimum_payout_minor, "currency": settings.currency, "enabled": settings.is_enabled}, "links": total_links, "ledgerEntries": total_entries, "accruedMinor": accrued, "pendingPayouts": pending_payouts}}


@router.get("/payouts")
async def payouts(_: ReadReferrals, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(PayoutRequest).order_by(PayoutRequest.created_at.desc()).limit(100))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "userId": str(row.user_id), "amountMinor": row.amount_minor, "currency": row.currency, "status": row.status, "createdAt": row.created_at.isoformat()} for row in rows]}
