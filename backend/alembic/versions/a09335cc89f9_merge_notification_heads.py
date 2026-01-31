"""merge_notification_heads

Revision ID: a09335cc89f9
Revises: 433687630035, b1c2d3e4f5a6
Create Date: 2026-01-31 21:31:34.600226

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "a09335cc89f9"
down_revision: str | Sequence[str] | None = ("433687630035", "b1c2d3e4f5a6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
