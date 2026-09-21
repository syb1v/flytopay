"""Add payment attempts and provider events."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_payments"
down_revision = "0003_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("payment_attempts", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("provider", sa.String(32), nullable=False), sa.Column("purpose", sa.String(48), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="creating"), sa.Column("amount_minor", sa.BigInteger(), nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("scale", sa.Integer(), nullable=False), sa.Column("idempotency_key", sa.String(255), nullable=False), sa.Column("correlation_id", sa.String(255), nullable=False), sa.Column("provider_payment_id", sa.String(255)), sa.Column("checkout_url", sa.String(2048)), sa.Column("metadata_json", sa.JSON()), sa.Column("last_error_code", sa.String(96)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("provider", "idempotency_key", name="uq_payment_attempts_provider_idempotency"), sa.UniqueConstraint("provider", "provider_payment_id", name="uq_payment_attempts_provider_payment"))
    op.create_table("payment_provider_events", sa.Column("id", uuid, primary_key=True), sa.Column("provider", sa.String(32), nullable=False), sa.Column("deduplication_key", sa.String(255), nullable=False), sa.Column("event_type", sa.String(96), nullable=False), sa.Column("payload", sa.JSON(), nullable=False), sa.Column("processing_status", sa.String(24), nullable=False, server_default="received"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("provider", "deduplication_key", name="uq_payment_events_provider_dedup"))


def downgrade() -> None:
    op.drop_table("payment_provider_events")
    op.drop_table("payment_attempts")
