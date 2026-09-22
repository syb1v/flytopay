"""Card lifecycle HTTP routes: freeze, unfreeze, close, fund, unload, transactions.

Mutating CaaS calls are queued to the Celery worker instead of running in the
request path; the API only creates the idempotent operation record and enqueues
the external call.
"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.csrf import verify_csrf
from flytopay.auth.session import current_user_id
from flytopay.cards.models import UserCard
from flytopay.db.session import get_db
from flytopay.integrations.caas2328.client import CaaSClient
from flytopay.integrations.caas2328.persistence import (
    get_or_create_operation,
    save_operation_response,
)

router = APIRouter(prefix="/api/v1/cards", tags=["Cards"], dependencies=[Depends(verify_csrf)])


def _enqueue_task(operation_key: str, card_id: str, kind: str) -> None:
    """Queue the CaaS call without importing the Celery app at module load."""
    from flytopay.worker import celery_app

    celery_app.send_task("flytopay.caas.lifecycle", kwargs={"operation_key": operation_key, "card_id": card_id, "kind": kind})


class LifecycleResponse(BaseModel):
    card_id: UUID
    status: str
    operation_status: str
    order_id: str | None = None


class ClosePayload(BaseModel):
    reason: str | None = None


class TransferPayload(BaseModel):
    amount_minor: int = Field(gt=0, le=100_000_00)


class CardTransaction(BaseModel):
    id: str
    type: str
    status: str
    amount_minor: int
    fee_minor: int
    currency: str
    scale: int
    merchant_name: str | None = None
    mcc: str | None = None
    mcc_description: str | None = None
    merchant_country: str | None = None
    decline_code: str | None = None
    fee_type: str | None = None
    occurred_at: datetime | None = None
    authorization_code: str | None = None
    related_authorization_code: str | None = None


LIFECYCLE_KINDS = frozenset({"freeze", "unfreeze", "close", "fund", "unload"})


async def _owned_card(db: AsyncSession, user_id: UUID, card_id: UUID) -> UserCard:
    card = (await db.execute(select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user_id))).scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


async def _enqueue_lifecycle(
    db: AsyncSession,
    card: UserCard,
    kind: str,
    idempotency_key: str | None,
    payload: dict[str, Any],
) -> LifecycleResponse:
    """Create (or return) the idempotent operation record and queue the CaaS call."""
    if not card.provider_card_id:
        raise HTTPException(status_code=503, detail="CaaS API is not configured for this card")
    key = idempotency_key or f"{kind}-{card.id}"
    try:
        record = await get_or_create_operation(db, operation_key=key, operation_kind=kind, path=f"/cards/{card.id}/{kind}", payload=payload)
    except IntegrityError:
        await db.rollback()
        record = await get_or_create_operation(db, operation_key=key, operation_kind=kind, path=f"/cards/{card.id}/{kind}", payload=payload)
    if record.status != "processing" or record.response:
        return LifecycleResponse(card_id=card.id, status=card.status, operation_status=record.status, order_id=record.provider_order_id)
    await db.commit()
    _enqueue_task(key, str(card.id), kind)
    return LifecycleResponse(card_id=card.id, status=card.status, operation_status="processing", order_id=None)


async def _apply_terminal_status(db: AsyncSession, card: UserCard, kind: str) -> None:
    if kind == "freeze":
        card.status = "frozen"
    elif kind == "unfreeze":
        card.status = "active"
    elif kind == "close":
        card.status = "closed"


async def execute_lifecycle(operation_key: str, card_id: str, kind: str) -> str:
    """Worker-side: perform the queued CaaS call and persist its outcome."""
    from flytopay.db.session import session_factory

    async with session_factory() as db:
        result = await db.execute(select(UserCard).where(UserCard.id == UUID(card_id)))
        card = result.scalar_one_or_none()
        if card is None or not card.provider_card_id:
            return "failed"
        from flytopay.integrations.caas2328.persistence import CaaSOperationRecord

        record = (
            await db.execute(select(CaaSOperationRecord).where(CaaSOperationRecord.operation_key == operation_key))
        ).scalar_one_or_none()
        if record is None or record.status != "processing":
            return record.status if record else "unknown"
        caas = CaaSClient()
        if not caas.is_configured:
            return "unconfigured"
        request_payload = record.request_payload or {}
        reason = request_payload.get("reason")
        payload: dict[str, Any] = {}
        if kind in {"fund", "unload"}:
            payload = {"amountMinor": request_payload.get("amountMinor"), "orderId": operation_key}
        try:
            if kind == "freeze":
                response = await caas.freeze_card(card.provider_card_id, idempotency_key=operation_key)
            elif kind == "unfreeze":
                response = await caas.unfreeze_card(card.provider_card_id, idempotency_key=operation_key)
            elif kind == "close":
                response = await caas.close_card(card.provider_card_id, idempotency_key=operation_key, reason=reason)
            elif kind == "fund":
                response = await caas.fund_card(card.provider_card_id, payload, idempotency_key=operation_key)
            else:
                response = await caas.unload_card(card.provider_card_id, payload, idempotency_key=operation_key)
        except (RuntimeError, ValueError, TimeoutError, OSError):
            await save_operation_response(db, record, status="failed", response={"error": kind})
            await db.commit()
            return "failed"
        from flytopay.integrations.caas2328.lifecycle import OperationStatus, normalize_operation

        operation = normalize_operation(response.data, http_status=response.status_code)
        terminal = "completed" if operation.status is OperationStatus.COMPLETED else ("failed" if operation.status is OperationStatus.FAILED else "processing")
        await save_operation_response(db, record, status=terminal, response=dict(operation.data))
        if operation.status is OperationStatus.COMPLETED:
            await _apply_terminal_status(db, card, kind)
            if kind in {"fund", "unload"} and isinstance(operation.data.get("amountMinor"), int):
                delta = operation.data["amountMinor"]
                if card.balance_minor is None:
                    card.balance_minor = 0
                card.balance_minor += delta if kind == "fund" else -delta
        await db.commit()
        return terminal


@router.post("/{card_id}/freeze", response_model=LifecycleResponse)
async def freeze_card(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    card = await _owned_card(db, user_id, card_id)
    return await _enqueue_lifecycle(db, card, "freeze", idempotency_key, {})


@router.post("/{card_id}/unfreeze", response_model=LifecycleResponse)
async def unfreeze_card(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    card = await _owned_card(db, user_id, card_id)
    return await _enqueue_lifecycle(db, card, "unfreeze", idempotency_key, {})


@router.post("/{card_id}/close", response_model=LifecycleResponse)
async def close_card(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    payload: ClosePayload | None = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    card = await _owned_card(db, user_id, card_id)
    extra = {"reason": payload.reason} if payload and payload.reason else {}
    return await _enqueue_lifecycle(db, card, "close", idempotency_key, extra)


@router.post("/{card_id}/fund", response_model=LifecycleResponse)
async def fund_card(
    card_id: UUID,
    payload: TransferPayload,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    from flytopay.ratelimit import rate_limit

    if not await rate_limit("cards:fund", str(user_id), limit=10):
        raise HTTPException(status_code=429, detail="Too many fund requests")
    card = await _owned_card(db, user_id, card_id)
    if card.status != "active":
        raise HTTPException(status_code=409, detail="Card must be active to fund")
    return await _enqueue_lifecycle(db, card, "fund", idempotency_key, {"amountMinor": payload.amount_minor})


@router.post("/{card_id}/unload", response_model=LifecycleResponse)
async def unload_card(
    card_id: UUID,
    payload: TransferPayload,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    from flytopay.ratelimit import rate_limit

    if not await rate_limit("cards:unload", str(user_id), limit=10):
        raise HTTPException(status_code=429, detail="Too many unload requests")
    card = await _owned_card(db, user_id, card_id)
    if card.status != "active":
        raise HTTPException(status_code=409, detail="Card must be active to transfer")
    if card.balance_minor is None or card.balance_minor < payload.amount_minor:
        raise HTTPException(status_code=422, detail="Insufficient card balance")
    return await _enqueue_lifecycle(db, card, "unload", idempotency_key, {"amountMinor": payload.amount_minor})


def _transaction(item: dict[str, Any], card: UserCard) -> CardTransaction:
    from uuid import uuid4

    occurred = item.get("occurredAt")
    return CardTransaction(
        id=str(item.get("id") or uuid4()),
        type=str(item.get("type", "unknown")),
        status=str(item.get("status", "unknown")),
        amount_minor=int(item.get("amountMinor") or 0),
        fee_minor=int(item.get("feeMinor") or 0),
        currency=str(item.get("currency") or card.currency),
        scale=int(item.get("scale") or card.scale),
        merchant_name=item.get("merchantName"),
        mcc=item.get("mcc"),
        mcc_description=item.get("mccDescription"),
        merchant_country=item.get("merchantCountry"),
        decline_code=item.get("declineCode"),
        fee_type=item.get("feeType"),
        occurred_at=datetime.fromisoformat(occurred) if isinstance(occurred, str) else None,
        authorization_code=item.get("authorizationCode"),
        related_authorization_code=item.get("relatedAuthorizationCode"),
    )


@router.get("/{card_id}/transactions", response_model=list[CardTransaction])
async def card_transactions(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> list[CardTransaction]:
    card = await _owned_card(db, user_id, card_id)
    bounded = max(1, min(limit, 200))
    if card.is_demo:
        from flytopay.cards.transactions import CardTransactionRecord

        result = await db.execute(
            select(CardTransactionRecord)
            .where(CardTransactionRecord.card_id == card.id)
            .order_by(CardTransactionRecord.occurred_at.desc())
            .limit(bounded)
        )
        return [
            CardTransaction(
                id=str(record.id),
                type=record.type,
                status=record.status,
                amount_minor=record.amount_minor,
                fee_minor=record.fee_minor,
                currency=record.currency,
                scale=record.scale,
                merchant_name=record.merchant_name,
                mcc=record.mcc,
                mcc_description=None,
                merchant_country=record.merchant_country,
                decline_code=record.decline_code,
                fee_type=record.fee_type,
                occurred_at=record.occurred_at,
                authorization_code=None,
                related_authorization_code=None,
            )
            for record in result.scalars()
        ]
    if not card.provider_card_id:
        return []
    caas = CaaSClient()
    if not caas.is_configured:
        return []
    try:
        data = await caas.card_transactions(card.provider_card_id, limit=bounded)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="CaaS transactions unavailable") from exc
    items = data.get("items", [])
    return [_transaction(item, card) for item in items if isinstance(item, dict)]
