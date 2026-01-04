# チュートリアル完了フラグの管理（オンボーディング状態）

## 方針

- 方式: **ユーザープロパティ管理**。初回ログイン後のチュートリアル表示有無をDBで永続化する。
- 保存先: ユーザーテーブル (`users`) にフラグを追加。
- データ型: `Boolean` (デフォルト: `false`)。
- スコープ: ユーザー単位。デバイスやブラウザを跨いでも「一度完了すれば再表示しない」仕様とする。
- 拡張性: 将来的に「機能Aのチュートリアル」「機能Bのチュートリアル」と増える可能性を考慮し、命名は具体的（例: `has_completed_onboarding`）にする。

## 実装概要

**DB構成 (`users` テーブル)**
- `has_completed_onboarding`: `BOOLEAN`, `NOT NULL`, `DEFAULT FALSE`


**バックエンド API**
- 追加先: `backend/app/api/routes/users.py` の `router` にエンドポイントを追加
- スキーマ: `backend/app/schemas/user.py` の `UserPublic` に `has_completed_onboarding: bool` を追加
- `GET /users/me`: 現在のフラグ状態を含めてユーザー情報を返す。
- `PATCH /users/me/complete-onboarding`: チュートリアル完了またはスキップ時に実行。フラグを `true` に更新する（同一フラグで運用、ロール制限なし・ログイン必須）。


**フロントエンド (React)**
- 初回ロード時（またはログイン後）に `has_completed_onboarding` を確認。
- `false` の場合のみチュートリアルコンポーネント（React Joyride等）を起動。
- チュートリアルの `onFinish` または `onSkip` コールバックでAPIを叩き、フラグを更新する。


## 処理フロー

| ステップ | 構成要素 | 動作内容 |
| --- | --- | --- |
| 1. 判定 | React | ユーザー情報の `has_completed_onboarding` が `false` か確認 |
| 2. 表示 | React | チュートリアルUI（モーダルやガイド）を表示 |
| 3. 完了 | User | チュートリアルを最後まで見る、もしくは「スキップ」を押下 |
| 4. 更新 | API | `PATCH /users/me/complete-onboarding` を呼び出し |
| 5. 永続化 | DB | 当該ユーザーのフラグを `true` に更新 |
| 6. 以降 | React | 次回以降のアクセスではフラグが `true` なので表示されない |

## 実装設計（既存サービスとの整合性）

- **認証との連携:** `current_user` (Depends) を取得する既存のセキュリティロジックを利用し、安全にフラグを更新する。
- **エラーハンドリング:** 万が一フラグ更新APIが失敗しても、メイン機能（レビュー投稿等）の妨げにならないよう、フロントエンド側でサイレントにリトライ、あるいは次回のログイン時に再度表示されることを許容する。

## 移行手順

- **DBマイグレーション:** `backend/alembic/versions/` に新リビジョンを追加し、`users` テーブルへ `has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE` を追加。マイグレーション内で既存ユーザーを一律 `true` にバックフィルし、以降はデフォルト `false`（新規は表示）とする。
- **API実装:** `UserPublic` に新フィールドを追加し、`GET /users/me` のレスポンスへ反映。
- **フロントエンド実装:** チュートリアルライブラリを導入し、`useUser` 等のフェッチ層で `has_completed_onboarding` を参照。`PATCH` 成功時にキャッシュを更新して再フェッチを抑制する。
