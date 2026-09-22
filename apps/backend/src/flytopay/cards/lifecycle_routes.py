"""Card lifecycle HTTP routes: freeze, unfreeze, close, fund, unload, transactions.

Mutating CaaS calls are queued to the Celery worker instead of running in the
request path; the API only creates the idempotent operation record and enqueues
the external call.
"""

import contextlib
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

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


class BillingAddress(BaseModel):
    line1: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None


class CardDetails(BaseModel):
    card_id: UUID
    masked_pan: str | None = None
    last_four: str | None = None
    holder: str | None = None
    expiry_month: str | None = None
    expiry_year: str | None = None
    cvv: str | None = None
    currency: str
    status: str
    billing_address: BillingAddress | None = None


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
    key = idempotency_key or f"{kind}-{card.id}-{uuid4()}"
    try:
        record = await get_or_create_operation(db, operation_key=key, operation_kind=kind, path=f"/cards/{card.id}/{kind}", payload=payload)
    except IntegrityError:
        await db.rollback()
        record = await get_or_create_operation(db, operation_key=key, operation_kind=kind, path=f"/cards/{card.id}/{kind}", payload=payload)
    if record.status != "processing" or record.response:
        return LifecycleResponse(card_id=card.id, status=card.status, operation_status=record.status, order_id=record.provider_order_id)
    if card.is_demo:
        operation_status = await _execute_demo_lifecycle(db, card, record, kind, key)
        return LifecycleResponse(card_id=card.id, status=card.status, operation_status=operation_status, order_id=None)
    if kind in {"freeze", "unfreeze", "close"}:
        # 2328 answers these synchronously (200 with the card) — no worker hop needed.
        operation_status = await _execute_real_lifecycle(db, card, record, kind, key)
        return LifecycleResponse(card_id=card.id, status=card.status, operation_status=operation_status, order_id=record.provider_order_id)
    if kind == "fund":
        from flytopay.ledger.service import LedgerError, reserve_wallet

        amount = payload.get("amountMinor")
        try:
            await reserve_wallet(db, card.user_id, int(amount), external_key=f"fund:{key}")
        except (LedgerError, TypeError, ValueError) as exc:
            await save_operation_response(db, record, status="failed", response={"error": "wallet_insufficient_balance"})
            await db.commit()
            raise HTTPException(status_code=402, detail="wallet.insufficient_balance") from exc
    await db.commit()
    _enqueue_task(key, str(card.id), kind)
    return LifecycleResponse(card_id=card.id, status=card.status, operation_status="processing", order_id=None)


async def _execute_real_lifecycle(db: AsyncSession, card: UserCard, record, kind: str, key: str) -> str:
    from flytopay.integrations.caas2328.client import CaaSError

    caas = CaaSClient()
    if not caas.is_configured:
        raise HTTPException(status_code=503, detail="caas.not_configured")
    try:
        if kind == "freeze":
            response = await caas.freeze_card(card.provider_card_id, idempotency_key=key)
        elif kind == "unfreeze":
            response = await caas.unfreeze_card(card.provider_card_id, idempotency_key=key)
        else:
            response = await caas.close_card(card.provider_card_id, idempotency_key=key)
    except CaaSError as exc:
        await save_operation_response(db, record, status="failed", response={"error": exc.code, "status": exc.status})
        await db.commit()
        # card.frozen on freeze / card.invalid_state etc. are business errors, not outages.
        raise HTTPException(status_code=409 if exc.status in {409, 422} else 502, detail=exc.code or "provider.error") from exc
    data = response.data
    remote_status = data.get("status")
    if response.status_code == 202 or remote_status in {"pending", "closing"}:
        record.provider_order_id = data.get("orderId") if isinstance(data.get("orderId"), str) else None
        await save_operation_response(db, record, status="processing", response=dict(data))
        await db.commit()
        return "processing"
    if remote_status in {"active", "frozen", "suspended", "closed", "expired"}:
        card.status = remote_status
    else:
        await _apply_terminal_status(db, card, kind)
    await save_operation_response(db, record, status="completed", response=dict(data))
    await db.commit()
    return "completed"


async def _finalize_money_order(db: AsyncSession, card: UserCard, record, kind: str, key: str, order: dict[str, Any]) -> str:
    """Apply a terminal fund/unload order to the wallet and card balance. Idempotent via ledger keys."""
    from flytopay.ledger.service import LedgerError, capture_reservation, credit_wallet, release_reservation

    status = str(order.get("status") or "processing")
    if status == "processing":
        return "processing"
    if kind == "fund":
        try:
            if status == "completed":
                await capture_reservation(db, f"fund:{key}", kind="card_fund")
            else:
                await release_reservation(db, f"fund:{key}")
        except LedgerError:
            pass
    elif kind == "unload" and status == "completed":
        credited = order.get("unloadedMinor") or order.get("amountMinor")
        if isinstance(credited, int) and credited > 0:
            try:
                await credit_wallet(db, card.user_id, credited, external_key=f"unload:{key}", kind="card_unload")
            except LedgerError:
                pass
    caas = CaaSClient()
    if caas.is_configured and card.provider_card_id:
        with contextlib.suppress(RuntimeError, ValueError, OSError):  # balance refresh is best effort
            balance = await caas.card_balance(card.provider_card_id)
            if isinstance(balance.get("availableMinor"), int):
                card.balance_minor = balance["availableMinor"]
    terminal = "completed" if status == "completed" else "failed"
    await save_operation_response(db, record, status=terminal, response=dict(order))
    await db.commit()
    return terminal


