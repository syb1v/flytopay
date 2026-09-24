"""Add referral settings, links, ledger, and payout requests."""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0020_referrals"
down_revision = "0019_content_communications"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]


def upgrade() -> None:
    u = postgresql.UUID(as_uuid=True)
    op.create_table("referral_settings", sa.Column("id", u, primary_key=True), sa.Column("commission_bps", sa.Integer(), nullable=False, server_default="0"), sa.Column("minimum_payout_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.false()), *_timestamps())
    op.create_table("referral_links", sa.Column("id", u, primary_key=True), sa.Column("referrer_user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("referred_user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True), sa.Column("code", sa.String(128), nullable=False, unique=True), sa.Column("status", sa.String(24), nullable=False, server_default="active"), *_timestamps())
    op.create_table("referral_ledger", sa.Column("id", u, primary_key=True), sa.Column("referrer_user_id", u, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("referred_user_id", u, sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("amount_minor", sa.BigInteger(), nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="accrued"), sa.Column("source_payment_id", u, sa.ForeignKey("payment_attempts.id", ondelete="SET NULL")), *_timestamps())
    op.create_table("referral_payout_requests", sa.Column("id", u, primary_key=True), sa.Column("user_id", u, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("amount_minor", sa.BigInteger(), nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("status", sa.String(24), nullable=False, server_default="pending"), sa.Column("processed_at", sa.DateTime(timezone=True)), *_timestamps())


def downgrade() -> None:
    op.drop_table("referral_payout_requests")
    op.drop_table("referral_ledger")
    op.drop_table("referral_links")
    op.drop_table("referral_settings")
