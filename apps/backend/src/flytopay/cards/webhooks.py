"""CaaS webhook ingestion: caas_v1 signature verification, dedup, and state sync.

Signature (2328 CaaS, mode caas_v1):
    X-Caas-Signature: t=<unix>,v1=<hex>
    signingKey    = hex(SHA256(webhookSecret))           # lowercase hex STRING
    signedPayload = f"{t}.{rawBody}"
    expected      = hex(HMAC_SHA256(signingKey, signedPayload))
    |now - t| <= 300s
"""

import hashlib
import hmac
import time
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from flytopay.config import get_settings
from flytopay.db.session import session_factory
from flytopay.logging_config import get_logger
from flytopay.payments.models import PaymentProviderEvent

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/webhooks/caas", tags=["Webhooks"])

SIGNATURE_TOLERANCE_SECONDS = 300

_STATUS_EVENTS = {
    "card.frozen": "frozen",
    "card.unfrozen": "active",
    "card.suspended": "suspended",
    "card.closed": "closed",
    "card.expired": "expired",
    "card.created": "active",
}


def parse_signature_header(header: str) -> tuple[int, str] | None:
    parts: dict[str, str] = {}
    for chunk in header.split(","):
        key, sep, value = chunk.strip().partition("=")
        if sep:
            parts[key.strip()] = value.strip()
    try:
        return int(parts["t"]), parts["v1"]
    except (KeyError, ValueError):
        return None


def compute_signature(secret: str, timestamp: int, raw_body: bytes) -> str:
    signing_key = hashlib.sha256(secret.encode()).hexdigest()
    message = f"{timestamp}.".encode() + raw_body
    return hmac.new(signing_key.encode(), message, hashlib.sha256).hexdigest()


def signature_valid(header: str | None, raw_body: bytes, secret: str, *, now: float | None = None) -> bool:
    if not header:
        return False
    parsed = parse_signature_header(header)
    if parsed is None:
        return False
    timestamp, received = parsed
    if abs((now if now is not None else time.time()) - timestamp) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    return hmac.compare_digest(compute_signature(secret, timestamp, raw_body), received.lower())


async def apply_caas_event(db, event: str, data: dict[str, Any]) -> bool:
    """Project a CaaS event onto the local card row. Returns True when a card changed."""
    from flytopay.cards.models import UserCard

    if event in {"card.created", "card.failed"} and isinstance(data.get("orderId"), str):
        from flytopay.cards.issuance import apply_issue_order

        order = {"orderId": data["orderId"], "status": "completed" if event == "card.created" else "failed", "cardId": data.get("cardId")}
        return await apply_issue_order(db, order) not in {"unknown", "processing"}

    card_id = data.get("cardId")
    if not isinstance(card_id, str) or not card_id:
        return False
    card = (await db.execute(select(UserCard).where(UserCard.provider_card_id == card_id))).scalar_one_or_none()
    if card is None:
        return False
    changed = False
    new_status = _STATUS_EVENTS.get(event)
    if new_status and card.status != new_status and not (event == "card.closed" and card.status == "closing"):
        card.status = new_status
        changed = True
    if event == "card.created":
        last4 = data.get("last4")
        if isinstance(last4, str) and last4:
            card.last_four = last4
            card.masked_pan = f"•••• •••• •••• {last4}"
            changed = True
    if event in {"card.funded", "card.unloaded", "card.closed"}:
        from flytopay.integrations.caas2328.client import CaaSClient

        caas = CaaSClient()
        if caas.is_configured:
            try:
                balance = await caas.card_balance(card_id)
                available = balance.get("availableMinor", balance.get("amountMinor"))
                if isinstance(available, int):
                    card.balance_minor = available
                    changed = True
            except (RuntimeError, ValueError, OSError):
                logger.warning("caas_balance_refresh_failed", card_id=card_id)
    if event == "card.closed":
        from flytopay.integrations.caas2328.persistence import CaaSOperationRecord
        from flytopay.ledger.service import LedgerError, credit_wallet

        record = (await db.execute(select(CaaSOperationRecord).where(CaaSOperationRecord.operation_kind == "close", CaaSOperationRecord.request_payload["cardId"].as_string() == str(card.id)).order_by(CaaSOperationRecord.created_at.desc()).limit(1))).scalar_one_or_none()
        credited = data.get("residualCreditedMinor")
        if record and (not record.provider_order_id or (record.response or {}).get("status") == "completed") and isinstance(credited, int) and not isinstance(credited, bool) and credited > 0:
            try:
                await credit_wallet(db, card.user_id, credited, external_key=f"close:{record.operation_key}", kind="card_unload")
            except LedgerError as exc:
                if str(exc) != "Ledger entry already exists":
                    raise
        if record and record.provider_order_id and (record.response or {}).get("status") != "completed":
            record.response = {**(record.response or {}), "closedConfirmed": True}
            changed = True
        else:
            card.status = "closed"
            card.balance_minor = 0
            changed = True
    return changed


