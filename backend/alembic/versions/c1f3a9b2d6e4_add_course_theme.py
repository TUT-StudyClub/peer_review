"""Add theme to courses

Revision ID: c1f3a9b2d6e4
Revises: b3c1b5f1c2a9
Create Date: 2026-01-06 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1f3a9b2d6e4"
down_revision: str | None = "b3c1b5f1c2a9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("theme", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("courses", "theme")
