"""Mark demo/test cards explicitly."""

import sqlalchemy as sa
from alembic import op

revision = "0007_demo_cards"
down_revision = "0006_card_issue_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_cards", sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("user_cards", "is_demo")
