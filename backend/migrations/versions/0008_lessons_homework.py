"""Class lessons on the board, their answers, and homework with due dates."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    sa.Table("classes", schema, sa.Column("id", sa.Integer(), primary_key=True))
    lessons = sa.Table(
        "class_lessons",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("class_id", sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comic_id", sa.String(64), nullable=False),
        sa.Column("answer", sa.Integer(), nullable=False),
        sa.Column("panel", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_class_lessons_class_id", "class_id"),
    )
    answers = sa.Table(
        "lesson_answers",
        schema,
        sa.Column(
            "lesson_id",
            sa.ForeignKey("class_lessons.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("text_entered", sa.String(32), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    homework = sa.Table(
        "homework",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("class_id", sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("target", sa.String(64), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_homework_class_id", "class_id"),
    )
    # Development databases may already have these tables through create_all.
    for table in (lessons, answers, homework):
        table.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("homework")
    op.drop_table("lesson_answers")
    op.drop_table("class_lessons")
