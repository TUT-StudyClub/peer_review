# プッシュ通知機能 - 段階的実装ガイド（v2）

peer_review-main プロジェクト用に修正されたファイルです。

---

## 修正点（v1からの変更）

- UUIDの型定義を `UUIDType` に変更（プロジェクトの規約に合わせた）
- インポートスタイルを統一（`from x import y` 形式）
- `datetime.UTC` を使用（`timezone.utc` ではなく）
- API_BASE_URL の環境変数名を `NEXT_PUBLIC_API_BASE_URL` に変更

---

## 実装順序

| Step | 内容 | 難易度 | 所要時間 |
|------|------|--------|---------|
| **Step 1** | 基盤実装（VAPID、モデル、API、UI） | ⭐⭐ | 1-2時間 |
| **Step 2** | レビュー受信通知 | ⭐ | 15分 |
| **Step 3** | 教授フィードバック通知 | ⭐ | 15分 |
| **Step 4** | メタ評価通知 | ⭐ | 15分 |
| **Step 5** | 締切リマインダー通知 | ⭐⭐ | 30分 |

---

## フォルダ構成

```
push_notification_steps_v2/
├── README.md                    # このファイル
├── step1_base/                  # 基盤実装
│   ├── README.md               # セットアップ手順
│   ├── backend/app/
│   │   ├── models/
│   │   │   ├── push_subscription.py
│   │   │   └── notification_preference.py
│   │   ├── services/
│   │   │   └── push_notification.py
│   │   ├── schemas/
│   │   │   └── notification.py
│   │   └── api/routes/
│   │       └── notifications.py
│   └── frontend/
│       ├── public/
│       │   └── sw.js
│       └── src/
│           ├── lib/
│           │   └── pushNotification.ts
│           └── components/
│               └── NotificationSettings.tsx
│
├── step2_review_received/      # レビュー受信通知
│   └── README.md
│
├── step3_feedback_received/    # 教授FB通知
│   └── README.md
│
├── step4_meta_review/          # メタ評価通知
│   └── README.md
│
└── step5_deadline_reminder/    # 締切リマインダー
    └── README.md
```

---

## 環境変数（.env）

```env
VAPID_PUBLIC_KEY=BN_QZqd56qHVwmPS6us8x8iXcoKDFXoOJ047GryqrJzPY3iRiRGKf_pnCFH3rWnFv7F7KpgRI5FabMZbreW1_j8
VAPID_PRIVATE_KEY=Up0J3AEQRJ9GzKtMybmOdZCGa88SBsb0s1HukvvGUR0
VAPID_CLAIMS_EMAIL=admin@example.com
```

---

## 依存関係

```bash
pip install pywebpush
```

または `pyproject.toml` に追加:
```toml
"pywebpush>=2.0.0",
```

---

## 通知一覧

| 通知タイプ | トリガー | 送信先 |
|-----------|---------|-------|
| review_received | レビュー提出時 | 提出物の作成者 |
| feedback_received | 教授FB送信時 | 学生 |
| meta_review | メタ評価提出時 | レビュー作成者 |
| deadline_reminder | 締切前（バッチ） | 未提出の学生 |

---

## トラブルシューティング

### 通知が届かない

1. ブラウザで通知が許可されているか確認
2. VAPID鍵が正しく設定されているか確認
3. `push_subscriptions` テーブルにレコードがあるか確認
4. バックエンドのログでエラーがないか確認

### 「このブラウザはプッシュ通知に対応していません」

- Safari（iOS）はPWA化が必要
- HTTP環境では動作しない（localhostは例外）

### 「プッシュ通知がブロックされています」

- ブラウザの設定でサイトの通知を許可
- 一度ブロックすると手動で許可が必要
