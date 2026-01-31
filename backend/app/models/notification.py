"""通知関連のデータベースモデル"""

from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from app.db.base import Base
from app.db.base import UUIDType


class PushSubscription(Base):
    """Push通知サブスクリプションモデル"""

    __tablename__ = "push_subscriptions"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh_key: Mapped[str] = mapped_column(String(255))
    auth_key: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    def __repr__(self) -> str:
        return f"<PushSubscription(id={self.id}, user_id={self.user_id})>"


class NotificationHistory(Base):
    """通知履歴モデル"""

    __tablename__ = "notification_history"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id"), index=True)
    notification_type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    def __repr__(self) -> str:
        return f"<NotificationHistory(id={self.id}, user_id={self.user_id}, is_read={self.is_read})>"
