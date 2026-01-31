"""Push通知送信サービス"""

import json
import logging
from uuid import UUID

from pywebpush import WebPushException  # type: ignore
from pywebpush import webpush  # type: ignore
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import NotificationHistory
from app.models.notification import PushSubscription
from app.schemas.notification import NotificationType
from app.schemas.notification import PushSubscriptionCreate
from app.services.notification_content import generate_notification_content

logger = logging.getLogger(__name__)


type NotificationContext = dict[str, str | int | None]
type SubscriptionInfo = dict[str, str | bytes | dict[str, str | bytes]]


def create_subscription(
    db: Session,
    user_id: UUID,
    subscription_data: PushSubscriptionCreate,
) -> PushSubscription:
    """
    Push通知サブスクリプションを作成する

    Args:
        db: データベースセッション
        user_id: ユーザーID
        subscription_data: サブスクリプション情報

    Returns:
        作成されたPushSubscriptionオブジェクト
    """
    # 既存のサブスクリプションを削除（同じendpointは1つのみ）
    db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id,
        PushSubscription.endpoint == subscription_data.endpoint,
    ).delete()

    subscription = PushSubscription(
        user_id=user_id,
        endpoint=subscription_data.endpoint,
        p256dh_key=subscription_data.p256dh_key,
        auth_key=subscription_data.auth_key,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    logger.info(f"Created push subscription for user {user_id}")
    return subscription


def delete_subscription(db: Session, user_id: UUID, endpoint: str) -> bool:
    """
    Push通知サブスクリプションを削除する

    Args:
        db: データベースセッション
        user_id: ユーザーID
        endpoint: エンドポイントURL

    Returns:
        削除に成功した場合True
    """
    result = (
        db.query(PushSubscription)
        .filter(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
        .delete()
    )
    db.commit()

    logger.info(f"Deleted push subscription for user {user_id}: {result} rows")
    return result > 0


# ==================== 通知履歴関連 ====================


def create_notification_history(
    db: Session,
    user_id: UUID,
    notification_type: NotificationType,
    title: str,
    body: str,
    url: str | None = None,
) -> NotificationHistory:
    """
    通知履歴を作成する

    Args:
        db: データベースセッション
        user_id: ユーザーID
        notification_type: 通知タイプ
        title: 通知タイトル
        body: 通知本文
        url: 遷移先URL

    Returns:
        作成されたNotificationHistoryオブジェクト
    """
    notification = NotificationHistory(
        user_id=user_id,
        notification_type=notification_type.value,
        title=title,
        body=body,
        url=url,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    logger.info(f"Created notification history for user {user_id}: {title}")
    return notification


def get_notification_history(
    db: Session,
    user_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[NotificationHistory]:
    """
    ユーザーの通知履歴を取得する

    Args:
        db: データベースセッション
        user_id: ユーザーID
        limit: 取得件数
        offset: オフセット

    Returns:
        通知履歴のリスト
    """
    return (
        db.query(NotificationHistory)
        .filter(NotificationHistory.user_id == user_id)
        .order_by(NotificationHistory.created_at.desc())  # type: ignore
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_unread_count(db: Session, user_id: UUID) -> int:
    """ユーザーの未読通知数を取得する"""
    return (
        db.query(NotificationHistory)
        .filter(NotificationHistory.user_id == user_id, NotificationHistory.is_read == False)  # noqa: E712
        .count()
    )


def get_total_count(db: Session, user_id: UUID) -> int:
    """ユーザーの通知総数を取得する"""
    return db.query(NotificationHistory).filter(NotificationHistory.user_id == user_id).count()


def mark_as_read(db: Session, notification_id: UUID, user_id: UUID) -> bool:
    """
    通知を既読にする

    Args:
        db: データベースセッション
        notification_id: 通知ID
        user_id: ユーザーID（所有者確認用）

    Returns:
        成功した場合True
    """
    result = (
        db.query(NotificationHistory)
        .filter(
            NotificationHistory.id == notification_id,
            NotificationHistory.user_id == user_id,
        )
        .update({"is_read": True})
    )
    db.commit()
    return result > 0


def mark_all_as_read(db: Session, user_id: UUID) -> int:
    """
    すべての通知を既読にする

    Args:
        db: データベースセッション
        user_id: ユーザーID

    Returns:
        更新された通知数
    """
    result = (
        db.query(NotificationHistory)
        .filter(
            NotificationHistory.user_id == user_id,
            NotificationHistory.is_read == False,  # noqa: E712
        )
        .update({"is_read": True})
    )
    db.commit()
    return result


# ==================== Push通知送信 ====================


def _build_notification_payload(
    title: str,
    body: str,
    url: str | None,
    context: NotificationContext,
) -> str:
    """
    通知ペイロードを構築する

    Args:
        title: 通知タイトル
        body: 通知本文
        url: 遷移先URL
        context: 追加コンテキスト

    Returns:
        JSON文字列化されたペイロード
    """
    return json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            "timestamp": context.get("timestamp"),
        }
    )


def _build_subscription_info(subscription: PushSubscription) -> SubscriptionInfo:
    """
    webpush用のサブスクリプション情報を構築する

    Args:
        subscription: PushSubscriptionオブジェクト

    Returns:
        webpush用のサブスクリプション情報辞書
    """
    return {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh_key,
            "auth": subscription.auth_key,
        },
    }


def _send_to_subscription(
    db: Session,
    subscription: PushSubscription,
    title: str,
    body: str,
    url: str | None,
    context: NotificationContext,
    vapid_claims: dict[str, str | int],
) -> bool:
    """
    個別のサブスクリプションにPush通知を送信する

    Args:
        db: データベースセッション
        subscription: 送信先サブスクリプション
        title: 通知タイトル
        body: 通知本文
        url: 遷移先URL
        context: コンテキスト情報
        vapid_claims: VAPID claims

    Returns:
        送信成功した場合True
    """
    try:
        payload = _build_notification_payload(title, body, url, context)
        subscription_info = _build_subscription_info(subscription)

        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims=vapid_claims,
        )

        logger.info(f"Push notification sent to {subscription.endpoint[:50]}...")
        return True

    except WebPushException as e:
        logger.error(f"Failed to send push notification: {e}")

        # 410 Gone や 404 Not Found の場合は無効なサブスクリプションとして削除
        if e.response and e.response.status_code in [404, 410]:
            logger.info(f"Removing invalid subscription: {subscription.id}")
            db.delete(subscription)
            db.commit()

        return False

    except Exception as e:
        logger.error(f"Unexpected error sending push notification: {e}")
        return False


def send_push_notification(
    user_id: UUID,
    notification_type: NotificationType,
    context: NotificationContext,
) -> int:
    """
    指定ユーザーにPush通知を送信する

    BackgroundTasksから呼び出されるため、内部で新しいDBセッションを作成します。

    Args:
        user_id: 送信先ユーザーID
        notification_type: 通知タイプ
        context: 通知コンテンツ生成に必要なコンテキスト

    Returns:
        送信成功した通知の数
    """
    # 新しいDBセッションを作成（BackgroundTasksで実行されるため）
    from app.db.session import SessionLocal

    db = SessionLocal()

    try:
        # 1. コンテンツを生成
        title, body, url = generate_notification_content(notification_type, context)

        # 2. 通知履歴を保存
        create_notification_history(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            url=url,
        )

        # VAPIDキーが設定されていない場合はスキップ
        if not settings.vapid_private_key or not settings.vapid_public_key:
            logger.warning("VAPID keys not configured, skipping push notification")
            return 0

        # 3. 宛先取得
        subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()

        if not subscriptions:
            logger.info(f"No push subscriptions found for user {user_id}")
            return 0

        # 4. VAPID設定
        vapid_claims = {"sub": settings.vapid_subject}

        # 5. 各サブスクリプションに送信
        success_count = 0
        for subscription in subscriptions:
            if _send_to_subscription(db, subscription, title, body, url, context, vapid_claims):
                success_count += 1

        logger.info(f"Sent {success_count}/{len(subscriptions)} push notifications to user {user_id}")
        return success_count

    finally:
        db.close()
