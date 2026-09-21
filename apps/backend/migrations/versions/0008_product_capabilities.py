"""Store product capabilities returned by CaaS."""

import sqlalchemy as sa
from alembic import op

revision = "0008_product_capabilities"
down_revision = "0007_demo_cards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("card_products", sa.Column("max_cards_per_cardholder", sa.Integer()))
    op.add_column("card_products", sa.Column("provider_settings", sa.JSON()))


def downgrade() -> None:
    op.drop_column("card_products", "provider_settings")
    op.drop_column("card_products", "max_cards_per_cardholder")
