"""Add avatar_path to users

Revision ID: f6b7c8d9e0a1
Revises: e4c9b8a1d2f0
Create Date: 2026-01-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6b7c8d9e0a1"
down_revision: str | None = "e4c9b8a1d2f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_path", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("avatar_content_type", sa.String(length=100), nullable=True))
    op.drop_column("users", "avatar_url")


def downgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.drop_column("users", "avatar_content_type")
    op.drop_column("users", "avatar_path")
