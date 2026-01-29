# Web Push通知実装計画

## 🎯 概要

本ドキュメントは、Peer ReviewプラットフォームにWeb Push通知機能を追加するための実装計画です。既存のプロジェクト構造（UUID型ID、DDD、FastAPI、Next.js App Router）に完全適合した実装手順を提供します。

## 🏗️ アーキテクチャ方針

- **Backend**: DDD構造に従い、`models/`、`schemas/`、`services/`、`api/routes/` に分離
- **ID管理**: UUID型（uuid4）を使用
- **環境変数**: `pydantic-settings` の `Settings` クラスで一元管理
- **Frontend**: Next.js App Router構造に準拠
- **依存関係**: `pywebpush`（バックエンド）、Service Worker API（フロントエンド）

## 📦 必要な依存関係

### Backend（コマンドで追加）

```bash
cd backend
uv add "pywebpush>=1.14.0" "py-vapid>=1.9.0"
```

### 依存関係の同期

```bash
task backend:install
```

## 📅 Phase 1: バックエンドの構造化 (Notification Factory)

「レビュー受信」以外の通知（例：提出締め切り、運営からのお知らせ）にも対応できるよう、通知生成ロジックを分離します。

### 1.1 通知タイプの定義

`backend/app/schemas/notification.py`（新規作成）

```python
"""通知関連のスキーマ定義"""
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, Field
from pydantic import ConfigDict
from datetime import datetime

class NotificationType(str, Enum):
    """通知タイプの定義"""
    REVIEW_RECEIVED = "review_received"    # レビューが届いた
    SUBMISSION_DUE = "submission_due"      # 締め切り間近
    SYSTEM_INFO = "system_info"            # システム通知


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
```

### 1.2 データベースモデルの作成

`backend/app/models/notification.py`（新規作成）

```python
"""通知関連のデータベースモデル"""
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from app.db.base import Base
from app.db.base import UUIDType


class PushSubscription(Base):
  """Push通知サブスクリプションモデル"""

  __tablename__ = "push_subscriptions"

  id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
  user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
  endpoint: Mapped[str] = mapped_column(Text)
  p256dh_key: Mapped[str] = mapped_column(String(255), comment="公開鍵")
  auth_key: Mapped[str] = mapped_column(String(255), comment="認証シークレット")
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  def __repr__(self) -> str:
    return f"<PushSubscription(id={self.id}, user_id={self.user_id})>"
```

### 1.3 マイグレーションファイルの作成

```bash
# バックエンドディレクトリに移動
cd backend

# マイグレーションファイル生成
uv run alembic revision --autogenerate -m "add push subscriptions"
```

生成されたマイグレーションファイル（`backend/alembic/versions/XXXXX_add_push_subscriptions.py`）を編集：

```python
"""add push subscriptions

Revision ID: XXXXX
Revises: YYYYY
Create Date: 2026-01-30 XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'XXXXX'
down_revision = 'YYYYY'  # 最新のマイグレーションIDを指定
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
      "push_subscriptions",
      sa.Column("id", sa.Uuid(), nullable=False),
      sa.Column("user_id", sa.Uuid(), nullable=False),
      sa.Column("endpoint", sa.Text(), nullable=False),
      sa.Column("p256dh_key", sa.String(length=255), nullable=False),
      sa.Column("auth_key", sa.String(length=255), nullable=False),
      sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
      sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
      sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_push_subscriptions_user_id"), "push_subscriptions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_push_subscriptions_user_id"), table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
```

```bash
# マイグレーション実行
uv run alembic upgrade head
```

### 1.4 環境変数の追加

`backend/app/core/config.py` の `Settings` クラスに追加：

```python
class Settings(BaseSettings):
  # ... 既存の設定 ...

  # Web Push通知設定
  vapid_private_key: str = ""
  vapid_public_key: str = ""
  vapid_subject: str = "mailto:admin@example.com"
```

`.env` ファイルに追加：

```bash
# Web Push通知設定
VAPID_PRIVATE_KEY="your-private-key-here"
VAPID_PUBLIC_KEY="your-public-key-here"
VAPID_SUBJECT="mailto:your-email@example.com"
```

**VAPIDキーペアの生成方法：**

```bash
cd backend
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -c "from py_vapid import Vapid; v = Vapid(); v.generate_keys(); print('Private Key:', v.private_key.decode()); print('Public Key:', v.public_key.decode())"
```

