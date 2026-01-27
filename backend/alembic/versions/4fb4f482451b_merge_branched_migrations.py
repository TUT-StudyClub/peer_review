"""merge branched migrations

Revision ID: 4fb4f482451b
Revises: 0002_add_push_notifications, b1c2d3e4f5a6
Create Date: 2026-01-26 15:24:06.627140

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fb4f482451b'
down_revision: Union[str, None] = ('0002_add_push_notifications', 'b1c2d3e4f5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
