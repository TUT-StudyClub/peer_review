"""通知設定モデル"""

from uuid import UUID
from uuid import uuid4

from sqlalchemy import Boolean
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDType


class NotificationPreference(Base):
    """
    ユーザーごとの通知設定

    各通知タイプのON/OFFを管理
    """

    __tablename__ = "notification_preferences"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # プッシュ通知設定（種類別）
    push_review_received: Mapped[bool] = mapped_column(Boolean, default=True)
    push_deadline_reminder: Mapped[bool] = mapped_column(Boolean, default=True)
    push_feedback_received: Mapped[bool] = mapped_column(Boolean, default=True)
    push_meta_review: Mapped[bool] = mapped_column(Boolean, default=True)

    # リレーション
    user = relationship("User", back_populates="notification_preference")
