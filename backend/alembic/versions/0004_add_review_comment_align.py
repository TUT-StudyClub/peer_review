"""add review comment alignment fields

Revision ID: 0004_add_review_comment_align
Revises: 0003_add_courses
Create Date: 2025-01-01 00:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "0004_add_review_comment_align"
down_revision = "0003_add_courses"
branch_labels = None
depends_on = None


def _has_column(connection, table_name: str, column_name: str) -> bool:
    insp = inspect(connection)
    cols = [c["name"] for c in insp.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, "reviews", "ai_comment_alignment_score"):
        op.add_column("reviews", sa.Column("ai_comment_alignment_score", sa.Integer(), nullable=True))

    if not _has_column(conn, "reviews", "ai_comment_alignment_reason"):
        op.add_column("reviews", sa.Column("ai_comment_alignment_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()

    if _has_column(conn, "reviews", "ai_comment_alignment_reason"):
        op.drop_column("reviews", "ai_comment_alignment_reason")
    if _has_column(conn, "reviews", "ai_comment_alignment_score"):
        op.drop_column("reviews", "ai_comment_alignment_score")
