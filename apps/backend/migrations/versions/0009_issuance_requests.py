"""Add encrypted card issuance requests."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_issuance_requests"
down_revision = "0008_product_capabilities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("issuance_requests", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("product_code", sa.String(64), nullable=False), sa.Column("provider_code", sa.String(64), nullable=False), sa.Column("country", sa.String(2), nullable=False), sa.Column("term_days", sa.Integer(), nullable=False), sa.Column("amount_minor", sa.BigInteger(), nullable=False), sa.Column("fee_minor", sa.BigInteger()), sa.Column("total_charge_minor", sa.BigInteger()), sa.Column("currency", sa.String(3), nullable=False), sa.Column("scale", sa.Integer(), nullable=False, server_default="2"), sa.Column("protected_cardholder", sa.String(8192), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="quoted"), sa.Column("payment_attempt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payment_attempts.id", ondelete="SET NULL")), sa.Column("reservation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("fund_reservations.id", ondelete="SET NULL")), sa.Column("provider_order_id", sa.String(128)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    op.drop_table("issuance_requests")
