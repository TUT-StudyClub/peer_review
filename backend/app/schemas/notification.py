"""通知関連のスキーマ"""

from pydantic import BaseModel


class PushSubscriptionCreate(BaseModel):
    """購読登録リクエスト"""

    endpoint: str
    p256dh_key: str
    auth_key: str
    user_agent: str | None = None


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
