"""Add card products, user cards, and rental records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_cards_rentals"
down_revision = "0004_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    common = [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]
    op.create_table("card_products", sa.Column("id", uuid, primary_key=True), sa.Column("code", sa.String(64), nullable=False, unique=True), sa.Column("name", sa.String(160), nullable=False), sa.Column("scheme", sa.String(24), nullable=False), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("provider_code", sa.String(64), nullable=False), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()), *common)
    op.create_table("user_cards", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("product_id", uuid, sa.ForeignKey("card_products.id", ondelete="RESTRICT"), nullable=False), sa.Column("provider_card_id", sa.String(128), unique=True), sa.Column("status", sa.String(32), nullable=False, server_default="issuing"), sa.Column("masked_pan", sa.String(32)), sa.Column("last_four", sa.String(4)), sa.Column("balance_minor", sa.BigInteger()), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("scale", sa.Integer(), nullable=False, server_default="2"), *common)
    op.create_table("rentals", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("card_id", uuid, sa.ForeignKey("user_cards.id", ondelete="RESTRICT"), nullable=False), sa.Column("term_days", sa.Integer(), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="draft"), sa.Column("starts_at", sa.DateTime(timezone=True)), sa.Column("expires_at", sa.DateTime(timezone=True)), sa.Column("grace_expires_at", sa.DateTime(timezone=True)), sa.Column("price_minor", sa.BigInteger(), nullable=False), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("scale", sa.Integer(), nullable=False, server_default="2"), *common)


def downgrade() -> None:
    op.drop_table("rentals")
    op.drop_table("user_cards")
    op.drop_table("card_products")
