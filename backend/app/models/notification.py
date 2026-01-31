"""通知関連のデータベースモデル"""

from datetime import datetime
from uuid import UUID
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from app.db.base import Base
from app.db.base import UUIDType


class PushSubscription(Base):
    """Push通知サブスクリプションモデル"""

    __tablename__ = "push_subscriptions"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(Text)
    p256dh_key: Mapped[str] = mapped_column(String(255), comment="公開鍵")
    auth_key: Mapped[str] = mapped_column(String(255), comment="認証シークレット")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(ZoneInfo("Asia/Tokyo")),
    )

    def __repr__(self) -> str:
        return f"<PushSubscription(id={self.id}, user_id={self.user_id})>"


class NotificationHistory(Base):
    """通知履歴モデル"""

    __tablename__ = "notification_history"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    notification_type: Mapped[str] = mapped_column(String(50), comment="通知タイプ")
    title: Mapped[str] = mapped_column(String(255), comment="通知タイトル")
    body: Mapped[str] = mapped_column(Text, comment="通知本文")
    url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="遷移先URL")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True, comment="既読フラグ")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(ZoneInfo("Asia/Tokyo")),
    )

    def __repr__(self) -> str:
        return f"<NotificationHistory(id={self.id}, user_id={self.user_id}, is_read={self.is_read})>"
