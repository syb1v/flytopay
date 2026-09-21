"""Add wallets, immutable ledger entries, and reservations."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_ledger"
down_revision = "0002_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("wallets", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True), sa.Column("currency", sa.String(3), nullable=False, server_default="USD"), sa.Column("scale", sa.Integer(), nullable=False, server_default="2"), sa.Column("available_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("reserved_minor", sa.BigInteger(), nullable=False, server_default="0"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    for table, fields in [("ledger_entries", [("wallet_id", sa.ForeignKey("wallets.id", ondelete="RESTRICT")), ("external_key", None), ("kind", None), ("direction", None), ("amount_minor", None), ("currency", None), ("scale", None), ("description", None)]), ("fund_reservations", [("wallet_id", sa.ForeignKey("wallets.id", ondelete="RESTRICT")), ("external_key", None), ("amount_minor", None), ("status", None)])]:
        args = [sa.Column("id", uuid, primary_key=True)]
        types = {"wallet_id": uuid, "external_key": sa.String(255), "kind": sa.String(48), "direction": sa.String(8), "amount_minor": sa.BigInteger(), "currency": sa.String(3), "scale": sa.Integer(), "description": sa.String(255), "status": sa.String(24)}
        for name, foreign in fields:
            args.append(sa.Column(name, types[name], foreign, nullable=False))
        args.extend([sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)])
        args.append(sa.UniqueConstraint("external_key", name=f"uq_{table}_external_key"))
        op.create_table(table, *args)
    op.alter_column("fund_reservations", "status", server_default="active")


def downgrade() -> None:
    op.drop_table("fund_reservations")
    op.drop_table("ledger_entries")
    op.drop_table("wallets")
