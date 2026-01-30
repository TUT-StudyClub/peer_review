"""通知関連のAPIエンドポイント"""

from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import NotificationType
from app.schemas.notification import PushSubscriptionCreate
from app.schemas.notification import PushSubscriptionResponse
from app.services import notification_service
from app.services.auth import get_current_user
from app.services.notification_service import send_push_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Annotated依存関係（B008対応）
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("/subscribe", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe_push_notifications(
    subscription: PushSubscriptionCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Push通知を有効化する（サブスクリプション登録）"""
    result = notification_service.create_subscription(
        db=db,
        user_id=current_user.id,
        subscription_data=subscription,
    )
    return result


@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe_push_notifications(
    endpoint: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Push通知を無効化する（サブスクリプション削除）"""
    success = notification_service.delete_subscription(
        db=db,
        user_id=current_user.id,
        endpoint=endpoint,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """VAPID公開鍵を取得する（フロントエンドで使用）"""
    return {"publicKey": settings.vapid_public_key}


@router.post("/test")
def send_test_notification(
    db: DbSession,
    current_user: CurrentUser,
):
    """テスト通知を送信する"""
    send_push_notification(
        db=db,
        user_id=current_user.id,
        notification_type=NotificationType.REVIEW_RECEIVED,
        context={
            "assignment_title": "テスト課題",
            "assignment_id": "test",
        },
    )
    return {"message": "テスト通知を送信しました"}
