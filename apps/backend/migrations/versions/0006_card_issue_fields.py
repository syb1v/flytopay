"""Add provider issue references to user cards."""

import sqlalchemy as sa
from alembic import op

revision = "0006_card_issue_fields"
down_revision = "0005_cards_rentals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_cards", sa.Column("cardholder_id", sa.String(128)))
    op.add_column("user_cards", sa.Column("issue_order_id", sa.String(128)))
    op.create_unique_constraint("uq_user_cards_issue_order_id", "user_cards", ["issue_order_id"])


def downgrade() -> None:
    op.drop_constraint("uq_user_cards_issue_order_id", "user_cards", type_="unique")
    op.drop_column("user_cards", "issue_order_id")
    op.drop_column("user_cards", "cardholder_id")
