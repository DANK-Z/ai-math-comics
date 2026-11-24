"""Parent billing: family plans and payments (test mode until a payment provider is set up)."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    schema = sa.MetaData()
    sa.Table("users", schema, sa.Column("id", sa.Integer(), primary_key=True))
    plans = sa.Table(
        "family_plans",
        schema,
        sa.Column("parent_id", sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("paid_until", sa.DateTime(timezone=True), nullable=False),
    )
    payments = sa.Table(
        "payments",
        schema,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("parent_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("product", sa.String(30), nullable=False),
        sa.Column("amount_kzt", sa.Integer(), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_payments_parent_id", "parent_id"),
    )
    for table in (plans, payments):
        table.create(bind, checkfirst=True)


def downgrade():
    op.drop_table("payments")
    op.drop_table("family_plans")
