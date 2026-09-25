"""Add administrator notes and tags for users."""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0022_user_notes_tags"
down_revision = "0021_finance_admin"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]


def upgrade() -> None:
    u = postgresql.UUID(as_uuid=True)
    op.create_table("user_notes", sa.Column("id", u, primary_key=True), sa.Column("user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("author_user_id", u, sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("body", sa.Text(), nullable=False), *_timestamps())
    op.create_index("ix_user_notes_user", "user_notes", ["user_id"])
    op.create_table("user_tags", sa.Column("id", u, primary_key=True), sa.Column("name", sa.String(64), nullable=False, unique=True), sa.Column("color", sa.String(16)), *_timestamps())
    op.create_table("user_tag_assignments", sa.Column("id", u, primary_key=True), sa.Column("user_id", u, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("tag_id", u, sa.ForeignKey("user_tags.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("user_id", "tag_id", name="uq_user_tag_assignment"))
    op.create_index("ix_user_tag_assignments_user", "user_tag_assignments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_tag_assignments_user", table_name="user_tag_assignments")
    op.drop_table("user_tag_assignments")
    op.drop_table("user_tags")
    op.drop_index("ix_user_notes_user", table_name="user_notes")
    op.drop_table("user_notes")
