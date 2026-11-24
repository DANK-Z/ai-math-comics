"""Cache the fictional item stories per student and language."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    lore = sa.Table(
        "item_lore",
        schema,
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("item_key", sa.String(40), primary_key=True),
        sa.Column("locale", sa.String(2), primary_key=True),
        sa.Column("story", sa.String(400), nullable=False),
    )
    lore.create(op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("item_lore")
