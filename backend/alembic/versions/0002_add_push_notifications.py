"""add push notifications tables

Revision ID: 0002_add_push_notifications
Revises: 7ae773981d43
Create Date: 2026-01-17 00:00:00.000000
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0002_add_push_notifications"
down_revision = "7ae773981d43"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create push_subscriptions table
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False, primary_key=True),  # type: ignore[no-matching-overload]
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),  # type: ignore[no-matching-overload]
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh_key", sa.String(255), nullable=False),
        sa.Column("auth_key", sa.String(255), nullable=False),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])

    # Create notification_preferences table
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False, primary_key=True),  # type: ignore[no-matching-overload]
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False, unique=True),  # type: ignore[no-matching-overload]
        sa.Column("push_review_received", sa.Boolean(), nullable=False, default=True),
        sa.Column("push_deadline_reminder", sa.Boolean(), nullable=False, default=True),
        sa.Column("push_feedback_received", sa.Boolean(), nullable=False, default=True),
        sa.Column("push_meta_review", sa.Boolean(), nullable=False, default=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_preferences_user_id", table_name="notification_preferences")
    op.drop_table("notification_preferences")
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
