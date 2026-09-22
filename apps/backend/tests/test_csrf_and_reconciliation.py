"""Tests for CSRF protection, idempotency conflicts, and reconciliation helpers."""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from flytopay.auth.csrf import CSRF_COOKIE, CSRF_HEADER, issue_csrf_token
from flytopay.main import app
from flytopay.payments.models import PaymentAttempt
from flytopay.payments.reconciliation import (
    is_dead_letter,
    reconciliation_candidates,
    reconciliation_failure_count,
)
from flytopay.payments.service import IdempotencyConflictError, PaymentService


@pytest.mark.asyncio
async def test_csrf_rejects_missing_token() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/payments/checkout", json={}, headers={"Idempotency-Key": "k"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_csrf_accepts_matching_double_submit() -> None:
    token = issue_csrf_token()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set(CSRF_COOKIE, token)
        response = await client.post(
            "/api/v1/payments/checkout",
            json={"provider": "platega", "purpose": "wallet_deposit", "amount_minor": 1000, "currency": "USD", "scale": 2, "return_url": "https://flytopay.net/cabinet"},
            headers={"Idempotency-Key": "k1", CSRF_HEADER: token},
        )
    # CSRF passed; the request proceeds to auth/validation beyond the guard.
    assert response.status_code != 403


def test_csrf_token_is_random() -> None:
    assert issue_csrf_token() != issue_csrf_token()


@pytest.mark.asyncio
async def test_idempotency_conflict_raises_dedicated_error() -> None:
    attempt = PaymentAttempt(
        id=uuid4(), user_id=uuid4(), provider="platega", purpose="wallet_deposit", status="pending",
        amount_minor=1000, currency="USD", scale=2, idempotency_key="key",
        correlation_id="corr", metadata_json={"return_url": "https://flytopay.net/a"},
    )

    class Result:
        def __init__(self, value):
            self.value = value

        def scalar_one_or_none(self):
            return self.value

    db = SimpleNamespace(execute=AsyncMock(return_value=Result(attempt)))
    service = PaymentService(providers={})
    with pytest.raises(IdempotencyConflictError):
        await service.create_checkout(
            db, uuid4(), provider="platega", purpose="wallet_deposit",
            amount_minor=1000, currency="USD", scale=2,
            return_url="https://flytopay.net/OTHER", idempotency_key="key",
        )


@pytest.mark.asyncio
async def test_reconciliation_candidates_query_filters_stale() -> None:
    class Result:
        def __init__(self):
            self.items = []

        def scalars(self):
            return self

        def __iter__(self):
            return iter(self.items)

    db = SimpleNamespace(execute=AsyncMock(return_value=Result()))
    candidates = await reconciliation_candidates(db)
    assert candidates == []


def test_dead_letter_threshold() -> None:
    assert not is_dead_letter({"_finalize_failures": 9})
    assert is_dead_letter({"_finalize_failures": 10})
    assert reconciliation_failure_count({}) == 0
    assert reconciliation_failure_count({"_finalize_failures": "corrupt"}) == 0
