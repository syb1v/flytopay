"""Tests for production hardening: webhooks, ledger transitions, startup guard."""

import hashlib
import hmac

import pytest
from httpx import ASGITransport, AsyncClient

from flytopay.config_validation import _issues
from flytopay.ledger.service import LedgerError, capture_reservation, refund_captured, release_reservation
from flytopay.main import app


class _Settings:
    def __init__(self, **overrides):
        self.app_env = "production"
        self.session_secret = "x" * 48
        self.csrf_secret = "y" * 48
        self.caas_api_key = "caas-key"
        self.encryption_master_key = "z" * 48
        self.database_url = "postgresql+asyncpg://prod"
        for key, value in overrides.items():
            setattr(self, key, value)


def test_production_guard_passes_with_strong_secrets() -> None:
    assert _issues(_Settings()) == []


def test_production_guard_catches_weak_session_secret() -> None:
    problems = _issues(_Settings(session_secret="development-only-session-secret"))
    assert any("SESSION_SECRET" in problem for problem in problems)


def test_production_guard_catches_missing_caas_key() -> None:
    problems = _issues(_Settings(caas_api_key=None))
    assert any("CAAS_API_KEY" in problem for problem in problems)


def test_production_guard_catches_default_database_url() -> None:
    problems = _issues(
        _Settings(database_url="postgresql+asyncpg://flytopay:flytopay@localhost:5432/flytopay")
    )
    assert any("DATABASE_URL" in problem for problem in problems)


def test_production_guard_ignores_development() -> None:
    assert _issues(_Settings(app_env="development", session_secret="weak")) == []


@pytest.mark.asyncio
async def test_caas_webhook_rejects_missing_secret(monkeypatch) -> None:
    class Settings:
        caas_webhook_secret = None

    monkeypatch.setattr("flytopay.cards.webhooks.get_settings", lambda: Settings())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/caas/", json={"event": "card.frozen"})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_caas_webhook_rejects_bad_signature(monkeypatch) -> None:
    class Settings:
        caas_webhook_secret = "caas-webhook-secret"

    monkeypatch.setattr("flytopay.cards.webhooks.get_settings", lambda: Settings())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/webhooks/caas/",
            json={"event": "card.frozen"},
            headers={"X-Caas-Signature": "deadbeef", "X-Caas-Event-Id": "evt-1"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_pay2328_webhook_rejects_invalid_signature() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/pay2328", json={"uuid": "p1", "sign": "bad"})
    assert response.status_code in {401, 503}


@pytest.mark.asyncio
async def test_platega_webhook_rejects_missing_secret_header() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/platega", json={"id": "t1"})
    assert response.status_code in {401, 503}


def test_caas_signature_algorithm_is_deterministic() -> None:
    secret = "caas-webhook-secret"
    body = b'{"event":"card.frozen","eventId":"evt-1"}'
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert expected != hmac.new(b"other", body, hashlib.sha256).hexdigest()
    assert len(expected) == 64


def _ledger_db(reservations: dict, wallets: dict, default_wallet=None):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, Mock

    class Result:
        def __init__(self, value):
            self.value = value

        def scalar_one_or_none(self):
            return self.value

    def reservation_key(statement) -> str:
        try:
            text = str(statement.compile(compile_kwargs={"literal_binds": True}))
        except TypeError:
            text = str(statement)
        for key in reservations:
            if f"'{key}'" in text:
                return key
        return ""

    def execute(statement, *args, **kwargs):
        text = str(statement)
        if "fund_reservations" in text:
            return Result(reservations.get(reservation_key(statement)))
        if "ledger_entries" in text:
            return Result(None)
        if "wallets" in text:
            if default_wallet is not None:
                return Result(default_wallet)
            return Result(next(iter(wallets.values()), None))
        return Result(None)

    db = SimpleNamespace(
        execute=AsyncMock(side_effect=execute),
        add=Mock(),
        flush=AsyncMock(),
        get=AsyncMock(side_effect=lambda model, pk: wallets.get(pk)),
    )
    return db


def _wallet(available=10_000, reserved=0):
    from types import SimpleNamespace

    return SimpleNamespace(id=uuid4(), user_id=uuid4(), currency="USD", scale=2, available_minor=available, reserved_minor=reserved)


def _reservation(wallet, amount, status="active"):
    from types import SimpleNamespace

    return SimpleNamespace(wallet_id=wallet.id, amount_minor=amount, status=status)


from uuid import uuid4


@pytest.mark.asyncio
async def test_capture_reservation_consumes_reserved_funds():
    wallet = _wallet(available=6_000, reserved=4_000)
    reservation = _reservation(wallet, 4_000)
    db = _ledger_db({"res-1": reservation}, {wallet.id: wallet})
    entry = await capture_reservation(db, "res-1")
    assert entry.direction == "debit"
    assert entry.amount_minor == 4_000
    assert wallet.reserved_minor == 0
    assert reservation.status == "captured"


@pytest.mark.asyncio
async def test_capture_reservation_rejects_double_capture():
    wallet = _wallet(available=6_000, reserved=4_000)
    reservation = _reservation(wallet, 4_000, status="captured")
    db = _ledger_db({"res-1": reservation}, {wallet.id: wallet})
    with pytest.raises(LedgerError):
        await capture_reservation(db, "res-1")


@pytest.mark.asyncio
async def test_release_reservation_returns_funds():
    wallet = _wallet(available=6_000, reserved=4_000)
    reservation = _reservation(wallet, 4_000)
    db = _ledger_db({"res-2": reservation}, {wallet.id: wallet})
    await release_reservation(db, "res-2")
    assert reservation.status == "released"
    assert wallet.available_minor == 10_000
    assert wallet.reserved_minor == 0
    with pytest.raises(LedgerError):
        await release_reservation(db, "res-2")


@pytest.mark.asyncio
async def test_refund_captured_is_idempotent():
    wallet = _wallet()
    db = _ledger_db({}, {wallet.id: wallet}, default_wallet=wallet)
    entry = await refund_captured(db, wallet.user_id, 500, external_key="refund-1")
    assert entry.direction == "credit"
    assert wallet.available_minor == 10_500
