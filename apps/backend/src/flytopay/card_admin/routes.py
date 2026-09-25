"""Admin views and guarded lifecycle operations for cards and issuances."""

import hashlib
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.cards.lifecycle_routes import _enqueue_lifecycle
from flytopay.cards.models import CardProduct, Rental, UserCard
from flytopay.cards.transactions import CardTransactionRecord
from flytopay.db.models import TelegramAccount, User
from flytopay.db.session import get_db
from flytopay.integrations.caas2328.persistence import CaaSOperationRecord
from flytopay.issuance.models import IssuanceRequest

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Cards"])
ReadCards = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.cards.read"))]
WriteCards = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.cards.write"))]

LIFECYCLE_KINDS = frozenset({"freeze", "unfreeze", "close", "fund", "unload"})


class CardFundPayload(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    amount_minor: int | None = Field(default=None, gt=0, le=100_000_00)


def _safe_card(card: UserCard, product: CardProduct | None, telegram_id: int | None) -> dict[str, Any]:
    return {
        "cardId": str(card.id),
        "userId": str(card.user_id),
        "telegramId": telegram_id,
        "status": card.status,
        "lastFour": card.last_four,
        "isDemo": card.is_demo,
        "currency": card.currency,
        "balanceMinor": card.balance_minor,
        "productCode": product.code if product else None,
        "productName": product.name if product else None,
        "createdAt": card.created_at.isoformat(),
    }


@router.get("/cards/overview")
async def cards_overview(_: ReadCards, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    async def count(*conditions: object) -> int:
        return await db.scalar(select(func.count()).select_from(UserCard).where(*conditions)) or 0

    return {"success": True, "data": {
        "total": await count(),
        "active": await count(UserCard.status == "active"),
        "frozen": await count(UserCard.status == "frozen"),
        "closed": await count(UserCard.status == "closed"),
        "demo": await count(UserCard.is_demo.is_(True)),
        "pendingOperations": await db.scalar(
            select(func.count()).select_from(CaaSOperationRecord).where(CaaSOperationRecord.status == "processing")
        ) or 0,
        "failedOperations": await db.scalar(
            select(func.count()).select_from(CaaSOperationRecord).where(CaaSOperationRecord.status == "failed")
        ) or 0,
    }}


@router.get("/cards")
async def cards(
    _: ReadCards,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query("", max_length=255),
    status: str | None = None,
    is_demo: bool | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    statement = (
        select(UserCard, CardProduct, TelegramAccount.telegram_id)
        .outerjoin(CardProduct, CardProduct.id == UserCard.product_id)
        .outerjoin(TelegramAccount, TelegramAccount.user_id == UserCard.user_id)
    )
    if status:
        statement = statement.where(UserCard.status == status)
    if is_demo is not None:
        statement = statement.where(UserCard.is_demo.is_(is_demo))
    term = q.strip()
    if term:
        try:
            card_uuid = UUID(term)
        except ValueError:
            card_uuid = None
        if card_uuid:
            statement = statement.where(UserCard.id == card_uuid)
        elif term.isdigit():
            statement = statement.where(TelegramAccount.telegram_id == int(term))
        else:
            statement = statement.where(UserCard.last_four == term.lstrip("*")[-4:])
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(UserCard.created_at.desc()).offset((page - 1) * limit).limit(limit))).all()
    return {"success": True, "data": {"items": [_safe_card(card, product, telegram_id) for card, product, telegram_id in rows],
        "total": total, "page": page, "limit": limit}}


@router.get("/cards/{card_id}")
async def card_detail(card_id: UUID, _: ReadCards, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    card = await db.get(UserCard, card_id)
    if card is None:
        raise HTTPException(404, "Card not found")
    product = await db.get(CardProduct, card.product_id)
    telegram_id = await db.scalar(select(TelegramAccount.telegram_id).where(TelegramAccount.user_id == card.user_id))
    rentals = (await db.execute(select(Rental).where(Rental.card_id == card_id).order_by(Rental.created_at.desc()).limit(20))).scalars().all()
    transactions = (await db.execute(select(CardTransactionRecord).where(CardTransactionRecord.card_id == card_id)
                                     .order_by(CardTransactionRecord.occurred_at.desc()).limit(50))).scalars().all()
    operations = (await db.execute(select(CaaSOperationRecord).where(CaaSOperationRecord.operation_kind.in_(LIFECYCLE_KINDS))
                                   .order_by(CaaSOperationRecord.created_at.desc()).limit(50))).scalars().all()
    related_operations = [operation for operation in operations if (operation.request_payload or {}).get("cardId") == str(card_id)][:20]
    user = await db.get(User, card.user_id)
    return {"success": True, "data": {
        **_safe_card(card, product, telegram_id),
        "userStatus": user.status if user else None,
        "rentals": [{"id": str(rental.id), "status": rental.status, "termDays": rental.term_days,
                     "expiresAt": rental.expires_at.isoformat() if rental.expires_at else None,
                     "priceMinor": rental.price_minor, "currency": rental.currency} for rental in rentals],
        "transactions": [{"id": str(record.id), "type": record.type, "status": record.status,
                          "amountMinor": record.amount_minor, "feeMinor": record.fee_minor, "currency": record.currency,
                          "merchantName": record.merchant_name, "occurredAt": record.occurred_at.isoformat()} for record in transactions],
        "operations": [{"id": str(operation.id), "kind": operation.operation_kind, "status": operation.status,
                        "providerOrderId": operation.provider_order_id, "createdAt": operation.created_at.isoformat(),
                        "error": (operation.response or {}).get("error")} for operation in related_operations],
    }}


async def _lifecycle_action(kind: str, card_id: UUID, body: CardFundPayload, request: Request,
                            principal: AdminPrincipal, db: AsyncSession, key: str | None) -> dict[str, object]:
    if not key or len(key) > 255:
        raise HTTPException(400, "Idempotency-Key is required")
    reason = body.reason.strip()
    if len(reason) < 3:
        raise HTTPException(422, "Reason is required")
    card = await db.get(UserCard, card_id)
    if card is None:
        raise HTTPException(404, "Card not found")
    payload: dict[str, Any] = {"cardId": str(card_id)}
    if kind in {"fund", "unload"}:
        if body.amount_minor is None:
            raise HTTPException(422, "amount_minor is required")
        payload["amountMinor"] = body.amount_minor
    try:
        result = await _enqueue_lifecycle(db, card, kind, key, payload)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive boundary for provider errors
        await db.rollback()
        raise HTTPException(502, "Card operation could not be queued") from exc
    key_hash = hashlib.sha256(f"{principal.user_id}:{key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, f"card.{kind}", card_id, reason, key_hash)
    await db.commit()
    return {"success": True, "data": {"cardId": str(card_id), "status": result.status,
                                      "operationStatus": result.operation_status, "orderId": result.order_id}}


@router.post("/cards/{card_id}/freeze", dependencies=[Depends(verify_csrf)])
async def freeze_card(card_id: UUID, body: CardFundPayload, request: Request, principal: WriteCards,
                      db: Annotated[AsyncSession, Depends(get_db)],
                      idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _lifecycle_action("freeze", card_id, body, request, principal, db, idempotency_key)


@router.post("/cards/{card_id}/unfreeze", dependencies=[Depends(verify_csrf)])
async def unfreeze_card(card_id: UUID, body: CardFundPayload, request: Request, principal: WriteCards,
                        db: Annotated[AsyncSession, Depends(get_db)],
                        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _lifecycle_action("unfreeze", card_id, body, request, principal, db, idempotency_key)


@router.post("/cards/{card_id}/close", dependencies=[Depends(verify_csrf)])
async def close_card(card_id: UUID, body: CardFundPayload, request: Request, principal: WriteCards,
                     db: Annotated[AsyncSession, Depends(get_db)],
                     idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _lifecycle_action("close", card_id, body, request, principal, db, idempotency_key)


@router.post("/cards/{card_id}/fund", dependencies=[Depends(verify_csrf)])
async def fund_card(card_id: UUID, body: CardFundPayload, request: Request, principal: WriteCards,
                    db: Annotated[AsyncSession, Depends(get_db)],
                    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _lifecycle_action("fund", card_id, body, request, principal, db, idempotency_key)


@router.post("/cards/{card_id}/unload", dependencies=[Depends(verify_csrf)])
async def unload_card(card_id: UUID, body: CardFundPayload, request: Request, principal: WriteCards,
                      db: Annotated[AsyncSession, Depends(get_db)],
                      idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    return await _lifecycle_action("unload", card_id, body, request, principal, db, idempotency_key)


@router.get("/issuances")
async def issuances(
    _: ReadCards,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Literal["quoted", "pending", "paid", "issued", "failed"] | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    statement = select(IssuanceRequest, TelegramAccount.telegram_id).outerjoin(
        TelegramAccount, TelegramAccount.user_id == IssuanceRequest.user_id)
    if status:
        statement = statement.where(IssuanceRequest.status == status)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(IssuanceRequest.created_at.desc())
                             .offset((page - 1) * limit).limit(limit))).all()
    return {"success": True, "data": {"items": [{
        "issuanceId": str(request.id), "userId": str(request.user_id), "telegramId": telegram_id,
        "productCode": request.product_code, "providerCode": request.provider_code, "termDays": request.term_days,
        "status": request.status, "amountMinor": request.amount_minor,
        "totalChargeMinor": request.total_charge_minor, "currency": request.currency,
        "providerOrderId": request.provider_order_id, "createdAt": request.created_at.isoformat(),
    } for request, telegram_id in rows], "total": total, "page": page, "limit": limit}}


@router.get("/rentals")
async def rentals(
    _: ReadCards,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    statement = select(Rental, TelegramAccount.telegram_id).outerjoin(
        TelegramAccount, TelegramAccount.user_id == Rental.user_id)
    if status:
        statement = statement.where(Rental.status == status)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(Rental.created_at.desc()).offset((page - 1) * limit).limit(limit))).all()
    return {"success": True, "data": {"items": [{
        "id": str(rental.id), "userId": str(rental.user_id), "telegramId": telegram_id,
        "cardId": str(rental.card_id), "status": rental.status, "termDays": rental.term_days,
        "priceMinor": rental.price_minor, "currency": rental.currency,
        "startsAt": rental.starts_at.isoformat() if rental.starts_at else None,
        "expiresAt": rental.expires_at.isoformat() if rental.expires_at else None,
    } for rental, telegram_id in rows], "total": total, "page": page, "limit": limit}}


@router.get("/transactions")
async def transactions(
    _: ReadCards,
    db: Annotated[AsyncSession, Depends(get_db)],
    card_id: UUID | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    statement = select(CardTransactionRecord)
    if card_id:
        statement = statement.where(CardTransactionRecord.card_id == card_id)
    if status:
        statement = statement.where(CardTransactionRecord.status == status)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(CardTransactionRecord.occurred_at.desc())
                             .offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{
        "id": str(record.id), "cardId": str(record.card_id), "type": record.type, "status": record.status,
        "amountMinor": record.amount_minor, "feeMinor": record.fee_minor, "currency": record.currency,
        "merchantName": record.merchant_name, "declineCode": record.decline_code,
        "occurredAt": record.occurred_at.isoformat(),
    } for record in rows], "total": total, "page": page, "limit": limit}}


@router.get("/caas-operations")
async def caas_operations(
    _: ReadCards,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Literal["processing", "completed", "failed"] | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    statement = select(CaaSOperationRecord).where(CaaSOperationRecord.operation_kind.in_(LIFECYCLE_KINDS))
    if status:
        statement = statement.where(CaaSOperationRecord.status == status)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(CaaSOperationRecord.created_at.desc())
                             .offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{
        "id": str(record.id), "kind": record.operation_kind, "status": record.status,
        "providerOrderId": record.provider_order_id, "error": (record.response or {}).get("error"),
        "createdAt": record.created_at.isoformat(),
    } for record in rows], "total": total, "page": page, "limit": limit}}
