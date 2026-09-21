from typing import Any

import httpx

from flytopay.config import get_settings


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
            response = await client.get(f"{self.base_url}{path}", headers=headers, params=params or None)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or payload.get("success") is not True:
                raise RuntimeError("CaaS returned an unsuccessful response")
            return payload.get("data") or {}
        finally:
            if owned:
                await client.aclose()

    async def account_info(self) -> dict[str, Any]:
        return await self._get("/account/info")

    async def products(self) -> list[dict[str, Any]]:
        data = await self._get("/cards/products")
        items = data.get("items", [])
        return items if isinstance(items, list) else []

    async def create_cardholder(self, payload: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        return await self._mutate("/cardholders", payload, idempotency_key)

    async def issue_card(self, payload: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        return await self._mutate("/cards", payload, idempotency_key)

    async def order(self, order_id: str) -> dict[str, Any]:
        return await self._get(f"/orders/{order_id}")

    async def _mutate(self, path: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("CaaS API is not configured")
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json", "Idempotency-Key": idempotency_key}
        owned = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30)
        try:
            response = await client.post(f"{self.base_url}{path}", headers=headers, json=payload)
            response.raise_for_status()
            envelope = response.json()
            if not isinstance(envelope, dict) or envelope.get("success") is not True:
                raise RuntimeError("CaaS returned an unsuccessful response")
            return envelope.get("data") or {}
        finally:
            if owned:
                await client.aclose()
