"""Add reviewer skill overrides to users

Revision ID: a9b8c7d6e5f4
Revises: b1c2d3e4f5a6
Create Date: 2026-01-31 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: str | None = "a09335cc89f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("reviewer_skill_override_logic", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("reviewer_skill_override_specificity", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("reviewer_skill_override_structure", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("reviewer_skill_override_evidence", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("reviewer_skill_override_overall", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "reviewer_skill_override_overall")
    op.drop_column("users", "reviewer_skill_override_evidence")
    op.drop_column("users", "reviewer_skill_override_structure")
    op.drop_column("users", "reviewer_skill_override_specificity")
    op.drop_column("users", "reviewer_skill_override_logic")
