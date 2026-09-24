"""Persistent marketing entities used by the admin platform."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class Campaign(Timestamped, Base):
    __tablename__ = "marketing_campaigns"

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(String(160))
    start_parameter: Mapped[str] = mapped_column(String(128), unique=True)
    source: Mapped[str | None] = mapped_column(String(128))
    channel: Mapped[str | None] = mapped_column(String(128))
    budget_minor: Mapped[int | None] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CampaignEvent(Base):
    __tablename__ = "marketing_campaign_events"

    id: Mapped[UUID] = uuid_column()
    campaign_id: Mapped[UUID] = mapped_column(ForeignKey("marketing_campaigns.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    event: Mapped[str] = mapped_column(String(48))
    revenue_minor: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class PromoGroup(Timestamped, Base):
    __tablename__ = "promo_groups"

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class PromoCode(Timestamped, Base):
    __tablename__ = "promo_codes"
    __table_args__ = (UniqueConstraint("code", name="uq_promo_codes_code"),)

    id: Mapped[UUID] = uuid_column()
    code: Mapped[str] = mapped_column(String(64))
    group_id: Mapped[UUID | None] = mapped_column(ForeignKey("promo_groups.id", ondelete="SET NULL"))
    discount_bps: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bonus_minor: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    max_redemptions: Mapped[int | None] = mapped_column(Integer)
    max_redemptions_per_user: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    redemptions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PromoRedemption(Base):
    __tablename__ = "promo_redemptions"
    __table_args__ = (UniqueConstraint("promo_code_id", "user_id", name="uq_promo_redemption_user"),)

    id: Mapped[UUID] = uuid_column()
    promo_code_id: Mapped[UUID] = mapped_column(ForeignKey("promo_codes.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    discount_minor: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    currency: Mapped[str] = mapped_column(String(3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
