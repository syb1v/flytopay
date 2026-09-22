"""Add request_payload to caas_operation_records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013_caas_request_payload"
down_revision = "0012_admin_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("caas_operation_records", sa.Column("request_payload", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("caas_operation_records", "request_payload")
