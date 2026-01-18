"""Add due_at to assignments

Revision ID: b3c1b5f1c2a9
Revises: 7ae773981d43
Create Date: 2025-12-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3c1b5f1c2a9"
down_revision: str | None = "7ae773981d43"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("assignments", sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("assignments", "due_at")
