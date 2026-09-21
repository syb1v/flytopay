from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from flytopay.payments.finalization import finalize_payment, reserve_payment_funds
from flytopay.payments.models import PaymentAttempt


class FakeProvider:
    name = "fake"

    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.requested_id = None

    async def get_payment(self, provider_payment_id: str) -> dict:
        self.requested_id = provider_payment_id
        return self.payload


class FakeResult:
    def __init__(self, value) -> None:
        self.value = value

    def scalar_one_or_none(self):
        return self.value


def attempt() -> PaymentAttempt:
    return PaymentAttempt(
        id=uuid4(), user_id=uuid4(), provider="fake", purpose="wallet", status="pending",
        amount_minor=1250, currency="USD", scale=2, idempotency_key="key",
        correlation_id="correlation", provider_payment_id="remote-1",
    )


@pytest.mark.asyncio
async def test_finalize_verifies_remote_values_and_credits_once() -> None:
    payment = attempt()
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[FakeResult(payment), FakeResult(None)]),
        commit=AsyncMock(),
    )
    provider = FakeProvider({"id": "remote-1", "status": "paid", "amount_minor": 1250, "currency": "USD"})

    with patch("flytopay.payments.finalization.credit_wallet", new=AsyncMock()) as credit:
        result = await finalize_payment(db, provider, payment.id)

    assert result.credited is True
    assert payment.status == "finalized"
    assert provider.requested_id == "remote-1"
    credit.assert_awaited_once_with(db, payment.user_id, 1250, external_key="payment:fake:remote-1", kind="payment")
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_finalize_creates_reconciliation_case_without_crediting_on_mismatch() -> None:
    payment = attempt()
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[FakeResult(payment), FakeResult(None)]),
        add=Mock(),
        commit=AsyncMock(),
    )
    provider = FakeProvider({"id": "remote-1", "status": "paid", "amount_minor": 999, "currency": "USD"})

    with patch("flytopay.payments.finalization.credit_wallet", new=AsyncMock()) as credit:
        result = await finalize_payment(db, provider, payment.id)

    assert result.credited is False
    assert result.reconciliation_case is not None
    assert payment.status == "reconcile_required"
    credit.assert_not_awaited()
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_reservation_is_idempotent_for_same_key_and_amount() -> None:
    existing = SimpleNamespace(amount_minor=500)
    db = SimpleNamespace(execute=AsyncMock(return_value=FakeResult(existing)))

    with patch("flytopay.payments.finalization.reserve_wallet", new=AsyncMock()) as reserve:
        result = await reserve_payment_funds(db, uuid4(), 500, external_key="reservation:1")

    assert result is existing
    reserve.assert_not_awaited()
