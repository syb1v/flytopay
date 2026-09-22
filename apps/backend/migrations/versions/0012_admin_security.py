"""Add isolated admin security tables."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012_admin_security"
down_revision = "0011_caas_operation_records"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    uuid_type = postgresql.UUID(as_uuid=True)
    op.create_table(
        "admin_permissions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.String(512)),
        *_timestamps(),
    )
    op.create_table(
        "admin_roles",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("description", sa.String(512)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
    )
    op.create_table(
        "admin_role_permissions",
        sa.Column("role_id", uuid_type, sa.ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", uuid_type, sa.ForeignKey("admin_permissions.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "admin_user_roles",
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", uuid_type, sa.ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "admin_allowlist",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("role_id", uuid_type, sa.ForeignKey("admin_roles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("note", sa.String(512)),
        *_timestamps(),
    )
    op.create_table(
        "admin_audit_events",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("actor_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("resource", sa.String(128), nullable=False),
        sa.Column("resource_id", sa.String(128)),
        sa.Column("details", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("ip_address", sa.String(64)),
        sa.Column("user_agent", sa.String(512)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("admin_audit_events")
    op.drop_table("admin_allowlist")
    op.drop_table("admin_user_roles")
    op.drop_table("admin_role_permissions")
    op.drop_table("admin_roles")
    op.drop_table("admin_permissions")
