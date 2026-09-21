"""Pure CaaS card lifecycle value objects and webhook normalization."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class OperationStatus(StrEnum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    UNKNOWN = "unknown"


class CardEvent(StrEnum):
    CREATED = "card.created"
    FUNDED = "card.funded"
    FUNDING_FAILED = "card.funding_failed"
    UNLOADED = "card.unloaded"
    UNLOADING_FAILED = "card.unloading_failed"
    FROZEN = "card.frozen"
    UNFROZEN = "card.unfrozen"
    CLOSED = "card.closed"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class NormalizedOperation:
    status: OperationStatus
    raw_status: str | None
    http_status: int | None
    order_id: str | None
    data: dict[str, Any]

    @property
    def terminal(self) -> bool:
        return self.status in {OperationStatus.COMPLETED, OperationStatus.FAILED, OperationStatus.REFUNDED}


@dataclass(frozen=True, slots=True)
class CardWebhookEvent:
    event: CardEvent
    raw_event: str | None
    event_id: str | None
    data: dict[str, Any]
    is_test: bool

    @property
    def actionable(self) -> bool:
        return not self.is_test and self.event is not CardEvent.UNKNOWN


def _operation_status(raw: object) -> OperationStatus:
    if isinstance(raw, str):
        try:
            return OperationStatus(raw)
        except ValueError:
            pass
    return OperationStatus.UNKNOWN


def normalize_operation(data: Mapping[str, Any], *, http_status: int | None = None) -> NormalizedOperation:
    raw_status = data.get("status") if isinstance(data.get("status"), str) else None
    status = _operation_status(raw_status)
    if http_status == 202 and status is OperationStatus.UNKNOWN:
        status = OperationStatus.PROCESSING
    return NormalizedOperation(
        status=status,
        raw_status=raw_status,
        http_status=http_status,
        order_id=data.get("orderId") if isinstance(data.get("orderId"), str) else None,
        data=dict(data),
    )


def normalize_webhook(payload: Mapping[str, Any], headers: Mapping[str, str] | None = None) -> CardWebhookEvent:
    headers = {key.lower(): value for key, value in (headers or {}).items()}
    raw_event = payload.get("event") if isinstance(payload.get("event"), str) else headers.get("x-caas-event")
    try:
        event = CardEvent(raw_event or "")
    except ValueError:
        event = CardEvent.UNKNOWN
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    event_id = payload.get("eventId") if isinstance(payload.get("eventId"), str) else headers.get("x-caas-event-id")
    is_test = bool(data.get("test")) or headers.get("x-caas-test") == "1" or (event_id or "").startswith("test-")
    return CardWebhookEvent(event, raw_event, event_id, data, is_test)
