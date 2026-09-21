from uuid import UUID

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class PaymentAttempt(Timestamped, Base):
    __tablename__ = "payment_attempts"
    __table_args__ = (
        UniqueConstraint("provider", "idempotency_key", name="uq_payment_attempts_provider_idempotency"),
        UniqueConstraint("provider", "provider_payment_id", name="uq_payment_attempts_provider_payment"),
    )
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    provider: Mapped[str] = mapped_column(String(32))
    purpose: Mapped[str] = mapped_column(String(48))
    status: Mapped[str] = mapped_column(String(32), default="creating")
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    scale: Mapped[int] = mapped_column(Integer)
    idempotency_key: Mapped[str] = mapped_column(String(255))
    correlation_id: Mapped[str] = mapped_column(String(255))
    provider_payment_id: Mapped[str | None] = mapped_column(String(255))
    checkout_url: Mapped[str | None] = mapped_column(String(2048))
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    last_error_code: Mapped[str | None] = mapped_column(String(96))


class PaymentProviderEvent(Timestamped, Base):
    __tablename__ = "payment_provider_events"
    __table_args__ = (UniqueConstraint("provider", "deduplication_key", name="uq_payment_events_provider_dedup"),)
    id: Mapped[UUID] = uuid_column()
    provider: Mapped[str] = mapped_column(String(32))
    deduplication_key: Mapped[str] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(96))
    payload: Mapped[dict] = mapped_column(JSON)
    processing_status: Mapped[str] = mapped_column(String(24), default="received")
