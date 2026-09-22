"""Tests for KYC validation, rate limiting, and correlation IDs."""

from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from flytopay.cards.onboarding import CardholderPayload
from flytopay.main import app


def _payload(**overrides):
    base = {
        "product_code": "premium",
        "amount_minor": 5000,
        "first_name": "Ivan",
        "last_name": "Ivanov",
        "email": "ivan@example.com",
        "phone": "+15551234567",
        "date_of_birth": "1990-05-15",
        "country": "us",
        "address": "350 Fifth Avenue",
        "city": "New York",
        "state": "NY",
        "zip_code": "10118",
    }
    base.update(overrides)
    return base


def test_cardholder_payload_accepts_valid_input():
    payload = CardholderPayload.model_validate(_payload())
    assert payload.country == "US"


def test_cardholder_payload_rejects_invalid_email():
    with pytest.raises(ValidationError):
        CardholderPayload.model_validate(_payload(email="not-an-email"))


def test_cardholder_payload_rejects_underage():
    from datetime import UTC, datetime

    birthday = datetime.now(UTC).date() - timedelta(days=17 * 365)
    with pytest.raises(ValidationError):
        CardholderPayload.model_validate(_payload(date_of_birth=birthday.isoformat()))


def test_cardholder_payload_rejects_future_birth_date():
    from datetime import UTC, datetime

    future = datetime.now(UTC).date() + timedelta(days=365)
    with pytest.raises(ValidationError):
        CardholderPayload.model_validate(_payload(date_of_birth=future.isoformat()))


def test_cardholder_payload_rejects_unsupported_country():
    with pytest.raises(ValidationError):
        CardholderPayload.model_validate(_payload(country="zz"))


def test_cardholder_payload_uppercases_country():
    payload = CardholderPayload.model_validate(_payload(country="gb"))
    assert payload.country == "GB"


@pytest.mark.asyncio
async def test_rate_limit_allows_within_budget(monkeypatch):
    calls = []

    async def fake_limit(scope, identity, *, limit, window_seconds=60):
        calls.append((scope, identity, limit))
        return True

    monkeypatch.setattr("flytopay.auth.routes.rate_limit", fake_limit)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auth/telegram", json={"init_data": "x"})
    assert any(scope == "auth:telegram" for scope, _, _ in calls)
    assert response.status_code in {200, 401, 422}


def test_rate_limit_helper_fails_open_on_redis_error():
    import asyncio

    from flytopay.ratelimit import rate_limit

    # No Redis in the test environment: the helper must fail open.
    assert asyncio.run(rate_limit("test", "id", limit=1)) in {True}
