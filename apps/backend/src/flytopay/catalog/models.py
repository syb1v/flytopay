"""Versioned prices and fee policies for card products."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class ProductPrice(Timestamped, Base):
    __tablename__ = "product_prices"
    __table_args__ = (UniqueConstraint("product_id", "term_days", "currency", "effective_from", name="uq_product_price_version"),)

    id: Mapped[UUID] = uuid_column()
    product_id: Mapped[UUID] = mapped_column(ForeignKey("card_products.id", ondelete="CASCADE"))
    term_days: Mapped[int] = mapped_column(Integer)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    fee_minor: Mapped[int] = mapped_column(BigInteger, default=0)
    currency: Mapped[str] = mapped_column(String(3))
    scale: Mapped[int] = mapped_column(Integer, default=2)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class FeePolicy(Timestamped, Base):
    __tablename__ = "fee_policies"

    id: Mapped[UUID] = uuid_column()
    product_id: Mapped[UUID] = mapped_column(ForeignKey("card_products.id", ondelete="CASCADE"), unique=True)
    issue_fee_minor: Mapped[int] = mapped_column(BigInteger, default=0)
    fund_fee_bps: Mapped[int] = mapped_column(Integer, default=0)
    unload_fee_bps: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    scale: Mapped[int] = mapped_column(Integer, default=2)
