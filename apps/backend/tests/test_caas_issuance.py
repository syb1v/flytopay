"""Issuance flow against a fake CaaS client (no network, no DB)."""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from flytopay.cards import issuance
from flytopay.cards.issuance import cardholder_payload, name_on_card


def test_name_on_card_matches_caas_pattern() -> None:
    import re

    assert re.fullmatch(r"[A-Z0-9 .-]{2,26}", name_on_card("Иван", "Petrov-Smith"))
    assert name_on_card("jean-luc", "o'neil") == "JEAN-LUC ONEIL"
    assert name_on_card("", "") == "FLYTOPAY USER"
    assert len(name_on_card("A" * 40, "B" * 40)) == 26


def test_cardholder_payload_has_only_contract_fields() -> None:
    holder = {
        "first_name": "Ivan", "last_name": "Ivanov", "email": "i@e.com", "phone": "+15551234567",
        "date_of_birth": "1990-05-15", "country": "us", "address": "1 St", "city": "NY", "state": "NY",
        "zip_code": "10001", "product_code": "visa", "amount_minor": 5000,
    }
    body = cardholder_payload(uuid4(), "core-1", holder)
    assert set(body) == {
        "externalRef", "providerCode", "firstName", "lastName", "email", "phone", "dateOfBirth",
        "country", "address", "city", "state", "zipCode",
    }
    assert body["country"] == "US"
    assert body["providerCode"] == "core-1"


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value


@pytest.mark.asyncio
async def test_apply_issue_order_completed_activates_card_and_captures(monkeypatch) -> None:
    card = SimpleNamespace(status="issuing", provider_card_id=None, last_four=None, masked_pan=None, balance_minor=5000)
    request = SimpleNamespace(id=uuid4(), status="issuing")
    results = iter([_Result(card), _Result(request)])

    async def execute(*args, **kwargs):
        return next(results)

    async def commit():
        return None

    captured = []

    async def fake_capture(db, key, kind="capture"):
        captured.append(key)

    async def fake_hydrate(card, caas):
        card.last_four = "4242"

    monkeypatch.setattr(issuance, "capture_reservation", fake_capture)
    monkeypatch.setattr(issuance, "_hydrate_card", fake_hydrate)
    db = SimpleNamespace(execute=execute, commit=commit)
    status = await issuance.apply_issue_order(db, {"orderId": "o1", "status": "completed", "cardId": "caas-1"})
    assert status == "active"
    assert card.provider_card_id == "caas-1"
    assert card.last_four == "4242"
    assert request.status == "issued"
    assert captured == [f"issue:{request.id}"]


@pytest.mark.asyncio
async def test_apply_issue_order_failed_releases_reservation(monkeypatch) -> None:
    card = SimpleNamespace(status="issuing")
    request = SimpleNamespace(id=uuid4(), status="issuing")
    results = iter([_Result(card), _Result(request)])

    async def execute(*args, **kwargs):
        return next(results)

    async def commit():
        return None

    released = []

    async def fake_release(db, key):
        released.append(key)

    monkeypatch.setattr(issuance, "release_reservation", fake_release)
    db = SimpleNamespace(execute=execute, commit=commit)
    assert await issuance.apply_issue_order(db, {"orderId": "o1", "status": "refunded"}) == "failed"
    assert request.status == "failed"
    assert released == [f"issue:{request.id}"]


@pytest.mark.asyncio
async def test_apply_issue_order_processing_is_noop() -> None:
    db = SimpleNamespace()
    assert await issuance.apply_issue_order(db, {"orderId": "o1", "status": "processing"}) == "processing"
