"""Dashboard and system health endpoints for the back-office."""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_platform.models import AdminErrorEvent, AdminJob, FeatureFlag, SystemSetting
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.cards.models import Rental, UserCard
from flytopay.db.models import TelegramAccount, User
from flytopay.db.session import get_db
from flytopay.issuance.models import IssuanceRequest
from flytopay.ledger.models import Wallet
from flytopay.payments.models import PaymentAttempt, ReconciliationCase

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Platform"])
ReadAdmin = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.read"))]
SystemAdmin = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.system.read"))]


async def _count(db: AsyncSession, model: type, *conditions: object) -> int:
    return await db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0


async def _daily_series(db: AsyncSession, model: type, start: datetime) -> dict[str, int]:
    result = await db.execute(
        select(func.date(model.created_at), func.count())
        .where(model.created_at >= start)
        .group_by(func.date(model.created_at))
    )
    return {str(day): count for day, count in result.all()}


@router.get("/dashboard/overview")
async def dashboard_overview(_: ReadAdmin, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    now = datetime.now(UTC)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = now - timedelta(days=7)
    month = now - timedelta(days=30)
    totals = {
        "users": await _count(db, User),
        "activeUsers": await _count(db, User, User.status == "active"),
        "blockedUsers": await _count(db, User, User.status == "blocked"),
        "newToday": await _count(db, User, User.created_at >= today),
        "newWeek": await _count(db, User, User.created_at >= week),
        "newMonth": await _count(db, User, User.created_at >= month),
        "telegramAccounts": await _count(db, TelegramAccount),
        "cards": await _count(db, UserCard),
        "demoCards": await _count(db, UserCard, UserCard.is_demo.is_(True)),
        "activeRentals": await _count(db, Rental, Rental.status == "active"),
        "issuances": await _count(db, IssuanceRequest),
        "payments": await _count(db, PaymentAttempt),
        "successfulPayments": await _count(db, PaymentAttempt, PaymentAttempt.status == "succeeded"),
        "failedPayments": await _count(db, PaymentAttempt, PaymentAttempt.status == "failed"),
        "openReconciliation": await _count(db, ReconciliationCase, ReconciliationCase.status == "open"),
        "wallets": await _count(db, Wallet),
    }
    payment_amounts = await db.execute(
        select(PaymentAttempt.currency, func.sum(PaymentAttempt.amount_minor))
        .where(PaymentAttempt.status == "succeeded")
        .group_by(PaymentAttempt.currency)
    )
    wallet_balances = await db.execute(
        select(Wallet.currency, func.sum(Wallet.available_minor)).group_by(Wallet.currency)
    )
    start = today - timedelta(days=29)
    users, payments, issuances = await _daily_series(db, User, start), await _daily_series(db, PaymentAttempt, start), await _daily_series(db, IssuanceRequest, start)
    days = []
    for offset in range(30):
        date = (start + timedelta(days=offset)).date().isoformat()
        days.append({"date": date, "users": users.get(date, 0), "payments": payments.get(date, 0), "issuances": issuances.get(date, 0)})
    return {"success": True, "data": {"totals": totals, "paymentAmounts": dict(payment_amounts.all()), "walletBalances": dict(wallet_balances.all()), "days": days}}


@router.get("/sales")
async def sales(
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sales.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    group_by: Literal["day", "currency", "purpose"] = "day",
    days: int = Query(30, ge=1, le=366),
) -> dict[str, object]:
    start = datetime.now(UTC) - timedelta(days=days)
    successful = PaymentAttempt.status == "succeeded"
    if group_by == "day":
        key = func.date(PaymentAttempt.created_at)
    elif group_by == "currency":
        key = PaymentAttempt.currency
    else:
        key = PaymentAttempt.purpose
    result = await db.execute(
        select(key, func.count(PaymentAttempt.id), func.sum(PaymentAttempt.amount_minor))
        .where(successful, PaymentAttempt.created_at >= start)
        .group_by(key)
        .order_by(key)
    )
    return {"success": True, "data": {"groupBy": group_by, "days": days, "items": [
        {"key": str(key), "orders": count, "amountMinor": amount or 0} for key, count, amount in result.all()
    ]}}


@router.get("/system/health")
async def system_health(_: SystemAdmin, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    failed_jobs = await _count(db, AdminJob, AdminJob.status == "failed")
    recent_errors = await _count(db, AdminErrorEvent, AdminErrorEvent.created_at >= datetime.now(UTC) - timedelta(hours=24))
    flags = (await db.execute(select(FeatureFlag.key, FeatureFlag.enabled).order_by(FeatureFlag.key))).all()
    settings = (await db.execute(select(SystemSetting.key, SystemSetting.value).where(SystemSetting.is_public_business_setting.is_(True)))).all()
    return {"success": True, "data": {"services": [
        {"name": "PostgreSQL", "status": "available"},
        {"name": "Redis/Celery", "status": "configured"},
        {"name": "2328 CaaS", "status": "configured"},
    ], "failedJobs": failed_jobs, "errorsLast24h": recent_errors,
    "featureFlags": dict(flags), "settings": dict(settings)}}


@router.post("/system/jobs/{job_id}/retry")
async def retry_job(
    job_id: str,
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.system.write"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, object]:
    job = await db.get(AdminJob, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if job.status != "failed":
        raise HTTPException(409, "Only failed jobs can be retried")
    job.status = "pending"
    job.error = None
    await db.commit()
    return {"success": True, "data": {"jobId": job_id, "status": job.status}}
