"""Add avatar_url to users

Revision ID: e4c9b8a1d2f0
Revises: d2a1f0c3b4e5
Create Date: 2026-01-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4c9b8a1d2f0"
down_revision: str | None = "d2a1f0c3b4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
