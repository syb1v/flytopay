"""Local card transaction records (demo cards and wallet-derived history)."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class CardTransactionRecord(Timestamped, Base):
    __tablename__ = "card_transaction_records"

    id: Mapped[UUID] = uuid_column()
    card_id: Mapped[UUID] = mapped_column(ForeignKey("user_cards.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(24))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    fee_minor: Mapped[int] = mapped_column(BigInteger, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    scale: Mapped[int] = mapped_column(Integer, default=2)
    merchant_name: Mapped[str | None] = mapped_column(String(160))
    mcc: Mapped[str | None] = mapped_column(String(8))
    merchant_country: Mapped[str | None] = mapped_column(String(2))
    decline_code: Mapped[str | None] = mapped_column(String(48))
    fee_type: Mapped[str | None] = mapped_column(String(48))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
