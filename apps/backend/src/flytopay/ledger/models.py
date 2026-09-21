from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class Wallet(Timestamped, Base):
    __tablename__ = "wallets"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    scale: Mapped[int] = mapped_column(Integer, default=2)
    available_minor: Mapped[int] = mapped_column(BigInteger, default=0)
    reserved_minor: Mapped[int] = mapped_column(BigInteger, default=0)


class LedgerEntry(Timestamped, Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (UniqueConstraint("external_key", name="uq_ledger_entries_external_key"),)
    id: Mapped[UUID] = uuid_column()
    wallet_id: Mapped[UUID] = mapped_column(ForeignKey("wallets.id", ondelete="RESTRICT"))
    external_key: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(48))
    direction: Mapped[str] = mapped_column(String(8))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    scale: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(255))


class FundsReservation(Timestamped, Base):
    __tablename__ = "fund_reservations"
    __table_args__ = (UniqueConstraint("external_key", name="uq_fund_reservations_external_key"),)
    id: Mapped[UUID] = uuid_column()
    wallet_id: Mapped[UUID] = mapped_column(ForeignKey("wallets.id", ondelete="RESTRICT"))
    external_key: Mapped[str] = mapped_column(String(255))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(24), default="active")
