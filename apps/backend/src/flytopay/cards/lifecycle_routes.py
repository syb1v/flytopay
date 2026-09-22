"""Card lifecycle HTTP routes: freeze, unfreeze, close, transactions."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.cards.models import UserCard
from flytopay.db.session import get_db
from flytopay.integrations.caas2328.client import CaaSClient
from flytopay.integrations.caas2328.lifecycle import OperationStatus, normalize_operation
from flytopay.integrations.caas2328.persistence import (
    get_or_create_operation,
    save_operation_response,
)

router = APIRouter(prefix="/api/v1/cards", tags=["Cards"])


class LifecycleResponse(BaseModel):
    card_id: UUID
    status: str
    operation_status: str
    order_id: str | None = None


class ClosePayload(BaseModel):
    reason: str | None = None


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


async def _owned_card(db: AsyncSession, user_id: UUID, card_id: UUID) -> UserCard:
    card = (await db.execute(select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user_id))).scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _terminal_local_status(operation) -> str:
    if operation.status is OperationStatus.COMPLETED:
        return "completed"
    if operation.status is OperationStatus.FAILED:
        return "failed"
    return "processing"


async def _lifecycle(
    db: AsyncSession,
    user_id: UUID,
    card_id: UUID,
    kind: str,
    idempotency_key: str | None,
    reason: str | None,
) -> LifecycleResponse:
    card = await _owned_card(db, user_id, card_id)
    caas = CaaSClient()
    if not caas.is_configured or not card.provider_card_id:
        raise HTTPException(status_code=503, detail="CaaS API is not configured for this card")
    key = idempotency_key or f"{kind}-{card.id}"
    payload: dict[str, Any] = {"reason": reason} if reason else {}
    try:
        record = await get_or_create_operation(db, operation_key=key, operation_kind=kind, path=f"/cards/{card.id}/{kind}", payload=payload)
    except IntegrityError:
        await db.rollback()
        record = await get_or_create_operation(db, operation_key=key, operation_kind=kind, path=f"/cards/{card.id}/{kind}", payload=payload)
    if record.status not in {"processing"} or record.response:
        return LifecycleResponse(card_id=card.id, status=card.status, operation_status=record.status, order_id=record.provider_order_id)
    try:
        if kind == "freeze":
            response = await caas.freeze_card(card.provider_card_id, idempotency_key=key)
        elif kind == "unfreeze":
            response = await caas.unfreeze_card(card.provider_card_id, idempotency_key=key)
        else:
            response = await caas.close_card(card.provider_card_id, idempotency_key=key, reason=reason)
    except Exception as exc:
        await save_operation_response(db, record, status="failed", response={"error": type(exc).__name__})
        await db.commit()
        raise HTTPException(status_code=502, detail="CaaS operation failed") from exc
    operation = normalize_operation(response.data, http_status=response.status_code)
    terminal = _terminal_local_status(operation)
    await save_operation_response(db, record, status=terminal, response=dict(operation.data))
    if operation.status is OperationStatus.COMPLETED:
        if kind == "freeze":
            card.status = "frozen"
        elif kind == "unfreeze":
            card.status = "active"
        else:
            card.status = "closed"
    await db.commit()
    return LifecycleResponse(card_id=card.id, status=card.status, operation_status=terminal, order_id=operation.order_id)


@router.post("/{card_id}/freeze", response_model=LifecycleResponse)
async def freeze_card(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    return await _lifecycle(db, user_id, card_id, "freeze", idempotency_key, None)


@router.post("/{card_id}/unfreeze", response_model=LifecycleResponse)
async def unfreeze_card(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    return await _lifecycle(db, user_id, card_id, "unfreeze", idempotency_key, None)


@router.post("/{card_id}/close", response_model=LifecycleResponse)
async def close_card(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    payload: ClosePayload | None = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LifecycleResponse:
    return await _lifecycle(db, user_id, card_id, "close", idempotency_key, payload.reason if payload else None)


def _transaction(item: dict[str, Any], card: UserCard) -> CardTransaction:
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
    if not card.provider_card_id:
        return []
    caas = CaaSClient()
    if not caas.is_configured:
        return []
    try:
        data = await caas.card_transactions(card.provider_card_id, limit=max(1, min(limit, 200)))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="CaaS transactions unavailable") from exc
    items = data.get("items", [])
    return [_transaction(item, card) for item in items if isinstance(item, dict)]
