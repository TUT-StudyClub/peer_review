"""プッシュ通知送信サービス"""

import json
import logging
from typing import TYPE_CHECKING

from pywebpush import WebPushException
from pywebpush import webpush
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification_preference import NotificationPreference
from app.models.push_subscription import PushSubscription

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class PushNotificationService:
    """プッシュ通知送信サービス"""

    def __init__(self):
        self.vapid_private_key = settings.vapid_private_key
        self.vapid_public_key = settings.vapid_public_key
        self.vapid_claims = {"sub": f"mailto:{settings.vapid_claims_email}"}

    @property
    def is_configured(self) -> bool:
        """VAPID鍵が設定されているか"""
        return bool(self.vapid_private_key and self.vapid_public_key)

    def send_to_user(
        self,
        db: Session,
        user_id: str,
        title: str,
        body: str,
        url: str | None = None,
        notification_type: str = "general",
    ) -> dict:
        """
        特定ユーザーにプッシュ通知を送信

        Args:
            db: DBセッション
            user_id: 送信先ユーザーID
            title: 通知タイトル
            body: 通知本文
            url: クリック時の遷移先URL
            notification_type: 通知種別（設定確認用）
                - review_received: レビュー受信
                - deadline_reminder: 締切リマインダー
                - feedback_received: 教授FB
                - meta_review: メタ評価

        Returns:
            {"success": int, "failed": int, "skipped": str | None}
        """
        if not self.is_configured:
            logger.warning("VAPID keys not configured, skipping push notification")
            return {"success": 0, "failed": 0, "skipped": "not_configured"}

        # 通知設定を確認
        pref = (
            db.query(NotificationPreference)
            .filter(NotificationPreference.user_id == user_id)
            .first()
        )

        if pref and not self._is_notification_enabled(pref, notification_type):
            return {"success": 0, "failed": 0, "skipped": "disabled_by_user"}

        # ユーザーの全購読情報を取得（複数デバイス対応）
        subscriptions = (
            db.query(PushSubscription)
            .filter(PushSubscription.user_id == user_id)
            .all()
        )

        if not subscriptions:
            return {"success": 0, "failed": 0, "skipped": "no_subscription"}

        success_count = 0
        failed_count = 0

        for sub in subscriptions:
            try:
                self._send_notification(sub, title, body, url)
                success_count += 1
                logger.info(f"Push notification sent to user {user_id}")
            except WebPushException as e:
                failed_count += 1
                logger.error(f"Push notification failed: {e}")

                # 410 Gone または 404 = 購読が無効化された → 削除
                if e.response and e.response.status_code in (404, 410):
                    logger.info(f"Removing invalid subscription: {sub.id}")
                    db.delete(sub)

        db.commit()
        return {"success": success_count, "failed": failed_count, "skipped": None}

    def _send_notification(
        self,
        subscription: PushSubscription,
        title: str,
        body: str,
        url: str | None = None,
    ):
        """単一の購読先に通知を送信"""

        # 通知ペイロード（Service Workerで受け取る）
        payload = json.dumps(
            {
                "title": title,
                "body": body,
                #"icon": "/icon-192.png",
                #"badge": "/badge-72.png",
                "url": url or "/",
            }
        )

        # 購読情報を辞書形式に変換
        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh_key,
                "auth": subscription.auth_key,
            },
        }

        # プッシュ送信
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=self.vapid_private_key,
            vapid_claims=self.vapid_claims,
        )

    def _is_notification_enabled(
        self,
        pref: NotificationPreference,
        notification_type: str,
    ) -> bool:
        """通知種別ごとの設定を確認"""
        type_map = {
            "review_received": pref.push_review_received,
            "deadline_reminder": pref.push_deadline_reminder,
            "feedback_received": pref.push_feedback_received,
            "meta_review": pref.push_meta_review,
        }
        # 未知の種別はデフォルトでTrue
        return type_map.get(notification_type, True)


# シングルトンインスタンス
push_service = PushNotificationService()
