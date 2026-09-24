from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class RefundRequest(Timestamped, Base):
    __tablename__ = "refund_requests"
    id: Mapped[UUID] = uuid_column()
    payment_attempt_id: Mapped[UUID] = mapped_column(ForeignKey("payment_attempts.id", ondelete="RESTRICT"))
    requested_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending")
    provider_ref: Mapped[str | None] = mapped_column(String(255))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
