from types import SimpleNamespace
from uuid import uuid4

import pytest

from flytopay.cards import lifecycle_routes


@pytest.mark.asyncio
async def test_close_order_credits_confirmed_amount_once(monkeypatch):
    credited = set()

    async def credit_wallet(db, user_id, amount, *, external_key, kind):
        from flytopay.ledger.service import LedgerError

        if external_key in credited:
            raise LedgerError("Ledger entry already exists")
        credited.add(external_key)
        assert amount == 4800
        assert kind == "card_unload"

    async def save(db, record, *, status, response):
        record.status = status
        record.response = response

    monkeypatch.setattr("flytopay.ledger.service.credit_wallet", credit_wallet)
    monkeypatch.setattr(lifecycle_routes, "save_operation_response", save)
    db = SimpleNamespace(commit=lambda: _noop())
    card = SimpleNamespace(user_id=uuid4(), balance_minor=5000, status="closing")
    record = SimpleNamespace(operation_key="close-test", response=None, request_payload={"closeHadBalance": 5000})
    order = {"status": "completed", "creditedMinor": 4800}
    assert await lifecycle_routes.finalize_close_order(db, card, record, order) == "processing"
    assert await lifecycle_routes.finalize_close_order(db, card, record, order) == "processing"
    assert credited == {"close:close-test"}
    assert card.balance_minor == 0


@pytest.mark.asyncio
async def test_close_order_failure_does_not_credit(monkeypatch):
    async def save(db, record, *, status, response):
        record.status = status

    monkeypatch.setattr(lifecycle_routes, "save_operation_response", save)
    db = SimpleNamespace(commit=lambda: _noop())
    card = SimpleNamespace(status="closing", balance_minor=5000)
    record = SimpleNamespace(request_payload={"closeHadBalance": 5000})
    assert await lifecycle_routes.finalize_close_order(db, card, record, {"status": "failed"}) == "failed"
    assert card.balance_minor == 5000
    assert card.status == "active"


@pytest.mark.asyncio
async def test_close_without_balance_completes_synchronously(monkeypatch):
    async def save(db, record, *, status, response):
        record.status = status
        record.response = response

    class Provider:
        is_configured = True

        async def close_card(self, card_id, *, idempotency_key):
            return SimpleNamespace(status_code=200, data={"status": "closed", "residualMinor": 0})

    monkeypatch.setattr(lifecycle_routes, "save_operation_response", save)
    monkeypatch.setattr(lifecycle_routes, "CaaSClient", Provider)
    db = SimpleNamespace(commit=lambda: _noop())
    card = SimpleNamespace(provider_card_id="c-1", balance_minor=0, status="active")
    record = SimpleNamespace(operation_key="close-zero", response=None)
    assert await lifecycle_routes._execute_real_lifecycle(db, card, record, "close", "close-zero") == "completed"
    assert card.status == "closed"
    assert record.status == "completed"


@pytest.mark.asyncio
async def test_poll_close_waits_for_unload_then_hides_card(monkeypatch):
    card = SimpleNamespace(id=uuid4(), provider_card_id="c-1", user_id=uuid4(), balance_minor=5000, status="closing")
    record = SimpleNamespace(operation_key="close-poll", request_payload={"cardId": str(card.id), "closeHadBalance": 5000}, provider_order_id="o-1", response={"status": "processing", "orderId": "o-1"}, status="processing")
    credited = []

    class Result:
        def __init__(self, item):
            self.item = item

        def scalars(self):
            return [self.item]

        def scalar_one_or_none(self):
            return self.item

    async def execute(statement):
        return Result(record if "caas_operation_records" in str(statement) else card)

    async def save(db, item, *, status, response):
        item.status = status
        item.response = response

    async def credit_wallet(db, user_id, amount, *, external_key, kind):
        credited.append((amount, external_key))

    class Provider:
        is_configured = True

        async def order(self, order_id):
            return {"status": "completed", "creditedMinor": 5000}

        async def card_details(self, card_id):
            return {"status": "closed"}

    monkeypatch.setattr(lifecycle_routes, "save_operation_response", save)
    monkeypatch.setattr("flytopay.ledger.service.credit_wallet", credit_wallet)
    db = SimpleNamespace(execute=execute, commit=lambda: _noop())
    assert await lifecycle_routes.poll_pending_closes(db, caas=Provider()) == 1
    assert credited == [(5000, "close:close-poll")]
    assert card.status == "closed"
    assert record.status == "completed"


async def _noop():
    pass
