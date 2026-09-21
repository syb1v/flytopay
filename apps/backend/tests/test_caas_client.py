import httpx

from flytopay.config import get_settings
from flytopay.integrations.caas2328.client import CaaSClient


async def test_caas_products_unwraps_contract(monkeypatch):
    monkeypatch.setenv("CAAS_API_KEY", "ck_test")
    get_settings.cache_clear()

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer ck_test"
        assert request.url.path.endswith("/cards/products")
        return httpx.Response(200, json={"success": True, "status": 200, "data": {"items": [{"code": "vusa", "name": "Visa", "scheme": "visa", "currency": "USD"}]}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        result = await CaaSClient(http).products()
    assert result[0]["code"] == "vusa"
