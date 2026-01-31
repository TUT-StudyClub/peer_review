"""通知関連のAPIエンドポイント"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import NotificationHistoryListResponse
from app.schemas.notification import NotificationHistoryResponse
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


# ==================== 通知履歴 ====================


@router.get("/history", response_model=NotificationHistoryListResponse)
def get_notification_history(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """通知履歴一覧を取得する"""
    notifications = notification_service.get_notification_history(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    unread_count = notification_service.get_unread_count(db=db, user_id=current_user.id)
    total_count = notification_service.get_total_count(db=db, user_id=current_user.id)

    return NotificationHistoryListResponse(
        notifications=[NotificationHistoryResponse.model_validate(n) for n in notifications],
        unread_count=unread_count,
        total_count=total_count,
    )


@router.patch("/history/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_as_read(
    notification_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """通知を既読にする"""
    success = notification_service.mark_as_read(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )


@router.patch("/history/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_as_read(
    db: DbSession,
    current_user: CurrentUser,
):
    """すべての通知を既読にする"""
    notification_service.mark_all_as_read(db=db, user_id=current_user.id)


# ==================== テスト ====================


@router.post("/test")
def send_test_notification(
    db: DbSession,
    current_user: CurrentUser,
):
    """テスト通知を送信する"""
    send_push_notification(
        user_id=current_user.id,
        notification_type=NotificationType.REVIEW_RECEIVED,
        context={
            "assignment_title": "テスト課題",
            "assignment_id": "test",
        },
    )
    return {"message": "テスト通知を送信しました"}
