from dataclasses import dataclass
from typing import Any

import httpx

from flytopay.config import get_settings


class CaaSError(RuntimeError):
    """Provider error carrying the stable 2328 `error.code` (branch only on this)."""

    def __init__(self, status: int, code: str | None, message: str | None, retry_after: str | None = None) -> None:
        super().__init__(f"CaaS {status} {code or 'unknown'}: {message or ''}".strip())
        self.status = status
        self.code = code
        self.retry_after = retry_after

    @property
    def retryable(self) -> bool:
        return self.status in {408, 429} or self.status >= 500 or self.code == "idempotency.in_progress"


def _raise_for_envelope(response: httpx.Response) -> dict:
    try:
        envelope = response.json()
    except ValueError:
        envelope = None
    if response.status_code >= 400 or not isinstance(envelope, dict) or envelope.get("success") is not True:
        error = (envelope or {}).get("error") if isinstance(envelope, dict) else None
        raise CaaSError(
            response.status_code,
            (error or {}).get("code") if isinstance(error, dict) else None,
            (envelope or {}).get("message") if isinstance(envelope, dict) else None,
            response.headers.get("Retry-After"),
        )
    return envelope


class CaaSClient:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self.base_url = (settings.caas_base_url or "https://api.2328.io/caas/v1").rstrip("/")
        self.api_key = settings.caas_api_key
        self.client = client

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _get(self, path: str, **params: Any) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("CaaS API is not configured")
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        owned = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30)
        try:
            clean = {key: value for key, value in params.items() if value is not None}
            response = await client.get(f"{self.base_url}{path}", headers=headers, params=clean or None)
            return _raise_for_envelope(response).get("data") or {}
        finally:
            if owned:
                await client.aclose()

    async def account_info(self) -> dict[str, Any]:
        return await self._get("/account/info")

    async def products(self) -> list[dict[str, Any]]:
        data = await self._get("/cards/products")
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    async def quote(self, *, operation: str, amount_minor: int, product_code: str | None = None) -> dict[str, Any]:
        return await self._get("/tariffs/quote", operation=operation, amountMinor=amount_minor, productCode=product_code)

    async def create_cardholder(self, payload: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        return await self._mutate("/cardholders", payload, idempotency_key)

    async def issue_card(self, payload: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        return await self._mutate("/cards", payload, idempotency_key)

    async def issue_card_response(self, payload: dict[str, Any], *, idempotency_key: str) -> "CaaSResponse":
        return await self._mutate_response("/cards", payload, idempotency_key)

    async def order(self, order_id: str) -> dict[str, Any]:
        return await self._get(f"/orders/{order_id}")

    async def order_response(self, order_id: str) -> "CaaSResponse":
        return await self._read_response(f"/orders/{order_id}")

    async def card_details(self, card_id: str) -> dict[str, Any]:
        return await self._get(f"/cards/{card_id}")

    async def card_balance(self, card_id: str) -> dict[str, Any]:
        return await self._get(f"/cards/{card_id}/balance")

    async def card_transactions(self, card_id: str, *, limit: int = 50) -> dict[str, Any]:
        return await self._get(f"/cards/{card_id}/transactions", limit=limit)

    async def fund_card(self, card_id: str, payload: dict[str, Any], *, idempotency_key: str) -> "CaaSResponse":
        return await self._mutate_response(f"/cards/{card_id}/fund", payload, idempotency_key)

    async def unload_card(self, card_id: str, payload: dict[str, Any], *, idempotency_key: str) -> "CaaSResponse":
        return await self._mutate_response(f"/cards/{card_id}/unload", payload, idempotency_key)

    async def freeze_card(self, card_id: str, *, idempotency_key: str | None = None) -> "CaaSResponse":
        return await self._mutate_response(f"/cards/{card_id}/freeze", {}, idempotency_key)

    async def unfreeze_card(self, card_id: str, *, idempotency_key: str | None = None) -> "CaaSResponse":
        return await self._mutate_response(f"/cards/{card_id}/unfreeze", {}, idempotency_key)

    async def close_card(self, card_id: str, *, idempotency_key: str, reason: str | None = None) -> "CaaSResponse":
        return await self._mutate_response(f"/cards/{card_id}", {"reason": reason} if reason else {}, idempotency_key, method="DELETE")

    async def _mutate(self, path: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        response = await self._mutate_response(path, payload, idempotency_key)
        return response.data

    async def _mutate_response(
        self,
        path: str,
        payload: dict[str, Any],
        idempotency_key: str | None,
        *,
        method: str = "POST",
    ) -> "CaaSResponse":
        if not self.is_configured:
            raise RuntimeError("CaaS API is not configured")
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        owned = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30)
        try:
            response = await client.request(method, f"{self.base_url}{path}", headers=headers, json=payload)
            envelope = _raise_for_envelope(response)
            return CaaSResponse(status_code=response.status_code, data=envelope.get("data") or {}, envelope=envelope)
        finally:
            if owned:
                await client.aclose()

    async def _read_response(self, path: str) -> "CaaSResponse":
        if not self.is_configured:
            raise RuntimeError("CaaS API is not configured")
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        owned = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30)
        try:
            response = await client.get(f"{self.base_url}{path}", headers=headers)
            envelope = _raise_for_envelope(response)
            return CaaSResponse(response.status_code, envelope.get("data") or {}, envelope)
        finally:
            if owned:
                await client.aclose()


@dataclass(frozen=True, slots=True)
class CaaSResponse:
    status_code: int
    data: dict[str, Any]
    envelope: dict[str, Any]

    @property
    def processing(self) -> bool:
        return self.status_code == 202 or self.data.get("status") == "processing"
