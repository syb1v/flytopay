from httpx import ASGITransport, AsyncClient

from flytopay.main import app


async def test_live_health_does_not_require_dependencies() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"


async def test_versioned_live_health_is_available() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health/live")

    assert response.status_code == 200