### 1.5 通知コンテンツ生成ロジック (Template Factory)

通知の中身（タイトル・本文・URL）を生成する専用の関数を作成します。

`backend/app/services/notification_content.py`（新規作成）

```python
"""通知コンテンツ生成サービス"""
from typing import Dict, Any, Tuple
from uuid import UUID
from app.schemas.notification import NotificationType


def generate_notification_content(
    notification_type: NotificationType,
    context: Dict[str, Any]
) -> Tuple[str, str, str]:
    """
    通知タイプとコンテキストデータから (Title, Body, URL) を生成する

    Args:
        notification_type: 通知タイプ
        context: 通知に必要なコンテキストデータ

    Returns:
        (title, body, url) のタプル
    """
    match notification_type:
        case NotificationType.REVIEW_RECEIVED:
            reviewer_name = context.get("reviewer_name", "レビュアー")
            assignment_title = context.get("assignment_title", "課題")
        assignment_id = context.get("assignment_id")
            return (
                "レビューが届きました！",
                f"{assignment_title}に対して{reviewer_name}さんからフィードバックがあります。",
          f"/assignments/{assignment_id}" if assignment_id else "/assignments"
            )

        case NotificationType.SUBMISSION_DUE:
            days = context.get("days_left", 1)
            assignment_id = context.get("assignment_id")
            return (
                "課題の締め切りが近づいています",
                f"あと{days}日で提出締め切りです。準備はできていますか？",
                f"/assignments/{assignment_id}" if assignment_id else "/assignments"
            )

        case NotificationType.SYSTEM_INFO:
            return (
                context.get("title", "お知らせ"),
                context.get("body", "重要なお知らせがあります。"),
                context.get("url", "/")
            )

        case _:
            return ("通知", "新しい通知があります", "/")
```

### 1.6 汎用的な送信サービスの実装

`backend/app/services/notification_service.py`（新規作成）

```python
"""Push通知送信サービス"""
from typing import Dict, Any
from uuid import UUID
import json
import logging
from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException

from app.models.notification import PushSubscription
from app.schemas.notification import NotificationType, PushSubscriptionCreate
from app.services.notification_content import generate_notification_content
from app.core.config import settings

logger = logging.getLogger(__name__)


def create_subscription(
    db: Session,
    user_id: UUID,
    subscription_data: PushSubscriptionCreate
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
        PushSubscription.endpoint == subscription_data.endpoint
    ).delete()

    subscription = PushSubscription(
        user_id=user_id,
        endpoint=subscription_data.endpoint,
        p256dh_key=subscription_data.p256dh_key,
        auth_key=subscription_data.auth_key
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
    result = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id,
        PushSubscription.endpoint == endpoint
    ).delete()
    db.commit()

    logger.info(f"Deleted push subscription for user {user_id}: {result} rows")
    return result > 0


def send_push_notification(
    db: Session,
    user_id: UUID,
    notification_type: NotificationType,
    context: Dict[str, Any]
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
    # 1. コンテンツを生成
    title, body, url = generate_notification_content(notification_type, context)

    # 2. 宛先取得
    subscriptions = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id
    ).all()

    if not subscriptions:
        logger.info(f"No push subscriptions found for user {user_id}")
        return 0

    # 3. VAPID設定
    vapid_claims = {
        "sub": settings.vapid_subject
    }

    # 4. 各サブスクリプションに送信
    success_count = 0
    for subscription in subscriptions:
        try:
            payload = json.dumps({
                "title": title,
                "body": body,
                "url": url,
                "timestamp": context.get("timestamp")
            })

            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh_key,
                        "auth": subscription.auth_key
                    }
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims=vapid_claims
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
```

### 1.7 APIエンドポイントの作成

`backend/app/api/routes/notifications.py`（新規作成）

```python
"""通知関連のAPIエンドポイント"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.schemas.notification import PushSubscriptionCreate, PushSubscriptionResponse
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/subscribe", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe_push_notifications(
    subscription: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Push通知を有効化する（サブスクリプション登録）
    """
    result = notification_service.create_subscription(
        db=db,
        user_id=current_user.id,
        subscription_data=subscription
    )
    return result


@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe_push_notifications(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Push通知を無効化する（サブスクリプション削除）
    """
    success = notification_service.delete_subscription(
        db=db,
        user_id=current_user.id,
        endpoint=endpoint
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )

    return None


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """
    VAPID公開鍵を取得する（フロントエンドで使用）
    """
    from app.core.config import settings
    return {"publicKey": settings.vapid_public_key}
```

