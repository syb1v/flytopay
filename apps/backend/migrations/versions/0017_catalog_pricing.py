"""Add versioned catalog prices and fee policies."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0017_catalog_pricing"
down_revision = "0016_admin_platform_foundation"
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
        "product_prices", sa.Column("id", uuid_type, primary_key=True),
        sa.Column("product_id", uuid_type, sa.ForeignKey("card_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("term_days", sa.Integer(), nullable=False), sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("fee_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("scale", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False), sa.Column("effective_to", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), *_timestamps(),
        sa.UniqueConstraint("product_id", "term_days", "currency", "effective_from", name="uq_product_price_version"),
    )
    op.create_index("ix_product_prices_active", "product_prices", ["product_id", "is_active", "effective_from"])
    op.create_table(
        "fee_policies", sa.Column("id", uuid_type, primary_key=True),
        sa.Column("product_id", uuid_type, sa.ForeignKey("card_products.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("issue_fee_minor", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("fund_fee_bps", sa.Integer(), nullable=False, server_default="0"), sa.Column("unload_fee_bps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("scale", sa.Integer(), nullable=False, server_default="2"), *_timestamps(),
    )


def downgrade() -> None:
    op.drop_table("fee_policies")
    op.drop_index("ix_product_prices_active", table_name="product_prices")
    op.drop_table("product_prices")