async def _receive(request: Request, x_caas_signature: str | None, x_caas_event_id: str | None, x_caas_event: str | None, x_caas_test: str | None) -> dict[str, object]:
    secret = get_settings().caas_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="CaaS webhook authentication is not configured")
    raw_body = await request.body()
    if not signature_valid(x_caas_signature, raw_body, secret):
        raise HTTPException(status_code=401, detail="Invalid CaaS webhook signature")

    payload: dict[str, Any] = await request.json()
    event = str(payload.get("event") or x_caas_event or "unknown")
    event_id = str(payload.get("eventId") or x_caas_event_id or "")
    if not event_id:
        raise HTTPException(status_code=400, detail="Event identifier is required")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    is_test = x_caas_test == "1" or bool(data.get("test")) or event_id.startswith("test-") or event == "webhook.test"

    async with session_factory() as db:
        stored = PaymentProviderEvent(provider="caas", deduplication_key=event_id, event_type=event, payload=payload, processing_status="received")
        db.add(stored)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return {"success": True, "data": {"accepted": True, "duplicate": True}}
        if is_test:
            stored.processing_status = "test"
            await db.commit()
            return {"success": True, "data": {"accepted": True, "test": True}}
        try:
            changed = await apply_caas_event(db, event, data)
            stored.processing_status = "processed" if changed else "ignored"
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("caas_webhook_projection_failed", caas_event=event, event_id=event_id)
    logger.info("caas_webhook_accepted", caas_event=event, event_id=event_id)
    return {"success": True, "data": {"accepted": True, "duplicate": False}}


@router.post("", status_code=status.HTTP_200_OK)
async def receive_caas_webhook(
    request: Request,
    x_caas_signature: Annotated[str | None, Header(alias="X-Caas-Signature")] = None,
    x_caas_event_id: Annotated[str | None, Header(alias="X-Caas-Event-Id")] = None,
    x_caas_event: Annotated[str | None, Header(alias="X-Caas-Event")] = None,
    x_caas_test: Annotated[str | None, Header(alias="X-Caas-Test")] = None,
) -> dict[str, object]:
    return await _receive(request, x_caas_signature, x_caas_event_id, x_caas_event, x_caas_test)


@router.post("/", status_code=status.HTTP_200_OK, include_in_schema=False)
async def receive_caas_webhook_slash(
    request: Request,
    x_caas_signature: Annotated[str | None, Header(alias="X-Caas-Signature")] = None,
    x_caas_event_id: Annotated[str | None, Header(alias="X-Caas-Event-Id")] = None,
    x_caas_event: Annotated[str | None, Header(alias="X-Caas-Event")] = None,
    x_caas_test: Annotated[str | None, Header(alias="X-Caas-Test")] = None,
) -> dict[str, object]:
    return await _receive(request, x_caas_signature, x_caas_event_id, x_caas_event, x_caas_test)
