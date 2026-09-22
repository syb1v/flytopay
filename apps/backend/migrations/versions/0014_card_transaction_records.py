"""Add local card transaction records for demo history."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0014_card_transaction_records"
down_revision = "0013_caas_request_payload"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "card_transaction_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_cards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("fee_minor", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("scale", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("merchant_name", sa.String(160)),
        sa.Column("mcc", sa.String(8)),
        sa.Column("merchant_country", sa.String(2)),
        sa.Column("decline_code", sa.String(48)),
        sa.Column("fee_type", sa.String(48)),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_card_tx_card_occurred", "card_transaction_records", ["card_id", "occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_card_tx_card_occurred", table_name="card_transaction_records")
    op.drop_table("card_transaction_records")
