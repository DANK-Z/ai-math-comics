"""Lesson board: a second attempt, a timer, a mini-quiz with a podium, drills for some students."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def columns(bind, table):
    return {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade():
    bind = op.get_bind()
    # Development databases may already have the new schema through create_all.
    if "attempt" in columns(bind, "lesson_answers"):
        create_awards(bind)
        return
    with op.batch_alter_table("class_lessons") as table:
        table.add_column(sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"))
        table.add_column(sa.Column("step", sa.Integer(), nullable=False, server_default="0"))
        table.add_column(sa.Column("timer", sa.Integer(), nullable=False, server_default="0"))
        table.add_column(sa.Column("deadline", sa.DateTime(timezone=True), nullable=True))
        table.add_column(sa.Column("answering_at", sa.DateTime(timezone=True), nullable=True))
        table.add_column(sa.Column("quiz", sa.JSON(), nullable=True))
    with op.batch_alter_table("homework") as table:
        table.add_column(sa.Column("student_ids", sa.JSON(), nullable=True))

    # Answers: one per student, step and attempt (the primary key grows by two columns).
    if bind.dialect.name == "postgresql":
        op.add_column(
            "lesson_answers", sa.Column("step", sa.Integer(), nullable=False, server_default="0")
        )
        op.add_column(
            "lesson_answers",
            sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        )
        op.add_column(
            "lesson_answers",
            sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        )
        op.drop_constraint("lesson_answers_pkey", "lesson_answers", type_="primary")
        op.create_primary_key(
            "lesson_answers_pkey", "lesson_answers", ["lesson_id", "student_id", "step", "attempt"]
        )
    else:
        with op.batch_alter_table("lesson_answers", recreate="always") as table:
            table.add_column(sa.Column("step", sa.Integer(), nullable=False, server_default="0"))
            table.add_column(sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"))
            table.add_column(sa.Column("points", sa.Integer(), nullable=False, server_default="0"))
            table.create_primary_key(
                "pk_lesson_answers", ["lesson_id", "student_id", "step", "attempt"]
            )

    create_awards(bind)


def create_awards(bind):
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    sa.Table("class_lessons", schema, sa.Column("id", sa.String(36), primary_key=True))
    awards = sa.Table(
        "lesson_awards",
        schema,
        sa.Column(
            "lesson_id", sa.ForeignKey("class_lessons.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("place", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    awards.create(bind, checkfirst=True)


def downgrade():
    op.drop_table("lesson_awards")
    with op.batch_alter_table("homework") as table:
        table.drop_column("student_ids")
    for column in ("quiz", "answering_at", "deadline", "timer", "step", "attempt"):
        with op.batch_alter_table("class_lessons") as table:
            table.drop_column(column)
