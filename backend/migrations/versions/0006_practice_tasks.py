"""Solo review drills: the problems a student solves, with their answers kept on the server."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    tasks = sa.Table(
        "practice_tasks",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic", sa.String(20), nullable=False),
        sa.Column("skill", sa.String(20)),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("problem", sa.JSON(), nullable=False),
        sa.Column("solved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_practice_tasks_run_id", "run_id"),
        sa.Index("ix_practice_tasks_student_id", "student_id"),
    )
    # Development databases may already have this table through create_all.
    tasks.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("practice_tasks")
