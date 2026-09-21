from httpx import ASGITransport, AsyncClient

from flytopay.main import app


async def test_webhook_requires_event_id() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/platega", json={"type": "payment.updated"})
    assert response.status_code == 400


async def test_unknown_provider_is_rejected() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/unknown", headers={"X-Event-Id": "evt-1"}, json={})
    assert response.status_code == 404
