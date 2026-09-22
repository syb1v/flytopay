"""CaaS webhook ingestion with HMAC authentication and event deduplication."""

import hashlib
import hmac
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError

from flytopay.config import get_settings
from flytopay.db.session import session_factory
from flytopay.integrations.caas2328.lifecycle import normalize_webhook
from flytopay.payments.models import PaymentProviderEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks/caas", tags=["Webhooks"])


def _signature_valid(raw_body: bytes, received: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def receive_caas_webhook(
    request: Request,
    x_caas_signature: Annotated[str | None, Header(alias="X-Caas-Signature")] = None,
    x_caas_event_id: Annotated[str | None, Header(alias="X-Caas-Event-Id")] = None,
    x_caas_event: Annotated[str | None, Header(alias="X-Caas-Event")] = None,
) -> dict[str, object]:
    settings = get_settings()
    secret = settings.caas_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="CaaS webhook authentication is not configured")
    raw_body = await request.body()
    if not x_caas_signature or not _signature_valid(raw_body, x_caas_signature, secret):
        raise HTTPException(status_code=401, detail="Invalid CaaS webhook signature")

    payload: dict[str, Any] = await request.json()
    headers = {"x-caas-event": x_caas_event or "", "x-caas-event-id": x_caas_event_id or ""}
    event = normalize_webhook(payload, headers)

    deduplication_key = event.event_id or x_caas_event_id or ""
    if not deduplication_key:
        raise HTTPException(status_code=400, detail="Event identifier is required")

    async with session_factory() as db:
        stored = PaymentProviderEvent(
            provider="caas",
            deduplication_key=deduplication_key,
            event_type=event.raw_event or event.event.value,
            payload=payload,
            processing_status="received",
        )
        db.add(stored)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return {"success": True, "status": 202, "data": {"accepted": True, "duplicate": True}}
    if event.actionable:
        # Card state synchronization is worker-driven; ingestion is intentionally
        # decoupled so provider retries never block on processing.
        logger.info("caas_webhook_accepted", extra={"event": event.event.value, "event_id": deduplication_key})
    return {"success": True, "status": 202, "data": {"accepted": True, "duplicate": False}}
