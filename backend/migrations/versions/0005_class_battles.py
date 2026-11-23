"""Class battles: one shared boss per class and the problems each student solves in it."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    sa.Table("classes", schema, sa.Column("id", sa.Integer(), primary_key=True))
    battles = sa.Table(
        "class_battles",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("class_id", sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic", sa.String(20), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("max_hp", sa.Integer(), nullable=False),
        sa.Column("damage", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Index("ix_class_battles_class_id", "class_id"),
    )
    tasks = sa.Table(
        "battle_tasks",
        schema,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "battle_id", sa.ForeignKey("class_battles.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("problem", sa.JSON(), nullable=False),
        sa.Column("misses", sa.Integer(), nullable=False),
        sa.Column("solved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_battle_tasks_battle_id", "battle_id"),
    )
    # Development databases may already have these tables through create_all.
    battles.create(op.get_bind(), checkfirst=True)
    tasks.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("battle_tasks")
    op.drop_table("class_battles")
