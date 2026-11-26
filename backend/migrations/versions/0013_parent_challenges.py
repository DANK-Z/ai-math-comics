"""Parents' challenges with real rewards."""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    challenges = sa.Table(
        "parent_challenges",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("parent_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("topic", sa.String(20), nullable=True),
        sa.Column("target", sa.Integer(), nullable=False),
        sa.Column("reward", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rewarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Index("ix_parent_challenges_student_id", "student_id"),
    )
    challenges.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("parent_challenges")