async def _apply_terminal_status(db: AsyncSession, card: UserCard, kind: str) -> None:
    if kind == "freeze":
        card.status = "frozen"
    elif kind == "unfreeze":
        card.status = "active"
    elif kind == "close":
        card.status = "closed"


async def _execute_demo_lifecycle(db: AsyncSession, card: UserCard, record, kind: str, operation_key: str) -> str:
    """Demo cards never touch CaaS: lifecycle runs locally with wallet accounting."""
    from datetime import UTC, datetime

    from flytopay.cards.transactions import CardTransactionRecord
    from flytopay.ledger.service import LedgerError, credit_wallet, get_or_create_wallet

    request_payload = record.request_payload or {}
    amount_minor = request_payload.get("amountMinor")
    wallet = await get_or_create_wallet(db, card.user_id)

    def _sync_tx(tx_type: str, value: int, merchant: str | None = None) -> None:
        db.add(
            CardTransactionRecord(
                card_id=card.id,
                type=tx_type,
                status="completed",
                amount_minor=value,
                merchant_name=merchant,
                occurred_at=datetime.now(UTC),
            )
        )

    if kind == "freeze":
        card.status = "frozen"
    elif kind == "unfreeze":
        card.status = "active"
    elif kind == "close":
        card.status = "closed"
    elif kind == "fund":
        if not isinstance(amount_minor, int) or amount_minor <= 0:
            await save_operation_response(db, record, status="failed", response={"error": "invalid_amount"})
            await db.commit()
            return "failed"
        if wallet.available_minor < amount_minor:
            await save_operation_response(db, record, status="failed", response={"error": "insufficient_wallet"})
            await db.commit()
            return "failed"
        wallet.available_minor -= amount_minor
        card.balance_minor = (card.balance_minor or 0) + amount_minor
        _sync_tx("fund", amount_minor, None)
    elif kind == "unload":
        if not isinstance(amount_minor, int) or amount_minor <= 0:
            await save_operation_response(db, record, status="failed", response={"error": "invalid_amount"})
            await db.commit()
            return "failed"
        if (card.balance_minor or 0) < amount_minor:
            await save_operation_response(db, record, status="failed", response={"error": "insufficient_card_balance"})
            await db.commit()
            return "failed"
        card.balance_minor = (card.balance_minor or 0) - amount_minor
        try:
            await credit_wallet(
                db,
                card.user_id,
                amount_minor,
                external_key=f"unload:{operation_key}",
                kind="card_unload",
            )
        except LedgerError:
            await save_operation_response(db, record, status="failed", response={"error": "duplicate_credit"})
            await db.commit()
            return "failed"
        _sync_tx("refund", amount_minor, None)
    else:
        await save_operation_response(db, record, status="failed", response={"error": "unknown_kind"})
        await db.commit()
        return "failed"
    await save_operation_response(db, record, status="completed", response={"demo": True, "amountMinor": amount_minor})
    await db.commit()
    return "completed"


