"""Store published class assignments and hint usage."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("classes", schema, sa.Column("id", sa.Integer(), primary_key=True))
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    assignments = sa.Table(
        "assigned_comics",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "class_id",
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("comic_id", sa.String(36), nullable=False, unique=True),
        sa.Column("due_date", sa.Date()),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    hints = sa.Table(
        "assignment_hints",
        schema,
        sa.Column(
            "assignment_id",
            sa.ForeignKey("assigned_comics.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("step", sa.Integer(), primary_key=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
    )
    assignments.create(op.get_bind(), checkfirst=True)
    hints.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("assignment_hints")
    op.drop_table("assigned_comics")
