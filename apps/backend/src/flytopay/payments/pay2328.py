"""2328 payment adapter with canonical JSON/HMAC signing."""

import base64
import hashlib
import hmac
import json
from decimal import Decimal
from typing import Any

import httpx

from flytopay.config import get_settings
from flytopay.payments.http import payment_http
from flytopay.payments.providers import CheckoutRequest, CheckoutResponse


class Pay2328Client:
    name = "pay2328"

    def __init__(self, *, client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self.base_url = settings.pay2328_base_url.rstrip("/")
        self.api_key = settings.pay2328_api_key
        self.project_uuid = settings.pay2328_project_uuid
        self.client = client

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.project_uuid)

    @staticmethod
    def canonical_json(payload: dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    def sign_body(self, body: str) -> str:
        encoded = base64.b64encode(body.encode())
        return hmac.new((self.api_key or "").encode(), encoded, hashlib.sha256).hexdigest()

    async def create_checkout(self, request: CheckoutRequest, *, idempotency_key: str) -> CheckoutResponse:
        if not self.is_configured:
            raise RuntimeError("Pay2328 is not configured")
        if request.currency not in {"USD", "RUB"} or request.scale != 2 or request.amount_minor <= 0:
            raise ValueError("Invalid Pay2328 amount or currency")
        payload = {"amount": format(Decimal(request.amount_minor) / 100, ".2f"), "currency": request.currency, "order_id": request.correlation_id, "url_return": request.return_url}
        body = self.canonical_json(payload)
        headers = {"Content-Type": "application/json", "project": self.project_uuid or "", "sign": self.sign_body(body), "Idempotency-Key": idempotency_key}
        async with payment_http(self.client) as client:
            response = await client.post(f"{self.base_url}/v1/payment", content=body, headers=headers)
        response.raise_for_status()
        result = self._result(response)
        remote_id = str(result.get("uuid") or "")
        checkout_url = str(result.get("url") or "")
        if not remote_id or not checkout_url:
            raise RuntimeError("Pay2328 response is missing payment identity")
        return CheckoutResponse(provider_payment_id=remote_id, checkout_url=checkout_url)

    async def get_payment(self, provider_payment_id: str) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("Pay2328 is not configured")
        payload = {"uuid": provider_payment_id}
        body = self.canonical_json(payload)
        headers = {"Content-Type": "application/json", "project": self.project_uuid or "", "sign": self.sign_body(body)}
        async with payment_http(self.client) as client:
            response = await client.post(f"{self.base_url}/v1/payment/info", content=body, headers=headers)
        response.raise_for_status()
        return self._result(response)

    @staticmethod
    def _result(response: httpx.Response) -> dict[str, Any]:
        envelope = response.json()
        if not isinstance(envelope, dict) or envelope.get("state") not in (0, "0"):
            raise RuntimeError("Pay2328 rejected the request")
        result = envelope.get("result")
        if not isinstance(result, dict):
            raise RuntimeError("Pay2328 returned an invalid result")  # noqa: TRY004 -- upstream protocol error
        return result

    def verify_webhook(self, payload: dict[str, Any]) -> bool:
        if not self.api_key:
            return False
        received = str(payload.get("sign") or "").lower()
        unsigned = {key: value for key, value in payload.items() if key != "sign"}
        return bool(received) and hmac.compare_digest(self.sign_body(self.canonical_json(unsigned)), received)
