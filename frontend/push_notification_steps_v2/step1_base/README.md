# Step 1: プッシュ通知の基盤実装

通知機能を使うための土台を作ります。この段階では通知は送信されません。

## 目標

- VAPID鍵の設定
- DBモデル作成
- 通知API作成
- フロントエンドで購読できるようにする

---

## 1. 環境変数を設定

`backend/.env` に追加:

```env
VAPID_PUBLIC_KEY=BN_QZqd56qHVwmPS6us8x8iXcoKDFXoOJ047GryqrJzPY3iRiRGKf_pnCFH3rWnFv7F7KpgRI5FabMZbreW1_j8
VAPID_PRIVATE_KEY=Up0J3AEQRJ9GzKtMybmOdZCGa88SBsb0s1HukvvGUR0
VAPID_CLAIMS_EMAIL=admin@example.com
```

---

## 2. 依存関係を追加

```bash
pip install pywebpush
```

または `pyproject.toml` の dependencies に追加:
```toml
"pywebpush>=2.0.0",
```

---

## 3. バックエンド実装

### 3.1 config.py に設定追加

`backend/app/core/config.py` の `Settings` クラスに追加:

```python
# Web Push通知 (VAPID)
vapid_public_key: str | None = None
vapid_private_key: str | None = None
vapid_claims_email: str = "admin@example.com"
```

### 3.2 新規ファイル作成

以下のファイルを対応するパスに配置:

1. `backend/app/models/push_subscription.py`
2. `backend/app/models/notification_preference.py`
3. `backend/app/services/push_notification.py`
4. `backend/app/schemas/notification.py`
5. `backend/app/api/routes/notifications.py`

### 3.3 既存ファイルの変更

#### models/__init__.py

インポートに追加:
```python
from app.models.notification_preference import NotificationPreference
from app.models.push_subscription import PushSubscription
```

`__all__` に追加:
```python
"NotificationPreference",
"PushSubscription",
```

#### models/user.py

リレーションを追加（既存のリレーションの後に）:
```python
# 通知関連
push_subscriptions = relationship(
    "PushSubscription",
    back_populates="user",
    cascade="all, delete-orphan",
)
notification_preference = relationship(
    "NotificationPreference",
    back_populates="user",
    uselist=False,
    cascade="all, delete-orphan",
)
```

#### api/router.py

インポートに追加:
```python
from app.api.routes import notifications
```

ルーター登録を追加:
```python
api_router.include_router(notifications.router, tags=["notifications"])
```

---

## 4. マイグレーション

```bash
cd backend
alembic revision --autogenerate -m "add_push_notifications"
alembic upgrade head
```

---

## 5. フロントエンド実装

### 5.1 新規ファイル作成

1. `frontend/public/sw.js`
2. `frontend/src/lib/pushNotification.ts`
3. `frontend/src/components/NotificationSettings.tsx`

### 5.2 MyPageClient.tsx の変更

インポートに追加:
```tsx
import { NotificationSettings } from "@/components/NotificationSettings";
```

JSXの最後（`</div>` の前）に追加:
```tsx
{/* 通知設定 */}
<NotificationSettings />
```

---

## 6. 動作確認

1. マイページにアクセス
2. 「プッシュ通知を有効にする」をクリック
3. ブラウザの許可ダイアログで「許可」
4. 「プッシュ通知は有効です」と表示されれば成功

※ この段階では通知は送信されません
