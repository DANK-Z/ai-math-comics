"""Who is on a battle or lesson board: the lobby on the class board."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    presence = sa.Table(
        "board_presence",
        schema,
        sa.Column("board_id", sa.String(36), primary_key=True),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Development databases may already have this table through create_all.
    presence.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("board_presence")
