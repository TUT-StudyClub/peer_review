"""add review similarity fields

Revision ID: 0001_add_review_similarity
Revises: 
Create Date: 2025-01-01 00:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_add_review_similarity"
down_revision = None
branch_labels = None
depends_on = None


def _has_column(connection, table_name: str, column_name: str) -> bool:
	insp = inspect(connection)
	cols = [c["name"] for c in insp.get_columns(table_name)]
	return column_name in cols


def upgrade() -> None:
	conn = op.get_bind()
	dialect = conn.dialect.name

	if not _has_column(conn, "reviews", "similarity_score"):
		op.add_column("reviews", sa.Column("similarity_score", sa.Float(), nullable=True))

	if not _has_column(conn, "reviews", "similarity_warning"):
		op.add_column("reviews", sa.Column("similarity_warning", sa.Text(), nullable=True))

	if not _has_column(conn, "reviews", "similarity_penalty_rate"):
		op.add_column("reviews", sa.Column("similarity_penalty_rate", sa.Float(), nullable=True))

	if not _has_column(conn, "reviews", "similar_review_id"):
		# For sqlite, avoid creating FK constraints (limited ALTER support)
		if dialect != "sqlite":
			op.add_column(
				"reviews",
				sa.Column(
					"similar_review_id",
					sa.Uuid(as_uuid=True),
					sa.ForeignKey("reviews.id", ondelete="SET NULL"),
					nullable=True,
				),
			)
		else:
			op.add_column(
				"reviews",
				sa.Column("similar_review_id", sa.Uuid(as_uuid=True), nullable=True),
			)


def downgrade() -> None:
	conn = op.get_bind()

	if _has_column(conn, "reviews", "similarity_penalty_rate"):
		op.drop_column("reviews", "similarity_penalty_rate")
	if _has_column(conn, "reviews", "similarity_warning"):
		op.drop_column("reviews", "similarity_warning")
	if _has_column(conn, "reviews", "similarity_score"):
		op.drop_column("reviews", "similarity_score")
	if _has_column(conn, "reviews", "similar_review_id"):
		# SQLite doesn't support FK drops cleanly; just drop the column
		op.drop_column("reviews", "similar_review_id")

