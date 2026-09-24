"""Persistent operational controls used by the admin platform."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class FeatureFlag(Timestamped, Base):
    __tablename__ = "feature_flags"

    id: Mapped[UUID] = uuid_column()
    key: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str | None] = mapped_column(String(512))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    config: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")


class SystemSetting(Timestamped, Base):
    __tablename__ = "system_settings"

    id: Mapped[UUID] = uuid_column()
    key: Mapped[str] = mapped_column(String(128), unique=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    description: Mapped[str | None] = mapped_column(String(512))
    is_public_business_setting: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class AdminIdempotencyKey(Base):
    __tablename__ = "admin_idempotency_keys"

    id: Mapped[UUID] = uuid_column()
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    key_hash: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(128))
    response: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class AdminJob(Timestamped, Base):
    __tablename__ = "admin_jobs"

    id: Mapped[UUID] = uuid_column()
    kind: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="pending", server_default="pending")
    payload: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(default=0, server_default="0")


class AdminErrorEvent(Base):
    __tablename__ = "admin_error_events"

    id: Mapped[UUID] = uuid_column()
    source: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(24), default="error", server_default="error")
    message: Mapped[str] = mapped_column(Text)
    correlation_id: Mapped[str | None] = mapped_column(String(255))
    context: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
