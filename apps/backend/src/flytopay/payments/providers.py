from dataclasses import dataclass
from typing import Protocol

from aiogram import Bot
from aiogram.types import LabeledPrice


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
    """Telegram Stars (XTR) checkout via Bot API invoice links.

    One Star is credited as one unit of the wallet currency; the conversion is
    presented to the user in the UI before payment. Finalization is
    update-authoritative: the successful_payment bot update credits the wallet.
    """

    name = "telegram_stars"

    def __init__(self, bot_token: str | None = None) -> None:
        self.bot_token = bot_token

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token)

    async def create_checkout(self, request: CheckoutRequest, *, idempotency_key: str) -> CheckoutResponse:
        if not self.is_configured:
            raise RuntimeError("Telegram Stars is not configured")
        stars = max(1, round(request.amount_minor / 10**request.scale))
        bot = Bot(self.bot_token or "")
        try:
            link = await bot.create_invoice_link(
                title="Flytopay",
                description=f"Top-up {request.amount_minor / 10**request.scale:.2f} {request.currency}",
                payload=request.correlation_id,
                currency="XTR",
                prices=[LabeledPrice(label="Stars", amount=stars)],
            )
        finally:
            await bot.session.close()
        return CheckoutResponse(provider_payment_id=request.correlation_id, checkout_url=link)

    async def get_payment(self, provider_payment_id: str) -> dict:
        raise RuntimeError("Telegram Stars is update-authoritative")
