"""add courses and assignment course_id

Revision ID: 0003_add_courses
Revises: 0002_add_review_duplicates
Create Date: 2025-03-01 00:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = "0003_add_courses"
down_revision = "0002_add_review_duplicates"
branch_labels = None
depends_on = None


def _has_table(connection, table_name: str) -> bool:
	insp = inspect(connection)
	return insp.has_table(table_name)


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

	if not _has_table(conn, "courses"):
		op.create_table(
			"courses",
			sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
			sa.Column("title", sa.String(length=200), nullable=False),
			sa.Column("description", sa.Text(), nullable=True),
			sa.Column("teacher_id", sa.Uuid(as_uuid=True), nullable=False),
			sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
			sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
		)
		op.create_index("ix_courses_teacher_id", "courses", ["teacher_id"], unique=False)

	if not _has_table(conn, "course_enrollments"):
		op.create_table(
			"course_enrollments",
			sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
			sa.Column("course_id", sa.Uuid(as_uuid=True), nullable=False),
			sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
			sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
			sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
			sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
			sa.UniqueConstraint("course_id", "user_id", name="uq_course_enrollment"),
		)
		op.create_index(
			"ix_course_enrollments_course_id", "course_enrollments", ["course_id"], unique=False
		)
		op.create_index(
			"ix_course_enrollments_user_id", "course_enrollments", ["user_id"], unique=False
		)

	if not _has_column(conn, "assignments", "course_id"):
		if dialect != "sqlite":
			op.add_column(
				"assignments",
				sa.Column(
					"course_id",
					sa.Uuid(as_uuid=True),
					sa.ForeignKey("courses.id", ondelete="CASCADE"),
					nullable=True,
				),
			)
		else:
			op.add_column(
				"assignments",
				sa.Column("course_id", sa.Uuid(as_uuid=True), nullable=True),
			)
		op.create_index("ix_assignments_course_id", "assignments", ["course_id"], unique=False)


def downgrade() -> None:
	conn = op.get_bind()

	if _has_column(conn, "assignments", "course_id"):
		if _has_index(conn, "assignments", "ix_assignments_course_id"):
			op.drop_index("ix_assignments_course_id", table_name="assignments")
		op.drop_column("assignments", "course_id")

	if _has_table(conn, "course_enrollments"):
		if _has_index(conn, "course_enrollments", "ix_course_enrollments_user_id"):
			op.drop_index("ix_course_enrollments_user_id", table_name="course_enrollments")
		if _has_index(conn, "course_enrollments", "ix_course_enrollments_course_id"):
			op.drop_index("ix_course_enrollments_course_id", table_name="course_enrollments")
		op.drop_table("course_enrollments")

	if _has_table(conn, "courses"):
		if _has_index(conn, "courses", "ix_courses_teacher_id"):
			op.drop_index("ix_courses_teacher_id", table_name="courses")
		op.drop_table("courses")
