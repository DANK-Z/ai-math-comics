"""Record one-time coin rewards for operation progress (chapters and finales)."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    rewards = sa.Table(
        "progress_rewards",
        schema,
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("reward_key", sa.String(64), primary_key=True),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Development databases may already have this table through create_all.
    rewards.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("progress_rewards")
