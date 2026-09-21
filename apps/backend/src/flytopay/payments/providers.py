from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class CheckoutRequest:
    amount_minor: int
    currency: str
    scale: int
    correlation_id: str
    return_url: str


@dataclass(frozen=True)
class CheckoutResponse:
    provider_payment_id: str
    checkout_url: str


class PaymentProvider(Protocol):
    name: str

    async def create_checkout(self, request: CheckoutRequest, *, idempotency_key: str) -> CheckoutResponse: ...

    async def get_payment(self, provider_payment_id: str) -> dict: ...


class DisabledProvider:
    def __init__(self, name: str) -> None:
        self.name = name

    async def create_checkout(self, request: CheckoutRequest, *, idempotency_key: str) -> CheckoutResponse:
        raise RuntimeError(f"Payment provider {self.name} is not configured")

    async def get_payment(self, provider_payment_id: str) -> dict:
        raise RuntimeError(f"Payment provider {self.name} is not configured")


class TelegramStarsProvider:
    name = "telegram_stars"

    def __init__(self, bot_token: str | None = None) -> None:
        self.bot_token = bot_token

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token)

    async def create_checkout(self, request: CheckoutRequest, *, idempotency_key: str) -> CheckoutResponse:
        raise RuntimeError("Telegram Stars invoice client is not enabled")

    async def get_payment(self, provider_payment_id: str) -> dict:
        raise RuntimeError("Telegram Stars is update-authoritative")
