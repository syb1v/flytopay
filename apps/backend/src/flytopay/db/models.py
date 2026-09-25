from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from flytopay.db.base import Base, Timestamped, uuid_column


class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[UUID] = uuid_column()
    status: Mapped[str] = mapped_column(String(24), default="active")
    telegram_accounts: Mapped[list["TelegramAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    preferences: Mapped["UserPreference | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class TelegramAccount(Timestamped, Base):
    __tablename__ = "telegram_accounts"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    username: Mapped[str | None] = mapped_column(String(255))
    first_name: Mapped[str | None] = mapped_column(String(255))
    last_name: Mapped[str | None] = mapped_column(String(255))
    user: Mapped[User] = relationship(back_populates="telegram_accounts")


class UserPreference(Timestamped, Base):
    __tablename__ = "user_preferences"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    language: Mapped[str] = mapped_column(String(2), default="ru")
    display_currency: Mapped[str] = mapped_column(String(3), default="USD")
    telegram_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    payment_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    rental_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    user: Mapped[User] = relationship(back_populates="preferences")


class Session(Timestamped, Base):
    __tablename__ = "sessions"
    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
