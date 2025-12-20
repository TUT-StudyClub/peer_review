"""add review duplicate detection fields

Revision ID: 0002_add_review_duplicates
Revises: 0001_add_review_similarity
Create Date: 2025-02-01 00:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "0002_add_review_duplicates"
down_revision = "0001_add_review_similarity"
branch_labels = None
depends_on = None


def _has_column(connection, table_name: str, column_name: str) -> bool:
	insp = inspect(connection)
	cols = [c["name"] for c in insp.get_columns(table_name)]
	return column_name in cols


def _has_index(connection, table_name: str, index_name: str) -> bool:
	insp = inspect(connection)
	indexes = [i["name"] for i in insp.get_indexes(table_name)]
	return index_name in indexes


def upgrade() -> None:
	conn = op.get_bind()
	dialect = conn.dialect.name

	if not _has_column(conn, "reviews", "normalized_comment_hash"):
		op.add_column(
			"reviews",
			sa.Column("normalized_comment_hash", sa.String(length=64), nullable=True),
		)
		op.create_index(
			"ix_reviews_normalized_comment_hash", "reviews", ["normalized_comment_hash"], unique=False
		)

	if not _has_column(conn, "reviews", "duplicate_warning"):
		op.add_column("reviews", sa.Column("duplicate_warning", sa.Text(), nullable=True))

	if not _has_column(conn, "reviews", "duplicate_penalty_rate"):
		op.add_column("reviews", sa.Column("duplicate_penalty_rate", sa.Float(), nullable=True))

	if not _has_column(conn, "reviews", "duplicate_of_review_id"):
		if dialect != "sqlite":
			op.add_column(
				"reviews",
				sa.Column(
					"duplicate_of_review_id",
					sa.Uuid(as_uuid=True),
					sa.ForeignKey("reviews.id", ondelete="SET NULL"),
					nullable=True,
				),
			)
		else:
			op.add_column(
				"reviews",
				sa.Column("duplicate_of_review_id", sa.Uuid(as_uuid=True), nullable=True),
			)
		op.create_index(
			"ix_reviews_duplicate_of_review_id", "reviews", ["duplicate_of_review_id"], unique=False
		)


def downgrade() -> None:
	conn = op.get_bind()

	if _has_column(conn, "reviews", "duplicate_of_review_id"):
		if _has_index(conn, "reviews", "ix_reviews_duplicate_of_review_id"):
			op.drop_index("ix_reviews_duplicate_of_review_id", table_name="reviews")
		op.drop_column("reviews", "duplicate_of_review_id")

	if _has_column(conn, "reviews", "duplicate_penalty_rate"):
		op.drop_column("reviews", "duplicate_penalty_rate")

	if _has_column(conn, "reviews", "duplicate_warning"):
		op.drop_column("reviews", "duplicate_warning")

	if _has_column(conn, "reviews", "normalized_comment_hash"):
		if _has_index(conn, "reviews", "ix_reviews_normalized_comment_hash"):
			op.drop_index("ix_reviews_normalized_comment_hash", table_name="reviews")
		op.drop_column("reviews", "normalized_comment_hash")
