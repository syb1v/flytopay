"""Tests for fund/unload endpoints and worker-side lifecycle execution."""

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from flytopay.main import app


@pytest.mark.asyncio
async def test_fund_requires_csrf_and_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/cards/{uuid4()}/fund", json={"amount_minor": 5000})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unload_requires_csrf_and_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/cards/{uuid4()}/unload", json={"amount_minor": 5000})
    assert response.status_code == 403


def test_enqueue_task_helper_is_importable() -> None:
    from flytopay.cards.lifecycle_routes import LIFECYCLE_KINDS, _enqueue_task

    assert LIFECYCLE_KINDS == {"freeze", "unfreeze", "close", "fund", "unload"}
    assert callable(_enqueue_task)


@pytest.mark.asyncio
async def test_execute_lifecycle_unknown_operation_returns_unknown(monkeypatch) -> None:
    from flytopay.cards.lifecycle_routes import execute_lifecycle

    class Result:
        def __init__(self, value):
            self.value = value

        def scalar_one_or_none(self):
            return self.value

    class FakeDB:
        async def execute(self, statement):
            return Result(None)

    class FakeSessionFactory:
        async def __aenter__(self):
            return FakeDB()

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr("flytopay.db.session.session_factory", lambda: FakeSessionFactory())
    status = await execute_lifecycle("missing-key", str(uuid4()), "freeze")
    assert status == "failed"


@pytest.mark.asyncio
async def test_repeated_lifecycle_actions_use_distinct_default_keys(monkeypatch) -> None:
    from types import SimpleNamespace

    from flytopay.cards import lifecycle_routes

    keys: list[str] = []

    async def fake_get_or_create_operation(db, *, operation_key, **kwargs):
        keys.append(operation_key)
        return SimpleNamespace(status="processing", response=None, provider_order_id=None)

    async def fake_demo(db, card, record, kind, key):
        return "completed"

    monkeypatch.setattr(lifecycle_routes, "get_or_create_operation", fake_get_or_create_operation)
    monkeypatch.setattr(lifecycle_routes, "_execute_demo_lifecycle", fake_demo)
    card = SimpleNamespace(id=uuid4(), provider_card_id="demo-1", is_demo=True, status="active")
    await lifecycle_routes._enqueue_lifecycle(SimpleNamespace(), card, "freeze", None, {})
    await lifecycle_routes._enqueue_lifecycle(SimpleNamespace(), card, "freeze", None, {})
    assert len(set(keys)) == 2
