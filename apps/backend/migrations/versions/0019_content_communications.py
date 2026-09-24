"""Add localized content, templates, and broadcast records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0019_content_communications"
down_revision = "0018_marketing"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]


def upgrade() -> None:
    u = postgresql.UUID(as_uuid=True)
    op.create_table("content_documents", sa.Column("id", u, primary_key=True), sa.Column("kind", sa.String(32), nullable=False), sa.Column("slug", sa.String(160), nullable=False, unique=True), sa.Column("locale", sa.String(5), nullable=False, server_default="ru"), sa.Column("title", sa.String(255), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()), *_timestamps())
    op.create_table("message_templates", sa.Column("id", u, primary_key=True), sa.Column("key", sa.String(128), nullable=False, unique=True), sa.Column("channel", sa.String(24), nullable=False, server_default="telegram"), sa.Column("locale", sa.String(5), nullable=False, server_default="ru"), sa.Column("subject", sa.String(255)), sa.Column("body", sa.Text(), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), *_timestamps())
    op.create_table("broadcasts", sa.Column("id", u, primary_key=True), sa.Column("title", sa.String(255), nullable=False), sa.Column("channel", sa.String(24), nullable=False, server_default="telegram"), sa.Column("audience", sa.JSON(), nullable=False, server_default=sa.text("'{}'")), sa.Column("body", sa.Text(), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="draft"), sa.Column("scheduled_at", sa.DateTime(timezone=True)), sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"), sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"), *_timestamps())
    op.create_table("broadcast_deliveries", sa.Column("id", u, primary_key=True), sa.Column("broadcast_id", u, sa.ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending"), sa.Column("error", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_broadcast_deliveries_status", "broadcast_deliveries", ["broadcast_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_broadcast_deliveries_status", table_name="broadcast_deliveries")
    op.drop_table("broadcast_deliveries")
    op.drop_table("broadcasts")
    op.drop_table("message_templates")
    op.drop_table("content_documents")
