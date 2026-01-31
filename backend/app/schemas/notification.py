"""通知関連のスキーマ定義"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class NotificationType(str, Enum):
    """通知タイプの定義"""

    REVIEW_RECEIVED = "review_received"
    REVIEW_APPROVED = "review_approved"
    CREDIT_AWARDED = "credit_awarded"
    SUBMISSION_DUE = "submission_due"
    NEW_ASSIGNMENT = "new_assignment"
    SYSTEM_INFO = "system_info"


class PushSubscriptionCreate(BaseModel):
    """Push通知サブスクリプション作成スキーマ"""

    endpoint: str = Field(..., description="ブラウザから提供されるエンドポイントURL")
    p256dh_key: str = Field(..., description="公開鍵（Base64エンコード済み）")
    auth_key: str = Field(..., description="認証シークレット（Base64エンコード済み）")


class PushSubscriptionResponse(BaseModel):
    """Push通知サブスクリプションレスポンススキーマ"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    endpoint: str
    created_at: datetime


class NotificationHistoryResponse(BaseModel):
    """通知履歴レスポンススキーマ"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    notification_type: str
    title: str
    body: str
    url: str | None
    is_read: bool
    created_at: datetime


class NotificationHistoryListResponse(BaseModel):
    """通知履歴一覧レスポンススキーマ"""

    notifications: list[NotificationHistoryResponse]
    unread_count: int
    total_count: int
