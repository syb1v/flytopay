"""Add operational controls for the full admin platform."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016_admin_platform_foundation"
down_revision = "0015_product_details"
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
        "feature_flags", sa.Column("id", uuid_type, primary_key=True),
        sa.Column("key", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.String(512)), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("config", sa.JSON(), nullable=False, server_default=sa.text("'{}'")), *_timestamps(),
    )
    op.create_table(
        "system_settings", sa.Column("id", uuid_type, primary_key=True),
        sa.Column("key", sa.String(128), nullable=False, unique=True), sa.Column("value", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("description", sa.String(512)), sa.Column("is_public_business_setting", sa.Boolean(), nullable=False, server_default=sa.false()), *_timestamps(),
    )
    op.create_table(
        "admin_idempotency_keys", sa.Column("id", uuid_type, primary_key=True),
        sa.Column("actor_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False), sa.Column("action", sa.String(128), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("actor_user_id", "key_hash", "action", name="uq_admin_idempotency_action"),
    )
    op.create_table(
        "admin_jobs", sa.Column("id", uuid_type, primary_key=True), sa.Column("kind", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"), sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("error", sa.Text()), sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"), *_timestamps(),
    )
    op.create_table(
        "admin_error_events", sa.Column("id", uuid_type, primary_key=True), sa.Column("source", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(24), nullable=False, server_default="error"), sa.Column("message", sa.Text(), nullable=False),
        sa.Column("correlation_id", sa.String(255)), sa.Column("context", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_admin_error_events_created_at", "admin_error_events", ["created_at"])
    op.create_index("ix_admin_jobs_status", "admin_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_admin_jobs_status", table_name="admin_jobs")
    op.drop_index("ix_admin_error_events_created_at", table_name="admin_error_events")
    op.drop_table("admin_error_events")
    op.drop_table("admin_jobs")
    op.drop_table("admin_idempotency_keys")
    op.drop_table("system_settings")
    op.drop_table("feature_flags")
