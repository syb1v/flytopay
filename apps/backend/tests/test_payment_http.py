import json

import httpx
import pytest

from flytopay.payments.http import payment_http
from flytopay.payments.pay2328 import Pay2328Client
from flytopay.payments.platega import PlategaClient
from flytopay.payments.providers import CheckoutRequest


async def test_pay2328_sends_exact_decimal_and_documented_return_field():
    captured = []

    def respond(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={"state": 0, "result": {"uuid": "p1", "url": "https://pay.example/p1"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = Pay2328Client(client=http)
        client.api_key, client.project_uuid = "test-secret", "test-project"
        await client.create_checkout(CheckoutRequest(1001, "USD", 2, "order-1", "https://flytopay.net"), idempotency_key="key")
    assert captured[0]["amount"] == "10.01"
    assert captured[0]["url_return"] == "https://flytopay.net"
    assert "return_url" not in captured[0]


async def test_pay2328_rejects_error_envelope_even_with_result():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={
        "state": 1, "result": {"uuid": "p1", "url": "https://pay.example/p1"},
    }))) as http:
        client = Pay2328Client(client=http)
        client.api_key, client.project_uuid = "test-secret", "test-project"
        with pytest.raises(RuntimeError):
            await client.create_checkout(CheckoutRequest(1000, "USD", 2, "order-1", "https://flytopay.net"), idempotency_key="key")


def test_platega_does_not_silently_discard_kopeks():
    with pytest.raises(ValueError):
        PlategaClient._amount(CheckoutRequest(1001, "RUB", 2, "order-1", "https://flytopay.net"))


def test_pay2328_without_secret_rejects_webhook_signed_with_empty_key():
    client = Pay2328Client()
    client.api_key = None
    payload = {"uuid": "p1"}
    payload["sign"] = client.sign_body(client.canonical_json(payload))
    assert not client.verify_webhook(payload)


async def test_owned_http_client_closes_after_failure():
    with pytest.raises(RuntimeError):
        async with payment_http(None) as client:
            assert not client.is_closed
            raise RuntimeError("upstream failed")
    assert client.is_closed


async def test_injected_http_client_stays_open():
    async with httpx.AsyncClient() as injected:
        async with payment_http(injected) as client:
            assert client is injected
        assert not injected.is_closed


async def test_create_timeout_is_not_retried():
    calls = []

    def respond(request):
        calls.append(request)
        raise httpx.ReadTimeout("test timeout", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = Pay2328Client(client=http)
        client.api_key, client.project_uuid = "test-secret", "test-project"
        with pytest.raises(httpx.ReadTimeout):
            await client.create_checkout(CheckoutRequest(1000, "USD", 2, "order-1", "https://flytopay.net"), idempotency_key="key")
    assert len(calls) == 1
