"""Administrator notes and tags attached to users."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base, Timestamped, uuid_column


class UserNote(Timestamped, Base):
    __tablename__ = "user_notes"

    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    author_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)


class UserTag(Timestamped, Base):
    __tablename__ = "user_tags"

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(String(64), unique=True)
    color: Mapped[str | None] = mapped_column(String(16))


class UserTagAssignment(Base):
    __tablename__ = "user_tag_assignments"
    __table_args__ = (UniqueConstraint("user_id", "tag_id", name="uq_user_tag_assignment"),)

    id: Mapped[UUID] = uuid_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[UUID] = mapped_column(ForeignKey("user_tags.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