async def execute_lifecycle(operation_key: str, card_id: str, kind: str) -> str:
    """Worker-side: perform the queued CaaS call and persist its outcome."""
    from flytopay.db.session import session_factory

    async with session_factory() as db:
        result = await db.execute(select(UserCard).where(UserCard.id == UUID(card_id)))
        card = result.scalar_one_or_none()
        if card is None:
            return "failed"
        from flytopay.integrations.caas2328.persistence import CaaSOperationRecord

        record = (
            await db.execute(select(CaaSOperationRecord).where(CaaSOperationRecord.operation_key == operation_key))
        ).scalar_one_or_none()
        if record is None or record.status != "processing":
            return record.status if record else "unknown"
        if card.is_demo:
            return await _execute_demo_lifecycle(db, card, record, kind, operation_key)
        if not card.provider_card_id:
            return "failed"
        caas = CaaSClient()
        if not caas.is_configured:
            return "unconfigured"
        request_payload = record.request_payload or {}
        payload: dict[str, Any] = {}
        if kind in {"fund", "unload"}:
            # FundRequest/UnloadRequest are additionalProperties:false — only documented fields.
            payload = {
                "amountMinor": request_payload.get("amountMinor"),
                "currency": "USD",
                "externalReference": operation_key[:64],
            }
        from flytopay.integrations.caas2328.client import CaaSError

        if kind in {"freeze", "unfreeze", "close"}:
            try:
                return await _execute_real_lifecycle(db, card, record, kind, operation_key)
            except HTTPException:
                return "failed"
        try:
            if record.provider_order_id:
                order = await caas.order(record.provider_order_id)
                order.setdefault("orderId", record.provider_order_id)
            else:
                submit = caas.fund_card if kind == "fund" else caas.unload_card
                response = await submit(card.provider_card_id, payload, idempotency_key=operation_key)
                order = dict(response.data)
                if isinstance(order.get("orderId"), str):
                    record.provider_order_id = order["orderId"]
                    await db.commit()
        except CaaSError as exc:
            if exc.retryable:
                return "processing"
            if kind == "fund":
                from flytopay.ledger.service import LedgerError, release_reservation

                try:
                    await release_reservation(db, f"fund:{operation_key}")
                except LedgerError:
                    pass
            await save_operation_response(db, record, status="failed", response={"error": exc.code})
            await db.commit()
            return "failed"
        return await _finalize_money_order(db, card, record, kind, operation_key, order)


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
    if not card.is_demo:
        from flytopay.integrations.caas2328.limits import get_limits

        limits = await get_limits()
        if payload.amount_minor < limits.min_fund_minor:
            raise HTTPException(status_code=422, detail=f"funding.below_minimum:{limits.min_fund_minor}")
        if payload.amount_minor > limits.max_fund_minor:
            raise HTTPException(status_code=422, detail=f"amount.exceeds_maximum:{limits.max_fund_minor}")
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
    if not card.is_demo:
        from flytopay.integrations.caas2328.limits import get_limits

        limits = await get_limits()
        if payload.amount_minor < limits.min_unload_minor:
            raise HTTPException(status_code=422, detail=f"funding.below_minimum:{limits.min_unload_minor}")
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


@router.get("/{card_id}/details", response_model=CardDetails)
async def card_details(
    card_id: UUID,
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CardDetails:
    """Reveal sensitive card details for the owner.

    Real cards: proxied from the CaaS provider. Demo cards: derived from the
    stored protected cardholder payload when available, otherwise generated
    deterministically from the card id so the UI can be exercised end-to-end.
    """
    card = await _owned_card(db, user_id, card_id)
    holder = None
    address: BillingAddress | None = None

    if card.is_demo:
        from flytopay.issuance.models import IssuanceRequest
        from flytopay.security.sealed import open_json

        request = (
            await db.execute(
                select(IssuanceRequest)
                .where(IssuanceRequest.user_id == user_id)
                .order_by(IssuanceRequest.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        payload: dict[str, Any] = {}
        if request is not None:
            try:
                payload = open_json(request.protected_cardholder)
            except RuntimeError:
                payload = {}
        first = str(payload.get("first_name") or "Flytopay")
        last = str(payload.get("last_name") or "User")
        holder = f"{first} {last}".upper()
        if payload.get("address"):
            address = BillingAddress(
                line1=str(payload.get("address")),
                city=str(payload.get("city") or "") or None,
                state=str(payload.get("state") or "") or None,
                postal_code=str(payload.get("zip_code") or "") or None,
                country=str(payload.get("country") or "") or None,
            )
        else:
            address = BillingAddress(line1="350 Fifth Avenue", city="New York", state="NY", postal_code="10118", country="US")
    else:
        caas = CaaSClient()
        if not caas.is_configured or not card.provider_card_id:
            raise HTTPException(status_code=503, detail="CaaS API is not configured for this card")
        try:
            remote = await caas.card_details(card.provider_card_id)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="CaaS card details unavailable") from exc
        holder = str(remote.get("cardholderName") or remote.get("holder") or "").upper() or None
        remote_address = remote.get("billingAddress") if isinstance(remote.get("billingAddress"), dict) else None
        if remote_address:
            address = BillingAddress(
                line1=remote_address.get("line1") or remote_address.get("address"),
                city=remote_address.get("city"),
                state=remote_address.get("state"),
                postal_code=remote_address.get("zip") or remote_address.get("postalCode"),
                country=remote_address.get("country"),
            )

    month, year = _demo_expiry(card.id)
    return CardDetails(
        card_id=card.id,
        masked_pan=card.masked_pan,
        last_four=card.last_four,
        holder=holder,
        expiry_month=month,
        expiry_year=year,
        cvv=_demo_cvv(card.id) if card.is_demo else None,
        currency=card.currency,
        status=card.status,
        billing_address=address,
    )


def _demo_expiry(card_id: UUID) -> tuple[str, str]:
    value = card_id.int % (12 * 100)
    return f"{value % 12 + 1:02d}", f"{value % 100 + 26:02d}"


def _demo_cvv(card_id: UUID) -> str:
    return f"{card_id.int % 1000:03d}"


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
