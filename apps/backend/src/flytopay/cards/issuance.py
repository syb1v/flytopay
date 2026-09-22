"""Real card issuance against 2328 CaaS.

Flow (wallet-funded):
    1. reserve totalChargeMinor in the user's Flytopay wallet
    2. ensure a CaaS cardholder (idempotent by externalRef = "user-<uuid>")
    3. POST /cards (202 → orderId), create local UserCard(status="issuing")
    4. finalize from GET /orders/{orderId} (Celery poller) or card.created/card.failed webhook:
       completed → capture reservation, card active; failed/refunded → release reservation.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.cards.models import CardProduct, UserCard
from flytopay.integrations.caas2328.client import CaaSClient, CaaSError
from flytopay.issuance.models import IssuanceRequest
from flytopay.ledger.service import LedgerError, capture_reservation, release_reservation, reserve_wallet
from flytopay.logging_config import get_logger
from flytopay.security.sealed import open_json

logger = get_logger(__name__)

TERMINAL_OK = "completed"
TERMINAL_FAIL = frozenset({"failed", "refunded"})


class IssuanceError(Exception):
    def __init__(self, code: str, status: int = 422) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


def _reservation_key(request: IssuanceRequest) -> str:
    return f"issue:{request.id}"


def name_on_card(first: str, last: str) -> str:
    raw = f"{first} {last}".upper()
    cleaned = re.sub(r"[^A-Z0-9 .-]", "", raw).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)[:26]
    return cleaned if len(cleaned) >= 2 else "FLYTOPAY USER"


def cardholder_payload(user_id: UUID, provider_code: str, holder: dict[str, Any]) -> dict[str, Any]:
    return {
        "externalRef": f"user-{user_id}",
        "providerCode": provider_code,
        "firstName": str(holder["first_name"])[:64],
        "lastName": str(holder["last_name"])[:64],
        "email": str(holder["email"])[:254],
        "phone": str(holder["phone"]),
        "dateOfBirth": str(holder["date_of_birth"]),
        "country": str(holder["country"]).upper()[:2],
        "address": str(holder["address"])[:128],
        "city": str(holder["city"])[:64],
        "state": str(holder["state"])[:64],
        "zipCode": str(holder["zip_code"])[:16],
    }


async def start_issuance(db: AsyncSession, user_id: UUID, issuance_id: UUID, *, caas: CaaSClient | None = None) -> UserCard:
    request = (
        await db.execute(
            select(IssuanceRequest).where(IssuanceRequest.id == issuance_id, IssuanceRequest.user_id == user_id).with_for_update()
        )
    ).scalar_one_or_none()
    if request is None:
        raise IssuanceError("issuance.not_found", 404)
    existing = (await db.execute(select(UserCard).where(UserCard.issue_order_id.is_not(None), UserCard.issue_order_id == request.provider_order_id))).scalar_one_or_none() if request.provider_order_id else None
    if existing is not None:
        return existing
    if request.status not in {"quoted", "awaiting_payment", "failed"}:
        raise IssuanceError("issuance.invalid_state", 409)
    if request.total_charge_minor is None:
        raise IssuanceError("issuance.quote_missing", 409)
    product = (await db.execute(select(CardProduct).where(CardProduct.code == request.product_code))).scalar_one_or_none()
    if product is None or not product.enabled:
        raise IssuanceError("card.product_unknown", 404)
    if not product.provider_code.startswith("core-"):
        raise IssuanceError("card.product_not_issuable", 422)
    caas = caas or CaaSClient()
    if not caas.is_configured:
        raise IssuanceError("caas.not_configured", 503)

    reservation_key = _reservation_key(request)
    try:
        await reserve_wallet(db, user_id, request.total_charge_minor, external_key=reservation_key)
    except LedgerError as exc:
        if "already exists" not in str(exc):
            raise IssuanceError("wallet.insufficient_balance", 402) from exc
    request.status = "issuing"
    await db.commit()

    try:
        holder = open_json(request.protected_cardholder)
        cardholder = await caas.create_cardholder(
            cardholder_payload(user_id, product.provider_code, holder),
            idempotency_key=f"ch-{user_id}-{product.provider_code}",
        )
        cardholder_id = str(cardholder.get("cardholderId") or "")
        if not cardholder_id:
            raise IssuanceError("cardholder.missing_id", 502)
        response = await caas.issue_card_response(
            {
                "cardholderId": cardholder_id,
                "providerCode": product.provider_code,
                "productCode": product.code,
                "initialAmountMinor": request.amount_minor,
                "currency": "USD",
                "nameOnCard": name_on_card(str(holder.get("first_name", "")), str(holder.get("last_name", ""))),
                "externalReference": f"iss-{request.id.hex}"[:64],
            },
            idempotency_key=f"issue-{request.id}",
        )
    except (CaaSError, IssuanceError, RuntimeError) as exc:
        await _fail(db, request, getattr(exc, "code", None) or str(exc))
        if isinstance(exc, CaaSError):
            raise IssuanceError(exc.code or "provider.error", 502 if exc.retryable else 422) from exc
        raise

    order_id = str(response.data.get("orderId") or "")
    request.provider_order_id = order_id or None
    card = UserCard(
        user_id=user_id,
        product_id=product.id,
        status="issuing",
        currency=product.currency,
        scale=2,
        cardholder_id=cardholder_id,
        issue_order_id=order_id or None,
        balance_minor=request.amount_minor,
        is_demo=False,
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)
    if response.data.get("status") and response.data.get("status") != "processing":
        await apply_issue_order(db, response.data)
    return card


async def _fail(db: AsyncSession, request: IssuanceRequest, reason: str) -> None:
    await db.rollback()
    request = (await db.execute(select(IssuanceRequest).where(IssuanceRequest.id == request.id))).scalar_one()
    request.status = "failed"
    try:
        await release_reservation(db, _reservation_key(request))
    except LedgerError:
        pass
    await db.commit()
    logger.warning("caas_issue_failed", issuance_id=str(request.id), reason=reason)


async def apply_issue_order(db: AsyncSession, order: dict[str, Any], *, caas: CaaSClient | None = None) -> str:
    """Apply a terminal issue order (from polling or webhook). Idempotent."""
    order_id = str(order.get("orderId") or "")
    status = str(order.get("status") or "processing")
    if not order_id or status == "processing":
        return "processing"
    card = (await db.execute(select(UserCard).where(UserCard.issue_order_id == order_id))).scalar_one_or_none()
    request = (await db.execute(select(IssuanceRequest).where(IssuanceRequest.provider_order_id == order_id))).scalar_one_or_none()
    if card is None or request is None:
        return "unknown"
    if card.status != "issuing":
        return card.status
    if status == TERMINAL_OK:
        provider_card_id = order.get("cardId")
        if isinstance(provider_card_id, str) and provider_card_id:
            card.provider_card_id = provider_card_id
            await _hydrate_card(card, caas or CaaSClient())
        card.status = "active" if card.status == "issuing" else card.status
        request.status = "issued"
        try:
            await capture_reservation(db, _reservation_key(request), kind="card_issue")
        except LedgerError:
            pass
    elif status in TERMINAL_FAIL:
        card.status = "failed"
        request.status = "failed"
        try:
            await release_reservation(db, _reservation_key(request))
        except LedgerError:
            pass
    await db.commit()
    return card.status


async def _hydrate_card(card: UserCard, caas: CaaSClient) -> None:
    if not caas.is_configured or not card.provider_card_id:
        return
    try:
        details = await caas.card_details(card.provider_card_id)
    except (CaaSError, RuntimeError, OSError):
        return
    last4 = details.get("last4")
    if isinstance(last4, str) and last4:
        card.last_four = last4
    masked = details.get("maskedNumber")
    if isinstance(masked, str) and masked:
        card.masked_pan = masked
    elif card.last_four:
        card.masked_pan = f"•••• •••• •••• {card.last_four}"
    if details.get("status") in {"active", "frozen", "suspended", "closed", "expired"}:
        card.status = details["status"]
    try:
        balance = await caas.card_balance(card.provider_card_id)
        if isinstance(balance.get("availableMinor"), int):
            card.balance_minor = balance["availableMinor"]
    except (CaaSError, RuntimeError, OSError):
        pass


async def poll_pending_issues(db: AsyncSession, *, caas: CaaSClient | None = None, limit: int = 20) -> int:
    caas = caas or CaaSClient()
    if not caas.is_configured:
        return 0
    cards = list(
        (await db.execute(select(UserCard).where(UserCard.status == "issuing", UserCard.issue_order_id.is_not(None)).limit(limit))).scalars()
    )
    done = 0
    for card in cards:
        try:
            order = await caas.order(card.issue_order_id or "")
        except (CaaSError, RuntimeError, OSError):
            continue
        order.setdefault("orderId", card.issue_order_id)
        if await apply_issue_order(db, order, caas=caas) != "processing":
            done += 1
    return done
