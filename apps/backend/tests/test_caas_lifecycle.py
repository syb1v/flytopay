import httpx

from flytopay.config import get_settings
from flytopay.integrations.caas2328 import (
    CaaSCardLifecycleService,
    CaaSClient,
    CardEvent,
    OperationStatus,
    normalize_operation,
    normalize_webhook,
)


def test_normalizers_preserve_unknown_values_and_test_events():
    operation = normalize_operation({"orderId": "order-1", "status": "provider_future"}, http_status=200)
    assert operation.status is OperationStatus.UNKNOWN
    event = normalize_webhook(
        {"event": "card.future", "eventId": "test-123", "data": {"test": True, "cardId": "card-1"}}
    )
    assert event.event is CardEvent.UNKNOWN
    assert event.is_test is True
    assert event.actionable is False


async def test_lifecycle_client_uses_mock_http_and_handles_202(monkeypatch):
    monkeypatch.setenv("CAAS_API_KEY", "ck_test")
    get_settings.cache_clear()
    seen: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/fund"):
            return httpx.Response(202, json={"success": True, "status": 202, "data": {"orderId": "o-1", "status": "processing"}})
        if request.url.path.endswith("/orders/o-1"):
            return httpx.Response(202, json={"success": True, "status": 202, "data": {"orderId": "o-1", "status": "processing"}})
        raise AssertionError(request.url)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        service = CaaSCardLifecycleService(CaaSClient(http))
        result = await service.fund("card-1", {"amountMinor": 500, "currency": "USD"}, idempotency_key="fund-1")
        polled = await service.order("o-1")

    assert result.status is OperationStatus.PROCESSING
    assert result.order_id == "o-1"
    assert polled.status is OperationStatus.PROCESSING
    assert seen[0].url.path.endswith("/cards/card-1/fund")
    assert seen[0].headers["Idempotency-Key"] == "fund-1"
    assert seen[0].headers["Authorization"] == "Bearer ck_test"


async def test_client_covers_reads_and_lifecycle_paths(monkeypatch):
    monkeypatch.setenv("CAAS_API_KEY", "ck_test")
    get_settings.cache_clear()
    paths: list[str] = []

    def respond(request: httpx.Request) -> httpx.Response:
        paths.append(request.method + " " + request.url.path)
        return httpx.Response(200, json={"success": True, "status": 200, "data": {"status": "active", "cardId": "c-1"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = CaaSClient(http)
        await client.card_details("c-1")
        await client.card_balance("c-1")
        await client.freeze_card("c-1")
        await client.unfreeze_card("c-1")
        await client.close_card("c-1", idempotency_key="close-1")

    assert paths == [
        "GET /caas/v1/cards/c-1",
        "GET /caas/v1/cards/c-1/balance",
        "POST /caas/v1/cards/c-1/freeze",
        "POST /caas/v1/cards/c-1/unfreeze",
        "DELETE /caas/v1/cards/c-1",
    ]
