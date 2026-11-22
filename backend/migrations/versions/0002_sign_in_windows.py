"""Add the shared sign-in counters."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    # Development databases may already have this table through create_all.
    table = sa.Table(
        "sign_in_windows",
        sa.MetaData(),
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.Integer(), primary_key=True, index=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
    )
    table.create(connection, checkfirst=True)

    # Legacy SQLite create_all omitted the two postponed foreign keys.
    if connection.dialect.name == "sqlite":
        schema = sa.inspect(connection)
        for table_name, name, target, column in (
            ("users", "fk_users_class", "classes", "class_id"),
            ("student_profiles", "fk_profiles_avatar", "backpack_items", "avatar_item_id"),
        ):
            if any(fk["name"] == name for fk in schema.get_foreign_keys(table_name)):
                continue
            with op.batch_alter_table(table_name) as batch:
                batch.create_foreign_key(name, target, [column], ["id"], ondelete="SET NULL")


def downgrade():
    op.drop_table("sign_in_windows")
