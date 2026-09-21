"""Platega HTTP adapter. POST requests are never retried blindly."""

from decimal import Decimal
from typing import Any

import httpx

from flytopay.config import get_settings
from flytopay.payments.http import payment_http
from flytopay.payments.providers import CheckoutRequest, CheckoutResponse


class PlategaClient:
    name = "platega"

    def __init__(self, *, client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self.base_url = settings.platega_base_url.rstrip("/")
        self.merchant_id = settings.platega_merchant_id
        self.secret = settings.platega_secret
        self.client = client

    @property
    def is_configured(self) -> bool:
        return bool(self.merchant_id and self.secret)

    @staticmethod
    def _amount(request: CheckoutRequest) -> int | str:
        if request.currency not in {"USD", "RUB"} or request.scale != 2 or request.amount_minor <= 0:
            raise ValueError("Invalid Platega amount or currency")
        if request.currency == "RUB" and request.amount_minor % 100:
            raise ValueError("Platega RUB amount must contain whole rubles")
        value = Decimal(request.amount_minor) / (Decimal(10) ** request.scale)
        return int(value) if request.currency == "RUB" else format(value, "f")

    async def create_checkout(self, request: CheckoutRequest, *, idempotency_key: str) -> CheckoutResponse:
        if not self.is_configured:
            raise RuntimeError("Platega is not configured")
        payload: dict[str, Any] = {
            "paymentMethod": 2,
            "paymentDetails": {"amount": self._amount(request), "currency": request.currency},
            "return": request.return_url,
            "payload": request.correlation_id,
        }
        headers = {"X-MerchantId": self.merchant_id or "", "X-Secret": self.secret or "", "Content-Type": "application/json"}
        async with payment_http(self.client) as client:
            response = await client.post(f"{self.base_url}/transaction/process", json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        remote_id = str(data.get("transactionId") or data.get("id") or data.get("uuid") or "")
        checkout_url = str(data.get("redirect") or data.get("paymentUrl") or data.get("url") or "")
        if not remote_id or not checkout_url:
            raise RuntimeError("Platega response is missing payment identity")
        return CheckoutResponse(provider_payment_id=remote_id, checkout_url=checkout_url)

    async def get_payment(self, provider_payment_id: str) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("Platega is not configured")
        headers = {"X-MerchantId": self.merchant_id or "", "X-Secret": self.secret or ""}
        async with payment_http(self.client) as client:
            response = await client.get(f"{self.base_url}/transaction/{provider_payment_id}", headers=headers)
        response.raise_for_status()
        return response.json()
