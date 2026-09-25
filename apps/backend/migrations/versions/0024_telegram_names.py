"""Store Telegram display names for admin search and support."""
import sqlalchemy as sa
from alembic import op

revision = "0024_telegram_names"
down_revision = "0023_fee_markup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("telegram_accounts", sa.Column("first_name", sa.String(255), nullable=True))
    op.add_column("telegram_accounts", sa.Column("last_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("telegram_accounts", "last_name")
    op.drop_column("telegram_accounts", "first_name")
