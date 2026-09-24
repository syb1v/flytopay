"""Add auditable refund requests."""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0021_finance_admin"
down_revision = "0020_referrals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    u = postgresql.UUID(as_uuid=True)
    op.create_table("refund_requests", sa.Column("id", u, primary_key=True), sa.Column("payment_attempt_id", u, sa.ForeignKey("payment_attempts.id", ondelete="RESTRICT"), nullable=False), sa.Column("requested_by", u, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("amount_minor", sa.BigInteger(), nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending"), sa.Column("provider_ref", sa.String(255)), sa.Column("processed_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    op.drop_table("refund_requests")
