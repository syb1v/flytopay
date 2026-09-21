"""Database models for admin roles, permissions, allowlisting, and audit."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, BigInteger, Boolean, Column, DateTime, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from flytopay.db.base import Base, Timestamped, uuid_column

admin_role_permissions = Table(
    "admin_role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("admin_permissions.id", ondelete="CASCADE"), primary_key=True),
)

admin_user_roles = Table(
    "admin_user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True),
)


class AdminPermission(Timestamped, Base):
    __tablename__ = "admin_permissions"

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str | None] = mapped_column(String(512))
    roles: Mapped[list["AdminRole"]] = relationship(
        secondary=admin_role_permissions, back_populates="permissions"
    )


class AdminRole(Timestamped, Base):
    __tablename__ = "admin_roles"

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(String(64), unique=True)
    description: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    permissions: Mapped[list[AdminPermission]] = relationship(
        secondary=admin_role_permissions, back_populates="roles"
    )


class AdminAllowlistEntry(Timestamped, Base):
    __tablename__ = "admin_allowlist"

    id: Mapped[UUID] = uuid_column()
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("admin_roles.id", ondelete="RESTRICT"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    note: Mapped[str | None] = mapped_column(String(512))
    role: Mapped[AdminRole] = relationship()


class AdminAuditEvent(Base):
    __tablename__ = "admin_audit_events"

    id: Mapped[UUID] = uuid_column()
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(128))
    resource: Mapped[str] = mapped_column(String(128))
    resource_id: Mapped[str | None] = mapped_column(String(128))
    details: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
