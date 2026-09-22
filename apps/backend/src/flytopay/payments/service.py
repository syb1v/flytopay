from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.config import get_settings
from flytopay.payments.models import PaymentAttempt
from flytopay.payments.pay2328 import Pay2328Client
from flytopay.payments.platega import PlategaClient
from flytopay.payments.providers import (
    CheckoutRequest,
    DisabledProvider,
    PaymentProvider,
    TelegramStarsProvider,
)


class IdempotencyConflictError(ValueError):
    """Raised when a stored idempotency key belongs to a different request."""


class PaymentService:
    def __init__(self, providers: dict[str, PaymentProvider] | None = None) -> None:
        settings = get_settings()
        self.providers = providers or {
            "platega": PlategaClient(),
            "pay2328": Pay2328Client(),
            "telegram_stars": TelegramStarsProvider(bot_token=settings.telegram_bot_token),
        }

    async def create_checkout(self, db: AsyncSession, user_id: UUID, *, provider: str, purpose: str, amount_minor: int, currency: str, scale: int, return_url: str, idempotency_key: str) -> PaymentAttempt:
        if amount_minor <= 0:
            raise ValueError("Amount must be positive")
        existing = await db.execute(select(PaymentAttempt).where(PaymentAttempt.provider == provider, PaymentAttempt.idempotency_key == idempotency_key))
        attempt = existing.scalar_one_or_none()
        if attempt is not None:
            self._verify_request_matches(attempt, user_id=user_id, purpose=purpose, amount_minor=amount_minor, currency=currency, scale=scale, return_url=return_url)
            return attempt
        provider_client = self.providers.get(provider)
        if provider_client is None:
            raise ValueError("Unsupported payment provider")
        if isinstance(provider_client, DisabledProvider):
            raise TypeError("Payment provider is not configured")
        if isinstance(provider_client, TelegramStarsProvider) and not provider_client.is_configured:
            raise TypeError("Payment provider is not configured")
        attempt = PaymentAttempt(user_id=user_id, provider=provider, purpose=purpose, amount_minor=amount_minor, currency=currency.upper(), scale=scale, idempotency_key=idempotency_key, correlation_id=str(uuid4()), status="pending", metadata_json={"return_url": return_url})
        db.add(attempt)
        # The local identity must survive a process crash during provider creation.
        try:
            await db.commit()
        except IntegrityError:
            # Concurrent request with the same key won the insert; return its record.
            await db.rollback()
            existing = await db.execute(select(PaymentAttempt).where(PaymentAttempt.provider == provider, PaymentAttempt.idempotency_key == idempotency_key))
            winner = existing.scalar_one_or_none()
            if winner is None:
                raise
            self._verify_request_matches(winner, user_id=user_id, purpose=purpose, amount_minor=amount_minor, currency=currency, scale=scale, return_url=return_url)
            return winner
        try:
            remote = await provider_client.create_checkout(CheckoutRequest(amount_minor=amount_minor, currency=currency.upper(), scale=scale, correlation_id=attempt.correlation_id, return_url=return_url), idempotency_key=idempotency_key)
        except Exception as exc:
            attempt.status = "reconcile_required"
            attempt.last_error_code = type(exc).__name__
            await db.commit()
            raise
        attempt.provider_payment_id = remote.provider_payment_id
        attempt.checkout_url = remote.checkout_url
        await db.commit()
        return attempt

    @staticmethod
    def _verify_request_matches(attempt: PaymentAttempt, *, user_id: UUID, purpose: str, amount_minor: int, currency: str, scale: int, return_url: str) -> None:
        stored_return_url = (attempt.metadata_json or {}).get("return_url")
        if (
            attempt.user_id != user_id
            or attempt.amount_minor != amount_minor
            or attempt.currency != currency.upper()
            or attempt.scale != scale
            or attempt.purpose != purpose
            or stored_return_url != return_url
        ):
            raise IdempotencyConflictError("Idempotency key was reused with a different request")
