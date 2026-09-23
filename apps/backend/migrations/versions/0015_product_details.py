"""Store provider product type and configured capabilities.

Revision ID: 0015_product_details
Revises: 0014_card_transaction_records
"""

from alembic import op
import sqlalchemy as sa

revision = "0015_product_details"
down_revision = "0014_card_transaction_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("card_products", sa.Column("card_type", sa.String(length=24), nullable=True))
    op.add_column("card_products", sa.Column("features", sa.JSON(), nullable=True))
    op.add_column("card_products", sa.Column("controls", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("card_products", "controls")
    op.drop_column("card_products", "features")
    op.drop_column("card_products", "card_type")
