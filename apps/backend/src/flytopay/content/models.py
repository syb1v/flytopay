"""Admin-managed content, templates, and broadcast records."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class ContentDocument(Timestamped, Base):
    __tablename__ = "content_documents"
    id: Mapped[UUID] = uuid_column()
    kind: Mapped[str] = mapped_column(String(32))
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    locale: Mapped[str] = mapped_column(String(5), default="ru")
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class MessageTemplate(Timestamped, Base):
    __tablename__ = "message_templates"
    id: Mapped[UUID] = uuid_column()
    key: Mapped[str] = mapped_column(String(128), unique=True)
    channel: Mapped[str] = mapped_column(String(24), default="telegram")
    locale: Mapped[str] = mapped_column(String(5), default="ru")
    subject: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Broadcast(Timestamped, Base):
    __tablename__ = "broadcasts"
    id: Mapped[UUID] = uuid_column()
    title: Mapped[str] = mapped_column(String(255))
    channel: Mapped[str] = mapped_column(String(24), default="telegram")
    audience: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="draft", server_default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_count: Mapped[int] = mapped_column(default=0, server_default="0")
    failed_count: Mapped[int] = mapped_column(default=0, server_default="0")


class BroadcastDelivery(Base):
    __tablename__ = "broadcast_deliveries"
    id: Mapped[UUID] = uuid_column()
    broadcast_id: Mapped[UUID] = mapped_column(ForeignKey("broadcasts.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending")
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
