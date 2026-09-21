from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class IssuanceRequest(Timestamped, Base):
    __tablename__ = "issuance_requests"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    product_code: Mapped[str] = mapped_column(String(64))
    provider_code: Mapped[str] = mapped_column(String(64))
    country: Mapped[str] = mapped_column(String(2))
    term_days: Mapped[int] = mapped_column(Integer)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    fee_minor: Mapped[int | None] = mapped_column(BigInteger)
    total_charge_minor: Mapped[int | None] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    scale: Mapped[int] = mapped_column(Integer, default=2)
    protected_cardholder: Mapped[str] = mapped_column(String(8192))
    status: Mapped[str] = mapped_column(String(32), default="quoted")
    payment_attempt_id: Mapped[UUID | None] = mapped_column(ForeignKey("payment_attempts.id", ondelete="SET NULL"))
    reservation_id: Mapped[UUID | None] = mapped_column(ForeignKey("fund_reservations.id", ondelete="SET NULL"))
    provider_order_id: Mapped[str | None] = mapped_column(String(128))
