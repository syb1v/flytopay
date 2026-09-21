"""Add payment reconciliation cases."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_reconciliation_cases"
down_revision = "0009_issuance_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reconciliation_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("payment_attempt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payment_attempts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("case_type", sa.String(48), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="open"),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column("provider_status", sa.String(48)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("payment_attempt_id", "case_type", name="uq_reconciliation_attempt_type"),
    )


def downgrade() -> None:
    op.drop_table("reconciliation_cases")
