"""Provider-authoritative payment finalization and wallet reservation boundary."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.ledger.models import FundsReservation, LedgerEntry
from flytopay.ledger.service import LedgerError, credit_wallet, reserve_wallet
from flytopay.payments.models import PaymentAttempt, ReconciliationCase
from flytopay.payments.providers import PaymentProvider

SUCCESS_STATUSES = frozenset({"paid", "succeeded", "successful", "completed"})


@dataclass(frozen=True)
class FinalizationResult:
    attempt: PaymentAttempt
    credited: bool
    reconciliation_case: ReconciliationCase | None = None


class FinalizationError(ValueError):
    pass


def _provider_value(payload: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in payload:
            return payload[name]
    return None


async def _case_for_mismatch(
    db: AsyncSession, attempt: PaymentAttempt, *, reason: str, provider_status: str | None
) -> ReconciliationCase:
    result = await db.execute(
        select(ReconciliationCase).where(
            ReconciliationCase.payment_attempt_id == attempt.id,
            ReconciliationCase.case_type == "payment_mismatch",
        )
    )
    case = result.scalar_one_or_none()
    if case is None:
        case = ReconciliationCase(
            payment_attempt_id=attempt.id,
            case_type="payment_mismatch",
            reason=reason,
            provider_status=provider_status,
        )
        db.add(case)
    return case


async def finalize_payment(
    db: AsyncSession,
    provider: PaymentProvider,
    payment_attempt_id: UUID,
) -> FinalizationResult:
    """Verify a payment remotely, then credit exactly once in the local transaction."""
    locked = await db.execute(select(PaymentAttempt).where(PaymentAttempt.id == payment_attempt_id).with_for_update())
    attempt = locked.scalar_one_or_none()
    if attempt is None:
        raise FinalizationError("Payment attempt does not exist")
    if attempt.status == "finalized":
        return FinalizationResult(attempt=attempt, credited=False)
    if not attempt.provider_payment_id:
        raise FinalizationError("Payment attempt has no provider payment id")

    remote = await provider.get_payment(attempt.provider_payment_id)
    status = str(_provider_value(remote, "status", "state") or "unknown").lower()
    if status not in SUCCESS_STATUSES:
        attempt.status = "provider_" + status[:22]
        await db.commit()
        return FinalizationResult(attempt=attempt, credited=False)

    remote_id = _provider_value(remote, "provider_payment_id", "payment_id", "id")
    remote_amount = _provider_value(remote, "amount_minor", "amount")
    remote_currency = _provider_value(remote, "currency")
    if remote_id is not None and str(remote_id) != attempt.provider_payment_id:
        reason = "Provider payment id differs from the payment attempt"
    elif remote_amount is not None and int(remote_amount) != attempt.amount_minor:
        reason = "Provider amount differs from the payment attempt"
    elif remote_currency is not None and str(remote_currency).upper() != attempt.currency:
        reason = "Provider currency differs from the payment attempt"
    else:
        reason = None
    if reason is not None:
        attempt.status = "reconcile_required"
        case = await _case_for_mismatch(db, attempt, reason=reason, provider_status=status)
        await db.commit()
        return FinalizationResult(attempt=attempt, credited=False, reconciliation_case=case)

    external_key = f"payment:{attempt.provider}:{attempt.provider_payment_id}"
    existing = await db.execute(select(LedgerEntry).where(LedgerEntry.external_key == external_key))
    if existing.scalar_one_or_none() is None:
        await credit_wallet(db, attempt.user_id, attempt.amount_minor, external_key=external_key, kind="payment")
        credited = True
    else:
        credited = False
    attempt.status = "finalized"
    await db.commit()
    return FinalizationResult(attempt=attempt, credited=credited)


async def reserve_payment_funds(
    db: AsyncSession, user_id: UUID, amount_minor: int, *, external_key: str
) -> FundsReservation:
    """Reserve wallet funds using the existing row-locking ledger service."""
    existing = await db.execute(select(FundsReservation).where(FundsReservation.external_key == external_key))
    reservation = existing.scalar_one_or_none()
    if reservation is not None:
        if reservation.amount_minor != amount_minor:
            raise LedgerError("Reservation key conflicts with an existing reservation")
        return reservation
    return await reserve_wallet(db, user_id, amount_minor, external_key=external_key)
