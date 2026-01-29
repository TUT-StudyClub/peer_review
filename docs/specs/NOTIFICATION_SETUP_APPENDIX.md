# Web Push通知実装計画 - 補足資料

## 🎯 この設計のメリット

### 1. 保守性が高い

**通知の文言変更が容易:**
- 通知の文言を変えたいとき、APIのエンドポイントを修正せず `generate_notification_content` だけを修正すれば全通知に反映されます。
- 通知タイプごとにテンプレートが分離されているため、変更の影響範囲が明確です。

**段階的な拡張が可能:**
- 新しい通知タイプを追加する際は、`NotificationType` Enumと `generate_notification_content` に1つのcaseを追加するだけです。
- 既存のコードに影響を与えません。

### 2. 型安全性

**Enumによる型制約:**
- `NotificationType` Enumを使うことで、存在しない通知タイプを指定するミスを防げます。
- IDEの補完機能が使えるため、開発効率が向上します。

**UUID型の統一:**
- プロジェクト全体でUUID型を使用しているため、ID関連のバグが発生しにくいです。

### 3. ユーザー体験の向上

**段階的な許可プロンプト:**
- `permission === 'default'`（未設定）の時だけバナーが出るため、既に設定済みのユーザーや拒否したユーザーには邪魔な表示が出ません。
- ブラウザネイティブの無機質なダイアログの前に「なぜ通知が必要か」を説明できるため、許可率が上がります。
- 通知権限（ブラウザ設定）はアプリ側から元に戻せないため、解除は「サブスクリプション削除」として扱います。

**非侵入的なUI:**
- バナーは画面下部に控えめに表示され、いつでも閉じることができます。
- モバイル対応（`bottom-20 md:bottom-4`）により、ボトムナビゲーションと重ならないように配置されます。

### 4. セキュリティ

**VAPID認証:**
- VAPIDを使用することで、通知送信者の身元を検証できます。
- 不正な通知送信を防止します。

**JWT認証との統合:**
- Push通知サブスクリプションの登録・削除にJWT認証が必要なため、第三者による不正な操作を防げます。

### 5. スケーラビリティ

**バックグラウンド処理:**
- `BackgroundTasks`を使用することで、Push通知送信がAPIレスポンスを遅延させません。
- 将来的にCeleryなどの本格的なタスクキューに移行することも容易です。

**複数デバイス対応:**
- 1ユーザーが複数のデバイス（PC、スマホ、タブレット）で通知を受け取れます。
- `user_id`に紐づく全てのサブスクリプションに通知が送信されます。

---

## 🔧 トラブルシューティング

### 通知が届かない場合

1. **ブラウザの対応状況を確認**
   - Chrome/Edge/Firefox/Safariの最新版を使用していますか？
   - プライベートブラウジングモードではPush通知が動作しません。

2. **HTTPS接続を確認**
   - Push通知はHTTPS環境でのみ動作します（localhost除く）。
   - 本番環境ではCloudflareなどでHTTPSを有効化してください。

3. **VAPIDキーの設定を確認**
   - `.env`ファイルに正しくVAPIDキーが設定されていますか？
   - `VAPID_SUBJECT`はメールアドレス形式（`mailto:xxx@xxx.com`）になっていますか？

4. **Service Workerの登録を確認**
   - ブラウザの開発者ツール → Application → Service Workers で登録状態を確認できます。
   - エラーが出ている場合は、`sw.js`の構文エラーや配置ミスの可能性があります。

5. **サブスクリプションの登録を確認**
   - データベースの`push_subscriptions`テーブルにレコードが作成されていますか？
   - APIエンドポイント（`/notifications/subscribe`）が正しく動作していますか？

### Service Workerが登録されない場合

1. **ファイルの配置を確認**
   - `sw.js`は`frontend/public/`直下に配置されていますか？
   - Next.jsでは`public/`フォルダのファイルが`/`直下で配信されます。

2. **HTTPSを確認**
   - Service WorkerはHTTPS環境でのみ動作します（localhost除く）。

3. **スコープを確認**
   - Service Workerは登録されたパス以下でのみ動作します。
   - `/sw.js`として登録すれば、全ページで有効になります。

### 通知の文言が正しく表示されない場合

1. **Payloadの構造を確認**
   - `send_push_notification`で送信しているJSONの構造が正しいですか？
   - `sw.js`の`event.data.json()`で正しくパースできていますか？

2. **文字コードを確認**
   - UTF-8エンコーディングが使用されていますか？

---

## 📋 実装チェックリスト

### Backend（Phase 1）

- [ ] `pywebpush`と`py-vapid`をインストール
- [ ] VAPIDキーペアを生成し、`.env`に設定
- [ ] `backend/app/schemas/notification.py`を作成
- [ ] `backend/app/models/notification.py`を作成
- [ ] マイグレーションファイルを作成し、実行
- [ ] `backend/app/core/config.py`にVAPID設定を追加
- [ ] `backend/app/services/notification_content.py`を作成
- [ ] `backend/app/services/notification_service.py`を作成
- [ ] `backend/app/api/routes/notifications.py`を作成
- [ ] `backend/app/api/router.py`にルーターを追加

### Frontend（Phase 2）

- [ ] `frontend/public/sw.js`を作成
- [ ] `frontend/src/lib/notifications.ts`を作成
- [ ] `frontend/src/hooks/usePushNotification.ts`を作成
- [ ] `frontend/src/components/NotificationBanner.tsx`を作成
- [ ] `frontend/src/components/AppShell.tsx`にバナーを追加

### Integration（Phase 3）

- [ ] レビュー作成時の通知送信を実装
- [ ] 動作確認（実際に通知が届くか）
- [ ] エラーハンドリングの確認
- [ ] ログ出力の確認

### Optional（将来的な拡張）

- [ ] 締め切り通知の定期実行（Celeryタスク）
- [ ] システム通知の管理画面
- [ ] 通知設定画面（ユーザーが通知の種類を選択できる）
- [ ] 通知履歴の保存と表示

---

## 🚀 デプロイ時の注意事項

### 環境変数の設定

本番環境の`.env`ファイルまたは環境変数に以下を設定してください：

```bash
VAPID_PRIVATE_KEY="本番用の秘密鍵"
VAPID_PUBLIC_KEY="本番用の公開鍵"
VAPID_SUBJECT="mailto:admin@yourdomain.com"
```

**重要:** VAPIDキーは環境ごとに異なるものを使用することを推奨します。

### HTTPS化

Push通知はHTTPS環境でのみ動作します（localhost除く）。AWSとCloudflareを使用する場合：

1. CloudflareでSSL/TLS暗号化を「Full」または「Full (strict)」に設定
2. ALBにSSL証明書を設定
3. フロントエンドの`NEXT_PUBLIC_API_BASE_URL`を`https://`で始まるURLに設定

### Service Workerのキャッシュ対策

Service Workerはブラウザに積極的にキャッシュされます。更新時には：

1. `sw.js`のバージョン番号をコメントに追記（例：`// v1.0.1`）
2. ブラウザの開発者ツールで「Update on reload」を有効化してテスト
3. 本番では、ユーザーがページをリロードすると自動的に新しいService Workerに更新されます

### データベースマイグレーション

本番環境でのマイグレーション実行：

```bash
cd backend
task db:migrate
```

ダウンタイムを最小化するため、マイグレーションは非破壊的（カラム追加のみ）になっています。

---

## 📚 参考資料

- [Web Push Notifications API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [pywebpush Documentation](https://github.com/web-push-libs/pywebpush)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Best Practices for Push Notifications](https://web.dev/push-notifications-overview/)
