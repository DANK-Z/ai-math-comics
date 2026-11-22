"""Baseline account schema"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    sqlite = op.get_bind().dialect.name == "sqlite"
    # SQLite requires inline FKs, including the forward reference to classes.
    user_class_fk = (
        (
            sa.ForeignKeyConstraint(
                ["class_id"], ["classes.id"], name="fk_users_class", ondelete="SET NULL"
            ),
        )
        if sqlite
        else ()
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("login", sa.String(length=24), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("display_name", sa.String(length=60), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("student", "teacher", name="user_role"), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        *user_class_fk,
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("login"),
    )
    op.create_table(
        "analytics_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("comic_id", sa.String(length=64), nullable=False),
        sa.Column("exercise_id", sa.String(length=100), nullable=False),
        sa.Column("topic", sa.String(length=20), nullable=False),
        sa.Column("skill", sa.String(length=20), nullable=True),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("mistake_count", sa.Integer(), nullable=False),
        sa.Column("text_entered", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_analytics_logs_comic_id"), "analytics_logs", ["comic_id"], unique=False
    )
    op.create_table(
        "backpack_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(length=20), nullable=False),
        sa.Column("item_key", sa.String(length=40), nullable=False),
        sa.Column("is_equipped", sa.Boolean(), nullable=False),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "boss_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("comic_id", sa.String(length=64), nullable=False),
        sa.Column("topic", sa.String(length=20), nullable=False),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("misses", sa.Integer(), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "comic_id"),
    )
    op.create_table(
        "classes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "student_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("total_coins", sa.Integer(), nullable=False),
        sa.Column("stars_collected", sa.Integer(), nullable=False),
        sa.Column("avatar_item_id", sa.Integer(), nullable=True),
        sa.Column("season", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["avatar_item_id"],
            ["backpack_items.id"],
            name="fk_profiles_avatar",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    if not sqlite:
        op.create_foreign_key(
            "fk_users_class", "users", "classes", ["class_id"], ["id"], ondelete="SET NULL"
        )


def downgrade():
    if op.get_bind().dialect.name != "sqlite":
        op.drop_constraint("fk_users_class", "users", type_="foreignkey")
    op.drop_table("student_profiles")
    op.drop_table("classes")
    op.drop_table("boss_results")
    op.drop_table("backpack_items")
    op.drop_index(op.f("ix_analytics_logs_comic_id"), table_name="analytics_logs")
    op.drop_table("analytics_logs")
    op.drop_table("users")
    sa.Enum("student", "teacher", name="user_role").drop(op.get_bind(), checkfirst=True)
