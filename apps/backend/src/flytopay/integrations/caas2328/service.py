"""Isolated async lifecycle facade; it has no API route dependencies."""

from typing import Any

from .client import CaaSClient, CaaSResponse
from .lifecycle import NormalizedOperation, normalize_operation


class CaaSCardLifecycleService:
    def __init__(self, client: CaaSClient) -> None:
        self.client = client

    async def create_cardholder(self, payload: dict[str, Any], *, idempotency_key: str) -> dict[str, Any]:
        return await self.client.create_cardholder(payload, idempotency_key=idempotency_key)

    async def issue(self, payload: dict[str, Any], *, idempotency_key: str) -> NormalizedOperation:
        response = await self.client.issue_card_response(payload, idempotency_key=idempotency_key)
        return normalize_operation(response.data, http_status=response.status_code)

    async def order(self, order_id: str) -> NormalizedOperation:
        response = await self.client.order_response(order_id)
        return normalize_operation(response.data, http_status=response.status_code)

    async def card_details(self, card_id: str) -> dict[str, Any]:
        return await self.client.card_details(card_id)

    async def balance(self, card_id: str) -> dict[str, Any]:
        return await self.client.card_balance(card_id)

    async def fund(self, card_id: str, payload: dict[str, Any], *, idempotency_key: str) -> NormalizedOperation:
        return self._normalize(await self.client.fund_card(card_id, payload, idempotency_key=idempotency_key))

    async def unload(self, card_id: str, payload: dict[str, Any], *, idempotency_key: str) -> NormalizedOperation:
        return self._normalize(await self.client.unload_card(card_id, payload, idempotency_key=idempotency_key))

    async def freeze(self, card_id: str, *, idempotency_key: str | None = None) -> NormalizedOperation:
        return self._normalize(await self.client.freeze_card(card_id, idempotency_key=idempotency_key))

    async def unfreeze(self, card_id: str, *, idempotency_key: str | None = None) -> NormalizedOperation:
        return self._normalize(await self.client.unfreeze_card(card_id, idempotency_key=idempotency_key))

    async def close(self, card_id: str, *, idempotency_key: str, reason: str | None = None) -> NormalizedOperation:
        return self._normalize(await self.client.close_card(card_id, idempotency_key=idempotency_key, reason=reason))

    @staticmethod
    def _normalize(response: CaaSResponse) -> NormalizedOperation:
        return normalize_operation(response.data, http_status=response.status_code)
