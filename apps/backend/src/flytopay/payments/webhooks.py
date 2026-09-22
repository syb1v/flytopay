from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError

from flytopay.config import get_settings
from flytopay.db.session import session_factory
from flytopay.payments.finalization import finalize_payment
from flytopay.payments.models import PaymentProviderEvent
from flytopay.payments.service import PaymentService

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])


def _platega_authenticated(secret: str | None, received: str | None) -> bool:
    return bool(secret and received and secret == received)


def _pay2328_authenticated(service: PaymentService, payload: dict) -> bool:
    provider = service.providers.get("pay2328")
    if provider is None:
        return False
    verify = getattr(provider, "verify_webhook", None)
    return bool(verify and verify(payload))


@router.post("/{provider}", status_code=status.HTTP_202_ACCEPTED)
async def receive_provider_webhook(
    provider: str,
    request: Request,
    x_event_id: Annotated[str | None, Header()] = None,
    x_secret: Annotated[str | None, Header(alias="X-Secret")] = None,
    x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    if provider not in {"platega", "pay2328", "telegram_stars"}:
        raise HTTPException(status_code=404, detail="Unknown provider")
    settings = get_settings()
    payload = await request.json()
    if provider == "telegram_stars":
        expected = settings.telegram_webhook_secret
        if not expected or x_telegram_bot_api_secret_token != expected:
            raise HTTPException(status_code=503, detail="Webhook authentication is not configured")
    elif provider == "platega":
        if not _platega_authenticated(settings.platega_secret, x_secret):
            raise HTTPException(status_code=401, detail="Invalid Platega webhook secret")
    else:
        service = PaymentService()
        if not _pay2328_authenticated(service, payload):
            raise HTTPException(status_code=401, detail="Invalid Pay2328 webhook signature")
    deduplication_key = x_event_id or str(payload.get("id") or payload.get("event_id") or "")
    if not deduplication_key:
        raise HTTPException(status_code=400, detail="Event identifier is required")
    async with session_factory() as db:
        event = PaymentProviderEvent(provider=provider, deduplication_key=deduplication_key, event_type=str(payload.get("type", "unknown")), payload=payload)
        db.add(event)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return {"success": True, "status": 202, "data": {"accepted": True, "duplicate": True}}
        # Provider-specific remote verification/finalization is dispatched after the
        # event is durably stored. Event payload alone never credits a wallet.
        payment_id = payload.get("providerPaymentId") or payload.get("paymentId") or payload.get("id")
        if payment_id:
            from sqlalchemy import select

            from flytopay.payments.models import PaymentAttempt
            attempt = (await db.execute(select(PaymentAttempt).where(PaymentAttempt.provider == provider, PaymentAttempt.provider_payment_id == str(payment_id)))).scalar_one_or_none()
            if attempt is not None:
                provider_client = PaymentService().providers.get(provider)
                if provider_client is not None:
                    try:
                        await finalize_payment(db, provider_client, attempt.id)
                        event.processing_status = "processed"
                    except (RuntimeError, ValueError):
                        # Durably record the failure so the reconciliation worker
                        # retries instead of the error being silently swallowed.
                        await db.rollback()
                        failures = int((event.payload or {}).get("_finalize_failures") or 0) + 1
                        event.payload = {**(event.payload or {}), "_finalize_failures": failures}
                        event.processing_status = "finalize_failed"
                    await db.commit()
    return {"success": True, "status": 202, "data": {"accepted": True, "duplicate": False}}
