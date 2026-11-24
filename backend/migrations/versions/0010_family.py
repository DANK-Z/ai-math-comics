"""Parents: the parent role, family codes, parent-child links and praise cards."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'parent'")
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    codes = sa.Table(
        "family_codes",
        schema,
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("code", sa.String(16), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    links = sa.Table(
        "family_links",
        schema,
        sa.Column("parent_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    praises = sa.Table(
        "praises",
        schema,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("parent_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("seen_at", sa.DateTime(timezone=True)),
        sa.Index("ix_praises_student_id", "student_id"),
    )
    # Development databases may already have these tables through create_all.
    for table in (codes, links, praises):
        table.create(bind, checkfirst=True)


def downgrade():
    op.drop_table("praises")
    op.drop_table("family_links")
    op.drop_table("family_codes")
