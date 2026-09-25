"""Real payment, refund, reconciliation, and reporting views for administrators."""

import csv
import hashlib
import io
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_platform.models import AdminJob
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.session import get_db
from flytopay.finance_admin.models import RefundRequest
from flytopay.issuance.models import IssuanceRequest
from flytopay.payments.models import PaymentAttempt, ReconciliationCase

router = APIRouter(prefix="/api/v1/admin/finance", tags=["Admin Finance"])
ReadFinance = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sales.read"))]
WriteRefunds = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.refunds.write"))]
WritePayments = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.payments.write"))]

REFUND_TRANSITIONS = {
    "approve": ("pending", "approved"),
    "reject": ("pending", "rejected"),
    "process": ("approved", "processing"),
    "complete": ("processing", "completed"),
}


class RefundCreate(BaseModel):
    payment_attempt_id: UUID
    amount_minor: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)


class RefundDecision(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


def _refund_payload(row: RefundRequest) -> dict[str, object]:
    return {"id": str(row.id), "paymentAttemptId": str(row.payment_attempt_id), "amountMinor": row.amount_minor,
            "currency": row.currency, "reason": row.reason, "status": row.status,
            "providerRef": row.provider_ref, "createdAt": row.created_at.isoformat(),
            "processedAt": row.processed_at.isoformat() if row.processed_at else None}


@router.get("/payments")
async def payments(
    _: ReadFinance,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    provider: str | None = None,
    purpose: str | None = None,
    days: int = Query(30, ge=1, le=366),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, object]:
    statement = select(PaymentAttempt).where(PaymentAttempt.created_at >= datetime.now(UTC) - timedelta(days=days))
    if status:
        statement = statement.where(PaymentAttempt.status == status)
    if provider:
        statement = statement.where(PaymentAttempt.provider == provider)
    if purpose:
        statement = statement.where(PaymentAttempt.purpose == purpose)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(PaymentAttempt.created_at.desc())
                             .offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{"id": str(row.id), "userId": str(row.user_id), "provider": row.provider,
        "purpose": row.purpose, "status": row.status, "amountMinor": row.amount_minor, "currency": row.currency,
        "createdAt": row.created_at.isoformat(), "errorCode": row.last_error_code} for row in rows],
        "total": total, "page": page, "limit": limit}}


@router.get("/reconciliation")
async def reconciliation(
    _: ReadFinance,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
) -> dict[str, object]:
    statement = select(ReconciliationCase)
    if status:
        statement = statement.where(ReconciliationCase.status == status)
    rows = (await db.execute(statement.order_by(ReconciliationCase.created_at.desc()).limit(200))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "paymentAttemptId": str(row.payment_attempt_id),
        "type": row.case_type, "status": row.status, "reason": row.reason, "providerStatus": row.provider_status,
        "resolvedAt": row.resolved_at.isoformat() if row.resolved_at else None,
        "createdAt": row.created_at.isoformat()} for row in rows]}


@router.post("/reconciliation/{case_id}/resolve", dependencies=[Depends(verify_csrf)])
async def resolve_reconciliation(
    case_id: UUID,
    body: RefundDecision,
    request: Request,
    principal: WritePayments,
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    case = await db.get(ReconciliationCase, case_id)
    if case is None:
        raise HTTPException(404, "Reconciliation case not found")
    if case.status == "resolved":
        raise HTTPException(409, "Case already resolved")
    case.status = "resolved"
    case.resolved_at = datetime.now(UTC)
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "reconciliation.resolve", case_id, body.reason.strip(), key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(case.id), "status": case.status}}


@router.get("/refunds")
async def refunds(_: ReadFinance, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(RefundRequest).order_by(RefundRequest.created_at.desc()).limit(200))).scalars().all()
    return {"success": True, "data": [_refund_payload(row) for row in rows]}


