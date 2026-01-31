"""add push subscriptions

Revision ID: 433687630035
Revises: f6b7c8d9e0a1
Create Date: 2026-01-30 06:32:59.260796

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "433687630035"
down_revision: str | None = "f6b7c8d9e0a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # push_subscriptions テーブルの作成
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh_key", sa.String(length=255), nullable=False, comment="公開鍵"),
        sa.Column("auth_key", sa.String(length=255), nullable=False, comment="認証シークレット"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_push_subscriptions_user_id"), "push_subscriptions", ["user_id"], unique=False)

    # notification_history テーブルの作成
    op.create_table(
        "notification_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False, comment="通知タイプ"),
        sa.Column("title", sa.String(length=255), nullable=False, comment="通知タイトル"),
        sa.Column("body", sa.Text(), nullable=False, comment="通知本文"),
        sa.Column("url", sa.String(length=500), nullable=True, comment="遷移先URL"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false(), comment="既読フラグ"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_history_user_id"), "notification_history", ["user_id"], unique=False)
    op.create_index(op.f("ix_notification_history_is_read"), "notification_history", ["is_read"], unique=False)


def downgrade() -> None:
    # notification_history テーブルの削除
    op.drop_index(op.f("ix_notification_history_is_read"), table_name="notification_history")
    op.drop_index(op.f("ix_notification_history_user_id"), table_name="notification_history")
    op.drop_table("notification_history")

    # push_subscriptions テーブルの削除
    op.drop_index(op.f("ix_push_subscriptions_user_id"), table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
