from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.payments.models import PaymentAttempt
from flytopay.payments.pay2328 import Pay2328Client
from flytopay.payments.platega import PlategaClient
from flytopay.payments.providers import CheckoutRequest, DisabledProvider, PaymentProvider


class PaymentService:
    def __init__(self, providers: dict[str, PaymentProvider] | None = None) -> None:
        self.providers = providers or {"platega": PlategaClient(), "pay2328": Pay2328Client(), "telegram_stars": DisabledProvider("telegram_stars")}

    async def create_checkout(self, db: AsyncSession, user_id: UUID, *, provider: str, purpose: str, amount_minor: int, currency: str, scale: int, return_url: str, idempotency_key: str) -> PaymentAttempt:
        if amount_minor <= 0:
            raise ValueError("Amount must be positive")
        existing = await db.execute(select(PaymentAttempt).where(PaymentAttempt.provider == provider, PaymentAttempt.idempotency_key == idempotency_key))
        attempt = existing.scalar_one_or_none()
        if attempt is not None:
            if (attempt.user_id != user_id or attempt.amount_minor != amount_minor
                    or attempt.currency != currency.upper() or attempt.scale != scale
                    or attempt.purpose != purpose):
                raise ValueError("Idempotency key conflicts with an existing request")
            return attempt
        provider_client = self.providers.get(provider)
        if provider_client is None:
            raise ValueError("Unsupported payment provider")
        if isinstance(provider_client, DisabledProvider):
            raise TypeError("Payment provider is not configured")
        attempt = PaymentAttempt(user_id=user_id, provider=provider, purpose=purpose, amount_minor=amount_minor, currency=currency.upper(), scale=scale, idempotency_key=idempotency_key, correlation_id=str(uuid4()), status="pending")
        db.add(attempt)
        # The local identity must survive a process crash during provider creation.
        await db.commit()
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
