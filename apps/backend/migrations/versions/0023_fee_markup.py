"""Add target markup percentage to product fee policies."""
import sqlalchemy as sa
from alembic import op

revision = "0023_fee_markup"
down_revision = "0022_user_notes_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fee_policies", sa.Column("markup_bps", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("fee_policies", "markup_bps")