@router.post("/refunds", dependencies=[Depends(verify_csrf)])
async def create_refund(body: RefundCreate, principal: WriteRefunds, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    payment = await db.get(PaymentAttempt, body.payment_attempt_id)
    if payment is None:
        raise HTTPException(404, "Payment not found")
    if payment.status != "succeeded" or body.amount_minor > payment.amount_minor:
        raise HTTPException(409, "Payment is not refundable for this amount")
    existing = await db.scalar(select(RefundRequest.id).where(RefundRequest.payment_attempt_id == body.payment_attempt_id, RefundRequest.status.in_(["pending", "approved", "processing", "completed"])))
    if existing:
        raise HTTPException(409, "Refund already exists")
    refund = RefundRequest(payment_attempt_id=body.payment_attempt_id, requested_by=principal.user_id, amount_minor=body.amount_minor, currency=payment.currency, reason=body.reason.strip())
    db.add(refund)
    await db.commit()
    return {"success": True, "data": {"id": str(refund.id), "status": refund.status, "amountMinor": refund.amount_minor}}


async def _transition_refund(action: str, refund_id: UUID, body: RefundDecision, request: Request,
                             principal: AdminPrincipal, db: AsyncSession, key: str | None) -> dict[str, object]:
    if not key:
        raise HTTPException(400, "Idempotency-Key is required")
    required, target = REFUND_TRANSITIONS[action]
    refund = await db.get(RefundRequest, refund_id)
    if refund is None:
        raise HTTPException(404, "Refund not found")
    if refund.status != required:
        raise HTTPException(409, f"Refund must be in '{required}' state")
    refund.status = target
    if action == "reject":
        refund.processed_at = datetime.now(UTC)
    if action == "process":
        db.add(AdminJob(kind="refund.process", payload={"refundId": str(refund.id),
               "paymentAttemptId": str(refund.payment_attempt_id), "amountMinor": refund.amount_minor,
               "currency": refund.currency}))
    if action == "complete":
        refund.processed_at = datetime.now(UTC)
    key_hash = hashlib.sha256(f"{principal.user_id}:{key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, f"refund.{action}", refund.id, body.reason.strip(), key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(refund.id), "status": refund.status}}


@router.post("/refunds/{refund_id}/approve", dependencies=[Depends(verify_csrf)])
async def approve_refund(refund_id: UUID, body: RefundDecision, request: Request, principal: WriteRefunds,
                         db: Annotated[AsyncSession, Depends(get_db)],
                         idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _transition_refund("approve", refund_id, body, request, principal, db, idempotency_key)


@router.post("/refunds/{refund_id}/reject", dependencies=[Depends(verify_csrf)])
async def reject_refund(refund_id: UUID, body: RefundDecision, request: Request, principal: WriteRefunds,
                        db: Annotated[AsyncSession, Depends(get_db)],
                        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _transition_refund("reject", refund_id, body, request, principal, db, idempotency_key)


@router.post("/refunds/{refund_id}/process", dependencies=[Depends(verify_csrf)])
async def process_refund(refund_id: UUID, body: RefundDecision, request: Request, principal: WriteRefunds,
                         db: Annotated[AsyncSession, Depends(get_db)],
                         idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _transition_refund("process", refund_id, body, request, principal, db, idempotency_key)


@router.post("/refunds/{refund_id}/complete", dependencies=[Depends(verify_csrf)])
async def complete_refund(refund_id: UUID, body: RefundDecision, request: Request, principal: WriteRefunds,
                          db: Annotated[AsyncSession, Depends(get_db)],
                          idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _transition_refund("complete", refund_id, body, request, principal, db, idempotency_key)


@router.get("/reports/summary")
async def reports_summary(
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sales.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=366),
    group_by: Literal["provider", "purpose", "currency"] = "provider",
) -> dict[str, object]:
    start = datetime.now(UTC) - timedelta(days=days)
    successful = PaymentAttempt.status == "succeeded"
    key = {"provider": PaymentAttempt.provider, "purpose": PaymentAttempt.purpose, "currency": PaymentAttempt.currency}[group_by]
    groups = await db.execute(
        select(key, func.count(PaymentAttempt.id), func.coalesce(func.sum(PaymentAttempt.amount_minor), 0))
        .where(successful, PaymentAttempt.created_at >= start).group_by(key).order_by(key)
    )
    gross = await db.scalar(select(func.coalesce(func.sum(PaymentAttempt.amount_minor), 0)).where(successful, PaymentAttempt.created_at >= start)) or 0
    orders = await db.scalar(select(func.count(PaymentAttempt.id)).where(successful, PaymentAttempt.created_at >= start)) or 0
    failed = await db.scalar(select(func.count(PaymentAttempt.id)).where(PaymentAttempt.status == "failed", PaymentAttempt.created_at >= start)) or 0
    fees = await db.scalar(select(func.coalesce(func.sum(IssuanceRequest.fee_minor), 0)).where(IssuanceRequest.created_at >= start)) or 0
    open_cases = await db.scalar(select(func.count()).select_from(ReconciliationCase).where(ReconciliationCase.status == "open")) or 0
    return {"success": True, "data": {"days": days, "groupBy": group_by,
        "grossMinor": gross, "orders": orders, "failedPayments": failed,
        "knownIssuanceFeesMinor": fees, "openReconciliation": open_cases,
        "averageOrderMinor": round(gross / orders) if orders else 0,
        "groups": [{"key": str(item_key), "orders": count, "amountMinor": amount} for item_key, count, amount in groups.all()]}}


@router.get("/reports/payments.csv")
async def payments_csv(
    _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sales.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=366),
) -> Response:
    start = datetime.now(UTC) - timedelta(days=days)
    rows = (await db.execute(select(PaymentAttempt).where(PaymentAttempt.created_at >= start)
                             .order_by(PaymentAttempt.created_at.desc()).limit(10000))).scalars().all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["payment_id", "user_id", "provider", "purpose", "status", "amount_minor", "currency", "created_at", "error_code"])
    for row in rows:
        writer.writerow([row.id, row.user_id, row.provider, row.purpose, row.status, row.amount_minor,
                         row.currency, row.created_at.isoformat(), row.last_error_code or ""])
    return Response(content=buffer.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="payments-{days}d.csv"'})
