"""merge branched migrations

Revision ID: 4fb4f482451b
Revises: 0002_add_push_notifications, b1c2d3e4f5a6
Create Date: 2026-01-26 15:24:06.627140

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "4fb4f482451b"
down_revision: str | tuple[str, ...] | None = ("0002_add_push_notifications", "b1c2d3e4f5a6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
