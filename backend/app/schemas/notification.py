"""通知関連のスキーマ定義"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class NotificationType(str, Enum):
    """通知タイプの定義"""

    REVIEW_RECEIVED = "review_received"  # レビューが届いた
    SUBMISSION_DUE = "submission_due"  # 締め切り間近
    SYSTEM_INFO = "system_info"  # システム通知


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
