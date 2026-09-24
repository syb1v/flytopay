"""Real payment and refund views for administrators."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.session import get_db
from flytopay.finance_admin.models import RefundRequest
from flytopay.payments.models import PaymentAttempt, ReconciliationCase

router = APIRouter(prefix="/api/v1/admin/finance", tags=["Admin Finance"])
ReadFinance = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sales.read"))]


class RefundCreate(BaseModel):
    payment_attempt_id: UUID
    amount_minor: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)


@router.get("/payments")
async def payments(_: ReadFinance, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(PaymentAttempt).order_by(PaymentAttempt.created_at.desc()).limit(100))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "userId": str(row.user_id), "provider": row.provider, "purpose": row.purpose, "status": row.status, "amountMinor": row.amount_minor, "currency": row.currency, "createdAt": row.created_at.isoformat(), "errorCode": row.last_error_code} for row in rows]}


@router.get("/reconciliation")
async def reconciliation(_: ReadFinance, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(ReconciliationCase).order_by(ReconciliationCase.created_at.desc()).limit(100))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "paymentAttemptId": str(row.payment_attempt_id), "type": row.case_type, "status": row.status, "reason": row.reason, "providerStatus": row.provider_status} for row in rows]}


@router.get("/refunds")
async def refunds(_: ReadFinance, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(RefundRequest).order_by(RefundRequest.created_at.desc()).limit(100))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "paymentAttemptId": str(row.payment_attempt_id), "amountMinor": row.amount_minor, "currency": row.currency, "reason": row.reason, "status": row.status, "createdAt": row.created_at.isoformat()} for row in rows]}


@router.post("/refunds", dependencies=[Depends(verify_csrf)])
async def create_refund(body: RefundCreate, principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.refunds.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
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