`backend/app/api/router.py` に追加：

```python
from app.api.routes import notifications

# ... 既存のルーター設定 ...
api_router.include_router(notifications.router)
```

---

## 📅 Phase 2: フロントエンドの「許可促進」ロジック

ユーザーがいきなりブラウザの許可ダイアログを出されると「ブロック」されやすいため、アプリ内でワンクッション（バナー等）を挟むのがベストプラクティスです。

### 2.1 Service Workerの設定

`frontend/public/sw.js`（新規作成）

```javascript
// Service Worker: Push通知の受信とクリック処理

self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);

  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const title = data.title || '通知';
  const options = {
    body: data.body || '',
    // icon/badge を使う場合は public/ に配置してから指定する
    // icon: '/icon-192x192.png',
    // badge: '/badge-72x72.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // 既に開いているタブがあれば、そこに移動
        for (let client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // なければ新しいタブを開く
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
```

### 2.2 通知ユーティリティの実装

`frontend/src/lib/notifications.ts`（新規作成）

```typescript
/**
 * Push通知関連のユーティリティ関数
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Service Workerを登録する
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Push通知のサブスクリプションを作成し、サーバーに送信する
 */
export async function subscribeUser(): Promise<boolean> {
  try {
    // 1. Service Worker登録
    const registration = await registerServiceWorker();
    if (!registration) {
      throw new Error('Service Worker registration failed');
    }

    // 2. VAPID公開鍵を取得
    const vapidResponse = await fetch(`${API_BASE_URL}/notifications/vapid-public-key`);
    const { publicKey } = await vapidResponse.json();

    // 3. Push通知サブスクリプションを作成
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // 4. サブスクリプション情報を取得
    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
      throw new Error('Invalid subscription object');
    }

    // 5. サーバーに送信
    const token = localStorage.getItem('pure-review-token') ?? sessionStorage.getItem('pure-review-token');
    const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys.p256dh,
        auth_key: subscriptionJson.keys.auth
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save subscription: ${response.statusText}`);
    }

    console.log('Push notification subscription successful');
    return true;
  } catch (error) {
    console.error('Failed to subscribe user:', error);
    return false;
  }
}

/**
 * Push通知のサブスクリプションを解除する
 */
export async function unsubscribeUser(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('No active subscription found');
      return true;
    }

    // 1. ブラウザ側のサブスクリプションを解除
    await subscription.unsubscribe();

    // 2. サーバー側のサブスクリプションを削除
    const token = localStorage.getItem('pure-review-token') ?? sessionStorage.getItem('pure-review-token');
    const response = await fetch(
      `${API_BASE_URL}/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete subscription: ${response.statusText}`);
    }

    console.log('Push notification unsubscribed');
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe user:', error);
    return false;
  }
}

