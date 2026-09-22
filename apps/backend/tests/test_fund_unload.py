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
