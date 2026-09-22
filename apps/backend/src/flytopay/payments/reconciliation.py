"""Payment reconciliation worker: retry finalize for reconcile_required attempts."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.db.session import session_factory
from flytopay.logging_config import get_logger
from flytopay.payments.finalization import FinalizationError, finalize_payment
from flytopay.payments.models import PaymentAttempt
from flytopay.payments.service import PaymentService

logger = get_logger(__name__)

MAX_ATTEMPT_AGE = timedelta(hours=24)
DEAD_LETTER_THRESHOLD = 10


async def reconciliation_candidates(db: AsyncSession, *, limit: int = 20) -> list[PaymentAttempt]:
    """Attempts stuck in reconcile_required or provider_unknown without terminal resolution."""
    cutoff = datetime.now(UTC) - MAX_ATTEMPT_AGE
    result = await db.execute(
        select(PaymentAttempt)
        .where(
            PaymentAttempt.status.in_(["reconcile_required", "provider_unknown"]),
            PaymentAttempt.provider_payment_id.is_not(None),
        )
        .order_by(PaymentAttempt.updated_at.desc())
        .limit(limit)
    )
    return [attempt for attempt in result.scalars() if attempt.created_at >= cutoff]


async def reconcile_stale_attempts(*, limit: int = 20) -> dict[str, int]:
    """Retry remote verification for stale attempts; report per-outcome counts."""
    service = PaymentService()
    counts = {"retried": 0, "finalized": 0, "still_pending": 0, "failed": 0}
    async with session_factory() as db:
        candidates = await reconciliation_candidates(db, limit=limit)
        counts["retried"] = len(candidates)
        for attempt in candidates:
            provider_client = service.providers.get(attempt.provider)
            if provider_client is None:
                continue
            try:
                result = await finalize_payment(db, provider_client, attempt.id)
            except (FinalizationError, RuntimeError, ValueError):
                counts["failed"] += 1
                continue
            if result.credited or result.attempt.status == "finalized":
                counts["finalized"] += 1
            else:
                counts["still_pending"] += 1
    return counts


def reconciliation_failure_count(payload: dict) -> int:
    """Metadata helper: how many times finalize has failed for a stored event."""
    value = payload.get("_finalize_failures")
    return value if isinstance(value, int) else 0


def is_dead_letter(payload: dict) -> bool:
    return reconciliation_failure_count(payload) >= DEAD_LETTER_THRESHOLD


def register_celery_task(celery_app) -> None:
    """Register the periodic reconciliation task without touching the entrypoint."""

    @celery_app.task(name="flytopay.payments.reconcile")
    def reconcile_task() -> str:
        import asyncio

        return str(asyncio.run(reconcile_stale_attempts()))

    return reconcile_task


__all__ = [
    "MAX_ATTEMPT_AGE",
    "UUID",
    "is_dead_letter",
    "reconcile_stale_attempts",
    "reconciliation_candidates",
    "register_celery_task",
]
