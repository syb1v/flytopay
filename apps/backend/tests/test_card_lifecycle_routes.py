"""Tests for card lifecycle routes and issuance prices."""

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from flytopay.main import app


@pytest.mark.asyncio
async def test_lifecycle_routes_require_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        card_id = uuid4()
        assert (await client.post(f"/api/v1/cards/{card_id}/freeze")).status_code == 401
        assert (await client.post(f"/api/v1/cards/{card_id}/unfreeze")).status_code == 401
        assert (await client.post(f"/api/v1/cards/{card_id}/close")).status_code == 401
        assert (await client.get(f"/api/v1/cards/{card_id}/transactions")).status_code == 401


@pytest.mark.asyncio
async def test_prices_route_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/issuance/prices")
        assert response.status_code == 401


def test_transaction_mapping_handles_camel_case() -> None:
    from flytopay.cards.lifecycle_routes import _transaction

    card = type("Card", (), {"currency": "USD", "scale": 2})()
    item = {
        "id": "tx-1",
        "type": "settlement",
        "status": "completed",
        "amountMinor": 1299,
        "feeMinor": 50,
        "currency": "USD",
        "scale": 2,
        "merchantName": "TEST MERCHANT",
        "occurredAt": "2026-07-01T10:11:12+00:00",
        "authorizationCode": "012345",
    }
    result = _transaction(item, card)
    assert result.amount_minor == 1299
    assert result.fee_minor == 50
    assert result.merchant_name == "TEST MERCHANT"
    assert result.authorization_code == "012345"
    assert result.occurred_at is not None
    assert result.decline_code is None
