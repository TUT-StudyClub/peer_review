"""Add credit histories

Revision ID: b1c2d3e4f5a6
Revises: f6b7c8d9e0a1
Create Date: 2026-01-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "f6b7c8d9e0a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "credit_histories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("total_credits", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=120), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=True),
        sa.Column("assignment_id", sa.Uuid(), nullable=True),
        sa.Column("submission_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_credit_histories_assignment_id"), "credit_histories", ["assignment_id"], unique=False)
    op.create_index(op.f("ix_credit_histories_created_at"), "credit_histories", ["created_at"], unique=False)
    op.create_index(op.f("ix_credit_histories_review_id"), "credit_histories", ["review_id"], unique=False)
    op.create_index(op.f("ix_credit_histories_submission_id"), "credit_histories", ["submission_id"], unique=False)
    op.create_index(op.f("ix_credit_histories_user_id"), "credit_histories", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_histories_user_id"), table_name="credit_histories")
    op.drop_index(op.f("ix_credit_histories_submission_id"), table_name="credit_histories")
    op.drop_index(op.f("ix_credit_histories_review_id"), table_name="credit_histories")
    op.drop_index(op.f("ix_credit_histories_created_at"), table_name="credit_histories")
    op.drop_index(op.f("ix_credit_histories_assignment_id"), table_name="credit_histories")
    op.drop_table("credit_histories")
