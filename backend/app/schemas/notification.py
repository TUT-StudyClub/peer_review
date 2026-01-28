"""通知関連のスキーマ"""

import re
from typing import Any
from typing import cast

from pydantic import BaseModel
from pydantic import Field
from pydantic import HttpUrl
from pydantic import field_validator


class PushSubscriptionCreate(BaseModel):
    """購読登録リクエスト"""

    endpoint: HttpUrl = Field(..., description="ブラウザから発行された通知用URL")
    p256dh_key: str = Field(..., min_length=20, max_length=200)
    auth_key: str = Field(..., min_length=10, max_length=100)
    user_agent: str | None = Field(None, max_length=500)

    @field_validator("p256dh_key", "auth_key")
    @classmethod
    def validate_base64(cls, v: str) -> str:
        """Base64/Base64URLで使用される文字種のみであることを検証"""
        if not re.match(r"^[A-Za-z0-9\-_=]+$", v):
            raise ValueError("Invalid characters in key: must be Base64 format")
        return v

    def model_post_init(self, __context: Any) -> None:
        """バリデーション後にHttpUrlオブジェクトを文字列に戻す"""
        self.endpoint = cast(Any, str(self.endpoint))


class PushSubscriptionResponse(BaseModel):
    """購読情報レスポンス"""

    id: str
    endpoint: str
    created_at: str

    class Config:
        from_attributes = True


class NotificationPreferenceResponse(BaseModel):
    """通知設定レスポンス"""

    push_review_received: bool
    push_deadline_reminder: bool
    push_feedback_received: bool
    push_meta_review: bool

    class Config:
        from_attributes = True


class NotificationPreferenceUpdate(BaseModel):
    """通知設定更新リクエスト"""

    push_review_received: bool | None = None
    push_deadline_reminder: bool | None = None
    push_feedback_received: bool | None = None
    push_meta_review: bool | None = None


class VapidPublicKeyResponse(BaseModel):
    """VAPID公開鍵レスポンス"""

    public_key: str


class SubscribeResponse(BaseModel):
    """購読結果レスポンス"""

    status: str
    subscription_id: str | None = None
