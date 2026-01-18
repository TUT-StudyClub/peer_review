# seed_test_users.py 生成内容

`backend/scripts/seed_test_users.py` が作成/更新するデータの一覧です。

## 前提
- `TEST_USER_PASSWORD` を環境変数または `backend/.env` に設定
- `ALLOW_TEACHER_REGISTRATION=true`
- 既存ユーザはスキップされます（TAユーザは `credits` が閾値未満なら引き上げ）

## ユーザ
- teacher（3名）
  - teacher1@example.com / Teacher 1
  - teacher2@example.com / Teacher 2
  - teacher3@example.com / Teacher 3
- TA（student role + credits を閾値以上に設定、3名）
  - ta1@example.com / TA 1
  - ta2@example.com / TA 2
  - ta3@example.com / TA 3
- student（10名）
  - student1@example.com 〜 student10@example.com

## 授業（必要なら作成）
- プログラミング基礎（teacher1担当）
- データ構造とアルゴリズム（teacher2担当）

## 課題（必要なら作成、提出期限付き）
- プログラミング基礎
  - レビュー演習 1（期限: 実行時から+3日）
  - レビュー演習 2（期限: 実行時から+7日）
- データ構造とアルゴリズム
  - データ構造レポート 1（期限: 実行時から+10日）
  - データ構造レポート 2（期限: 実行時から+14日）

## 付記
- 期限は日本時間（JST）の現在時刻基準で `due_at` に設定されます。
- 既存の授業/課題はタイトル一致で重複作成を避けます。