/**
 * VAPID公開鍵をBase64からUint8Arrayに変換する
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### 2.3 通知管理カスタムフック

通知の状態確認と登録処理をまとめたフックを作成します。

`frontend/src/hooks/usePushNotification.ts`（新規作成）

```typescript
'use client';

import { useState, useEffect } from 'react';
import { subscribeUser, unsubscribeUser } from '@/lib/notifications';

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // ブラウザがPush通知に対応しているか確認
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    setIsSupported(true);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      // 1. ブラウザに許可を求める
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // 2. 許可されたら即座にServiceWorker登録＆サーバー送信
        const success = await subscribeUser();
        if (!success) {
          console.error('Failed to subscribe user');
        }
      }
    } catch (error) {
      console.error('Notification setup failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  const disableNotifications = async () => {
    setIsLoading(true);
    try {
      await unsubscribeUser();
      // ブラウザの通知権限自体はアプリから変更できないため、
      // 解除後は現在の権限を再取得する
      setPermission(Notification.permission);
    } catch (error) {
      console.error('Failed to disable notifications', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    permission,
    isSupported,
    isLoading,
    requestPermission,
    disableNotifications
  };
}
```

### 2.4 通知許可バナーコンポーネント

画面上部などに表示する控えめなメッセージです。

`frontend/src/components/NotificationBanner.tsx`（新規作成）

```tsx
'use client';

import { usePushNotification } from '@/hooks/usePushNotification';
import { X, Bell } from 'lucide-react';
import { useState } from 'react';

export default function NotificationBanner() {
  const { permission, isSupported, isLoading, requestPermission } = usePushNotification();
  const [isVisible, setIsVisible] = useState(true);

  // 非対応、既に許可済み、拒否済み、またはユーザーが閉じた場合は表示しない
  if (!isSupported || permission !== 'default' || !isVisible) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 fixed bottom-20 md:bottom-4 right-4 max-w-sm shadow-lg rounded-r z-50">
      <div className="flex gap-3 items-start">
        <div className="flex-shrink-0 mt-0.5">
          <Bell className="text-blue-500" size={20} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-blue-700 text-sm">通知をオンにしませんか？</p>
          <p className="text-blue-600 text-xs mt-1">
            レビューが届いたときに、ブラウザを閉じていても通知を受け取れます。
          </p>
          <button
            onClick={requestPermission}
            disabled={isLoading}
            className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold py-2 px-4 rounded transition"
          >
            {isLoading ? '設定中...' : '通知を許可する'}
          </button>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-blue-400 hover:text-blue-600 flex-shrink-0"
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
```

### 2.5 レイアウトへの配置

ログイン後の共通レイアウト（`AppShell`）にこのバナーを配置します。これでログインユーザーにのみ表示されます。

`frontend/src/components/AppShell.tsx`（既存ファイルに追加）

```tsx
import NotificationBanner from "./NotificationBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* ... 既存のSidebarやヘッダー ... */}
      <main className="mx-auto w-full px-4 pb-24 pt-20 md:pb-8 md:pt-12 md:pl-[354px] md:pr-6 md:max-w-7xl">
        {children}
      </main>
      {user && <NotificationBanner />}
    </div>
  );
}
```

---

## 📅 Phase 3: 実際の利用例（レビュー受信通知）

拡張されたシステムを使って、APIルートで通知を送るコードは以下のようになります。

### 3.1 レビュー作成時の通知送信

`backend/app/api/routes/reviews.py`（既存ファイルに追加）

```python
from fastapi import BackgroundTasks
from app.schemas.notification import NotificationType
from app.services.notification_service import send_push_notification

@router.post("/review-assignments/{review_assignment_id}/submit", response_model=ReviewPublic)
def submit_review(
  review_assignment_id: UUID,
  payload: ReviewSubmit,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user),
  background_tasks: BackgroundTasks = BackgroundTasks(),
) -> ReviewPublic:
  """レビューを提出する"""
  # ... 既存のレビュー作成ロジック ...

  submission = db.query(Submission).filter(Submission.id == review_assignment.submission_id).first()
  assignment = db.query(Assignment).filter(Assignment.id == review_assignment.assignment_id).first()

  if submission and assignment:
    background_tasks.add_task(
      send_push_notification,
      db=db,
      user_id=submission.author_id,
      notification_type=NotificationType.REVIEW_RECEIVED,
      context={
        "reviewer_name": current_user.name,
        "assignment_title": assignment.title,
        "assignment_id": str(assignment.id),
      },
    )

  return review_public
```

### 3.2 締め切り通知の定期実行（Celeryタスクの例）

`backend/app/tasks/notification_tasks.py`（新規作成、オプション）

```python
"""
定期実行タスク（Celery等で実行）
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.assignment import Assignment
from app.schemas.notification import NotificationType
from app.services.notification_service import send_push_notification


def send_deadline_reminders():
    """
    締め切り3日前の課題について、未提出者に通知を送る
    """
    db: Session = SessionLocal()
    try:
        # 3日後が締め切りの課題を取得
        target_date = datetime.now() + timedelta(days=3)
        assignments = db.query(Assignment).filter(
            Assignment.due_at >= target_date,
            Assignment.due_at < target_date + timedelta(days=1)
        ).all()

        for assignment in assignments:
            # 未提出の学生を取得（実際のロジックは要調整）
            students_without_submission = []  # TODO: 実装

            for student in students_without_submission:
                send_push_notification(
                    db=db,
                    user_id=student.id,
                    notification_type=NotificationType.SUBMISSION_DUE,
                    context={
                        "days_left": 3,
                        "assignment_id": str(assignment.id)
                    }
                )
    finally:
        db.close()
```
