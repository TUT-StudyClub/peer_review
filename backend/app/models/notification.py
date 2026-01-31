"""通知関連のデータベースモデル"""

from datetime import datetime
from uuid import UUID
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlmodel import Field
from sqlmodel import SQLModel


class PushSubscription(SQLModel, table=True):
    """Push通知サブスクリプションモデル"""

    __tablename__ = "push_subscriptions"  # type: ignore

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")
    endpoint: str = Field(sa_column_kwargs={"nullable": False})
    p256dh_key: str = Field(max_length=255, description="公開鍵")
    auth_key: str = Field(max_length=255, description="認証シークレット")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(ZoneInfo("Asia/Tokyo")),
        sa_column_kwargs={"server_default": "now()"},
    )

    def __repr__(self) -> str:
        return f"<PushSubscription(id={self.id}, user_id={self.user_id})>"


class NotificationHistory(SQLModel, table=True):
    """通知履歴モデル"""

    __tablename__ = "notification_history"  # type: ignore

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")
    notification_type: str = Field(max_length=50, description="通知タイプ")
    title: str = Field(max_length=255, description="通知タイトル")
    body: str = Field(description="通知本文")
    url: str | None = Field(default=None, max_length=500, description="遷移先URL")
    is_read: bool = Field(default=False, index=True, description="既読フラグ")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(ZoneInfo("Asia/Tokyo")),
        sa_column_kwargs={"server_default": "now()"},
    )

    def __repr__(self) -> str:
        return f"<NotificationHistory(id={self.id}, user_id={self.user_id}, is_read={self.is_read})>"
