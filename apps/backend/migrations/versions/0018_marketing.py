"""Add marketing campaigns, promotions, and attribution."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0018_marketing"
down_revision = "0017_catalog_pricing"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]


def upgrade() -> None:
    u = postgresql.UUID(as_uuid=True)
    op.create_table("marketing_campaigns", sa.Column("id", u, primary_key=True), sa.Column("name", sa.String(160), nullable=False), sa.Column("start_parameter", sa.String(128), nullable=False, unique=True), sa.Column("source", sa.String(128)), sa.Column("channel", sa.String(128)), sa.Column("budget_minor", sa.BigInteger()), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("starts_at", sa.DateTime(timezone=True)), sa.Column("ends_at", sa.DateTime(timezone=True)), *_timestamps())
    op.create_table("marketing_campaign_events", sa.Column("id", u, primary_key=True), sa.Column("campaign_id", u, sa.ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("event", sa.String(48), nullable=False), sa.Column("revenue_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_campaign_events_campaign", "marketing_campaign_events", ["campaign_id", "event", "created_at"])
    op.create_table("promo_groups", sa.Column("id", u, primary_key=True), sa.Column("name", sa.String(128), nullable=False, unique=True), sa.Column("description", sa.String(512)), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), *_timestamps())
    op.create_table("promo_codes", sa.Column("id", u, primary_key=True), sa.Column("code", sa.String(64), nullable=False), sa.Column("group_id", u, sa.ForeignKey("promo_groups.id", ondelete="SET NULL")), sa.Column("discount_bps", sa.Integer(), nullable=False, server_default="0"), sa.Column("bonus_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("max_redemptions", sa.Integer()), sa.Column("max_redemptions_per_user", sa.Integer(), nullable=False, server_default="1"), sa.Column("redemptions", sa.Integer(), nullable=False, server_default="0"), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("expires_at", sa.DateTime(timezone=True)), *_timestamps(), sa.UniqueConstraint("code", name="uq_promo_codes_code"))
    op.create_table("promo_redemptions", sa.Column("id", u, primary_key=True), sa.Column("promo_code_id", u, sa.ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("discount_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("currency", sa.String(3), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("promo_code_id", "user_id", name="uq_promo_redemption_user"))


def downgrade() -> None:
    op.drop_table("promo_redemptions")
    op.drop_table("promo_codes")
    op.drop_table("promo_groups")
    op.drop_index("ix_campaign_events_campaign", table_name="marketing_campaign_events")
    op.drop_table("marketing_campaign_events")
    op.drop_table("marketing_campaigns")
