from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class CardProduct(Timestamped, Base):
    __tablename__ = "card_products"
    id: Mapped[UUID] = uuid_column()
    code: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    scheme: Mapped[str] = mapped_column(String(24))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    provider_code: Mapped[str] = mapped_column(String(64))
    enabled: Mapped[bool] = mapped_column(default=False)


class UserCard(Timestamped, Base):
    __tablename__ = "user_cards"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    product_id: Mapped[UUID] = mapped_column(ForeignKey("card_products.id", ondelete="RESTRICT"))
    provider_card_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="issuing")
    masked_pan: Mapped[str | None] = mapped_column(String(32))
    last_four: Mapped[str | None] = mapped_column(String(4))
    balance_minor: Mapped[int | None] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    scale: Mapped[int] = mapped_column(Integer, default=2)
    cardholder_id: Mapped[str | None] = mapped_column(String(128))
    issue_order_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    is_demo: Mapped[bool] = mapped_column(default=False)


class Rental(Timestamped, Base):
    __tablename__ = "rentals"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    card_id: Mapped[UUID] = mapped_column(ForeignKey("user_cards.id", ondelete="RESTRICT"))
    term_days: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    price_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    scale: Mapped[int] = mapped_column(Integer, default=2)
