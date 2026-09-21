"""Add isolated CaaS lifecycle idempotency records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011_caas_operation_records"
down_revision = "0010_reconciliation_cases"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "caas_operation_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("operation_key", sa.String(255), nullable=False),
        sa.Column("operation_kind", sa.String(48), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="processing"),
        sa.Column("provider_order_id", sa.String(128)),
        sa.Column("provider_card_id", sa.String(128)),
        sa.Column("response", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("operation_key", name="uq_caas_operation_key"),
    )


def downgrade() -> None:
    op.drop_table("caas_operation_records")
