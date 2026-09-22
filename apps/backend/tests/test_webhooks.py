from httpx import ASGITransport, AsyncClient

from flytopay.main import app


async def test_unconfigured_platega_webhook_is_rejected() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/platega", json={"type": "payment.updated"})
    assert response.status_code == 401


async def test_unknown_provider_is_rejected() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/webhooks/unknown", headers={"X-Event-Id": "evt-1"}, json={})
    assert response.status_code == 404
