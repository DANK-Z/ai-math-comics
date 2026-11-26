"""Objective codes, teacher-parent messages, duels, mock tests and the teacher's own tasks."""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def user():
    return sa.ForeignKey("users.id", ondelete="CASCADE")


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    sa.Table("classes", schema, sa.Column("id", sa.Integer(), primary_key=True))
    tables = [
        sa.Table(
            "objective_codes",
            schema,
            sa.Column("teacher_id", user(), primary_key=True),
            sa.Column("comic_id", sa.String(64), primary_key=True),
            sa.Column("codes", sa.String(80), nullable=False),
        ),
        sa.Table(
            "messages",
            schema,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("teacher_id", user(), nullable=False),
            sa.Column("parent_id", user(), nullable=False),
            sa.Column("student_id", user(), nullable=False),
            sa.Column("sender", sa.String(10), nullable=False),
            sa.Column("text", sa.String(500), nullable=False),
            sa.Column("link", sa.String(80), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Index("ix_messages_teacher_id", "teacher_id"),
            sa.Index("ix_messages_parent_id", "parent_id"),
        ),
        sa.Table(
            "duels",
            schema,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("code", sa.String(8), nullable=False),
            sa.Column("class_id", sa.Integer(), nullable=True),
            sa.Column("topic", sa.String(20), nullable=False),
            sa.Column("problems", sa.JSON(), nullable=False),
            sa.Column("player_a", user(), nullable=False),
            sa.Column("player_b", user(), nullable=True),
            sa.Column("progress_a", sa.Integer(), nullable=False),
            sa.Column("progress_b", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(10), nullable=False),
            sa.Column("winner_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Index("ix_duels_code", "code"),
            sa.Index("ix_duels_class_id", "class_id"),
        ),
        sa.Table(
            "mock_tests",
            schema,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("student_id", user(), nullable=False),
            sa.Column("problem_ids", sa.JSON(), nullable=False),
            sa.Column("answers", sa.JSON(), nullable=True),
            sa.Column("score", sa.Integer(), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Index("ix_mock_tests_student_id", "student_id"),
        ),
        sa.Table(
            "teacher_tasks",
            schema,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("class_id", sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("hero", sa.String(20), nullable=False),
            sa.Column("scene", sa.String(64), nullable=False),
            sa.Column("text_ru", sa.String(300), nullable=False),
            sa.Column("text_kk", sa.String(300), nullable=False),
            sa.Column("answer", sa.String(20), nullable=False),
            sa.Column("hint_ru", sa.String(200), nullable=True),
            sa.Column("hint_kk", sa.String(200), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Index("ix_teacher_tasks_class_id", "class_id"),
        ),
        sa.Table(
            "teacher_task_answers",
            schema,
            sa.Column(
                "task_id", sa.ForeignKey("teacher_tasks.id", ondelete="CASCADE"), primary_key=True
            ),
            sa.Column("student_id", user(), primary_key=True),
            sa.Column("tries", sa.Integer(), nullable=False),
            sa.Column("solved_at", sa.DateTime(timezone=True), nullable=True),
        ),
    ]
    for table in tables:
        table.create(op.get_bind(), checkfirst=True)


def downgrade():
    for name in (
        "teacher_task_answers",
        "teacher_tasks",
        "mock_tests",
        "duels",
        "messages",
        "objective_codes",
    ):
        op.drop_table(name)
