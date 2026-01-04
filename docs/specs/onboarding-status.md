# チュートリアル完了フラグの管理（オンボーディング状態）

## 方針

- 方式: **ユーザープロパティ管理**。初回ログイン後のチュートリアル表示有無をDBで永続化する。
- 保存先: ユーザーテーブル (`users`) にフラグを追加。
- データ型: `Boolean` (デフォルト: `false`)。
- スコープ: ユーザー単位。デバイスやブラウザを跨いでも「一度完了すれば再表示しない」仕様とする。
- 拡張性: 将来的に「機能Aのチュートリアル」「機能Bのチュートリアル」と増える可能性を考慮し、命名は具体的（例: `has_completed_onboarding`）にする。

## 実装概要

**DB構成 (`users` テーブル)**
- `has_completed_student_onboarding`: `BOOLEAN`, `NOT NULL`, `DEFAULT FALSE`
- `has_completed_teacher_onboarding`: `BOOLEAN`, `NOT NULL`, `DEFAULT FALSE`


**バックエンド API**
- 追加先: `backend/app/api/routes/users.py` の `router` にエンドポイントを追加
- スキーマ: `backend/app/schemas/user.py` にある `UserPublic` に `has_completed_student_onboarding: bool` と `has_completed_teacher_onboarding: bool` を追加
- `GET /users/me`: 2種類のフラグを含めてユーザー情報を返す。
- `PATCH /users/me/complete-onboarding`: ボディで `role: "student" | "teacher"` を受け取り、該当フラグを `true` に更新する（全ロール（student/teacher）が実行可能、ただし認証必須）。完了とスキップは同一フラグで運用し、必要ならイベントログで区別する。


**フロントエンド (React)**
- 認証状態とユーザー情報は `frontend/src/app/providers.tsx` の `useAuth` コンテキストで管理しており、`useUser` というフックは現状存在しない。
- `user.role` が `"student"` なら `has_completed_student_onboarding`、`"teacher"` なら `has_completed_teacher_onboarding` を確認し、`false` の場合のみチュートリアルコンポーネント（React Joyride等）を起動。
- 必要なら新規に `frontend/src/lib/useOnboarding.ts` などで薄いフックを作成し、`PATCH /users/me/complete-onboarding` を呼び出して該当ロールのフラグを更新する。
- チュートリアルの `onFinish` または `onSkip` コールバックでAPIを叩き、フラグ更新後は `useAuth.refreshMe` かローカルキャッシュを更新して再フェッチを抑制する。


## 処理フロー

| ステップ | 構成要素 | 動作内容 |
| --- | --- | --- |
| 1. 判定 | React | `user.role` を見て、該当ロールのフラグ（student/teacher）が `false` か確認 |
| 2. 表示 | React | チュートリアルUI（モーダルやガイド）を表示 |
| 3. 完了 | User | チュートリアルを最後まで見る、もしくは「スキップ」を押下 |
| 4. 更新 | API | `PATCH /users/me/complete-onboarding` をロール付きで呼び出し |
| 5. 永続化 | DB | 当該ユーザーのロールに対応するフラグを `true` に更新 |
| 6. 以降 | React | 該当ロールでは再表示されない（他ロールは別フラグで管理） |

## 実装設計（既存サービスとの整合性）

- **認証との連携:** `current_user` (Depends) を取得する既存のセキュリティロジックを利用し、安全にフラグを更新する。
- **エラーハンドリング:** 万が一フラグ更新APIが失敗しても、メイン機能（レビュー投稿等）の妨げにならないよう、フロントエンド側でサイレントにリトライ、あるいは次回のログイン時に再度表示されることを許容する。

## 移行手順

- **DBマイグレーション:** `backend/alembic/versions/` に新リビジョンを追加し、`users` テーブルへ `has_completed_student_onboarding BOOLEAN NOT NULL DEFAULT FALSE` と `has_completed_teacher_onboarding BOOLEAN NOT NULL DEFAULT FALSE` を追加。マイグレーション内で既存ユーザーの両フラグを一律 `true` にバックフィルし（既存ユーザーにはチュートリアルを再表示しないため）、新規ユーザーはデフォルト `false` で表示対象とする。
- **API実装:** `UserPublic` に2フィールドを追加し、`GET /users/me` のレスポンスへ反映。`PATCH /users/me/complete-onboarding` で `role` を受け取り該当フラグを更新。
- **フロントエンド実装:** `useAuth`（`frontend/src/app/providers.tsx`）が返す `user.role` と各フラグを用いて表示判定。専用フックが必要なら `frontend/src/lib/useOnboarding.ts` 等を新設し、`PATCH` 成功時に `useAuth.refreshMe` かローカルキャッシュ更新で再フェッチを抑制する。
