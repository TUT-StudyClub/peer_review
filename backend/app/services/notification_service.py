"""Push通知送信サービス"""

import json
import logging
from typing import Any
from uuid import UUID

from pywebpush import WebPushException
from pywebpush import webpush
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import PushSubscription
from app.schemas.notification import NotificationType
from app.schemas.notification import PushSubscriptionCreate
from app.services.notification_content import generate_notification_content

logger = logging.getLogger(__name__)


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


def send_push_notification(
    db: Session,
    user_id: UUID,
    notification_type: NotificationType,
    context: dict[str, Any],
) -> int:
    """
    指定ユーザーにPush通知を送信する

    Args:
        db: データベースセッション
        user_id: 送信先ユーザーID
        notification_type: 通知タイプ
        context: 通知コンテンツ生成に必要なコンテキスト

    Returns:
        送信成功した通知の数
    """
    # VAPIDキーが設定されていない場合はスキップ
    if not settings.vapid_private_key or not settings.vapid_public_key:
        logger.warning("VAPID keys not configured, skipping push notification")
        return 0

    # 1. コンテンツを生成
    title, body, url = generate_notification_content(notification_type, context)

    # 2. 宛先取得
    subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()

    if not subscriptions:
        logger.info(f"No push subscriptions found for user {user_id}")
        return 0

    # 3. VAPID設定
    vapid_claims = {"sub": settings.vapid_subject}

    # 4. 各サブスクリプションに送信
    success_count = 0
    for subscription in subscriptions:
        try:
            payload = json.dumps(
                {
                    "title": title,
                    "body": body,
                    "url": url,
                    "timestamp": context.get("timestamp"),
                }
            )

            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh_key,
                        "auth": subscription.auth_key,
                    },
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims=vapid_claims,
            )

            success_count += 1
            logger.info(f"Push notification sent to {subscription.endpoint[:50]}...")

        except WebPushException as e:
            logger.error(f"Failed to send push notification: {e}")

            # 410 Gone や 404 Not Found の場合は無効なサブスクリプションとして削除
            if e.response and e.response.status_code in [404, 410]:
                logger.info(f"Removing invalid subscription: {subscription.id}")
                db.delete(subscription)
                db.commit()

        except Exception as e:
            logger.error(f"Unexpected error sending push notification: {e}")

    logger.info(f"Sent {success_count}/{len(subscriptions)} push notifications to user {user_id}")
    return success_count
