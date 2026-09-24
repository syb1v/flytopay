from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class ReferralSetting(Timestamped, Base):
    __tablename__ = "referral_settings"
    id: Mapped[UUID] = uuid_column()
    commission_bps: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    minimum_payout_minor: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    is_enabled: Mapped[bool] = mapped_column(default=False, server_default="false")


class ReferralLink(Timestamped, Base):
    __tablename__ = "referral_links"
    id: Mapped[UUID] = uuid_column()
    referrer_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    referred_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    code: Mapped[str] = mapped_column(String(128), unique=True)
    status: Mapped[str] = mapped_column(String(24), default="active", server_default="active")


class ReferralLedgerEntry(Timestamped, Base):
    __tablename__ = "referral_ledger"
    id: Mapped[UUID] = uuid_column()
    referrer_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    referred_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(24), default="accrued", server_default="accrued")
    source_payment_id: Mapped[UUID | None] = mapped_column(ForeignKey("payment_attempts.id", ondelete="SET NULL"))


class PayoutRequest(Timestamped, Base):
    __tablename__ = "referral_payout_requests"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
