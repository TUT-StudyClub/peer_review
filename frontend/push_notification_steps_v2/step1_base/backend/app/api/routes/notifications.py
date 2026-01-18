"""通知関連のAPIエンドポイント"""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.notification_preference import NotificationPreference
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.notification import NotificationPreferenceResponse
from app.schemas.notification import NotificationPreferenceUpdate
from app.schemas.notification import PushSubscriptionCreate
from app.schemas.notification import SubscribeResponse
from app.schemas.notification import VapidPublicKeyResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
def get_vapid_public_key():
    """
    VAPID公開鍵を取得

    フロントエンドでプッシュ通知を購読する際に使用
    """
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=503, detail="Push notifications are not configured"
        )
    return VapidPublicKeyResponse(public_key=settings.vapid_public_key)


@router.post("/subscribe", response_model=SubscribeResponse)
def subscribe_push(
    data: PushSubscriptionCreate,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
):
    """
    プッシュ通知を購読

    ブラウザから取得した購読情報をサーバーに登録
    """
    # 既存の購読を確認（同じendpointなら更新）
    existing = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == data.endpoint)
        .first()
    )

    if existing:
        # 既存の購読を更新（別ユーザーの可能性もあるので上書き）
        existing.user_id = current_user.id
        existing.p256dh_key = data.p256dh_key
        existing.auth_key = data.auth_key
        existing.user_agent = data.user_agent
        subscription_id = str(existing.id)
    else:
        # 新規購読を作成
        subscription = PushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh_key=data.p256dh_key,
            auth_key=data.auth_key,
            user_agent=data.user_agent,
        )
        db.add(subscription)
        db.flush()
        subscription_id = str(subscription.id)

    # 通知設定がなければデフォルトで作成
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    db.commit()

    return SubscribeResponse(status="subscribed", subscription_id=subscription_id)


@router.delete("/unsubscribe")
def unsubscribe_push(
    endpoint: str,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
):
    """
    プッシュ通知の購読を解除

    指定されたendpointの購読を削除
    """
    subscription = (
        db.query(PushSubscription)
        .filter(
            PushSubscription.endpoint == endpoint,
            PushSubscription.user_id == current_user.id,
        )
        .first()
    )

    if subscription:
        db.delete(subscription)
        db.commit()

    return {"status": "unsubscribed"}


@router.get("/preferences", response_model=NotificationPreferenceResponse)
def get_preferences(
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
):
    """
    通知設定を取得

    未作成の場合はデフォルト値で新規作成
    """
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )

    # 未作成なら新規作成
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return pref


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
def update_preferences(
    data: NotificationPreferenceUpdate,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
):
    """
    通知設定を更新

    送信されたフィールドのみ更新
    """
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    # 送信されたフィールドのみ更新
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)

    db.commit()
    db.refresh(pref)

    return pref


@router.get("/subscriptions")
def get_subscriptions(
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
):
    """
    現在の購読一覧を取得（デバッグ用）
    """
    subscriptions = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == current_user.id)
        .all()
    )

    return {
        "count": len(subscriptions),
        "subscriptions": [
            {
                "id": str(s.id),
                "user_agent": s.user_agent,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subscriptions
        ],
    }
