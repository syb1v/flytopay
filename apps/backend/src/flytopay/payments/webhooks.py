from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError

from flytopay.db.session import session_factory
from flytopay.payments.models import PaymentProviderEvent

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])


@router.post("/{provider}", status_code=status.HTTP_202_ACCEPTED)
async def receive_provider_webhook(
    provider: str,
    request: Request,
    x_event_id: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    if provider not in {"platega", "pay2328", "telegram_stars"}:
        raise HTTPException(status_code=404, detail="Unknown provider")
    payload = await request.json()
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
    return {"success": True, "status": 202, "data": {"accepted": True, "duplicate": False}}
