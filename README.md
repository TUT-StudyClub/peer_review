# Peer Review

学生が **PDF/Markdown** のレポートを提出し、システムが **匿名でランダムにレビューを割り当て**、ルーブリックに基づくピアレビュー → メタ評価 → スコア算出まで行うMVPです。

- Backend: Python + FastAPI
- Frontend: Next.js (React) + Tailwind CSS
- DB: PostgreSQL（推奨）/ SQLite（最短で動かす用）
- 仮想環境: **uv**
- AI: OpenAI API（任意）/ 未設定時は簡易ヒューリスティック

---

## ディレクトリ構成

- `.github/` … CI workflows / Issue・PRテンプレート
- `backend/` … FastAPI + DB + マッチング/採点ロジック
- `frontend/` … UI（Next.js）
- `docs/` … 開発/運用ドキュメント（branch-protection, issue-management, frontend-ui など）
- `scripts/` / `teacher-baseline/` … 補助スクリプト / 教師基準ロジック
- `Taskfile.yml` / `.pre-commit-config.yaml` / `CONTRIBUTING.md` … task runner / pre-commit 設定 / 運用ルール

---

## できること

### 1) 課題提出（Submission）
- `POST /submissions/assignment/{assignment_id}` で PDF/Markdown をアップロード
- ファイルは `backend/storage/` 配下へ保存（ファイル名は匿名化され、元のファイル名はDBにだけ保持）

### 2) 匿名マッチング（Blind Matching）
- `GET /assignments/{assignment_id}/reviews/next` で「次にレビューすべき提出物」をシステムが返します
- **自分自身の提出物は割り当てられません**
- 1提出物あたりの割当数は `Assignment.target_reviews_per_submission`（1〜3）で設定
- 取り出し優先順位（重要→後）
  1. まだ割当/レビュー数が少ない提出物
  2. 提出者の `credits`（徳）が高い提出物（＝よく他人をレビューした人が優先される）
  3. ランダム（同条件のタイブレーク）

### 3) ピアレビュー（Peer Review）
- `POST /review-assignments/{review_assignment_id}/submit` でレビュー提出
- ルーブリックスコアは **全項目必須**

### 4) メタ評価（Meta-Review）
- （ピアレビュー受領後の段階）提出者が `POST /reviews/{review_id}/meta` で、受け取ったレビューの有用性を5段階評価（レビューへのレビュー）
- メタ評価できるのは **その提出物の提出者のみ** で、各レビューにつき1回までです
- このメタ評価は `review_contribution`（レビュー貢献点）の算出に利用されます

### 5) スコア算出（Grade）
- `GET /assignments/{assignment_id}/grades/me` で自分のスコアを取得
  - `assignment_score`: 先生の点数（設定されていればそれ） / 未設定ならピアの平均点（0〜100換算）
  - `review_contribution`: レビュー貢献点（メタ評価・rubric一致・AI品質を簡易的に合成し、レビュー1本あたり最大10点）
  - `final_score`: `min(100, assignment_score + review_contribution)`

#### 補足: 教師基準の信頼度スコア（新）
- teacher rubric との一致度（信頼度スコア）と、teacher レビュー文との意味一致度を合成し、レビュー提出時の `credits` に反映します。
- 詳細は `teacher-baseline/README.md` を参照してください。

### 6) レビュアースキル可視化（レーダーチャート用データ）
- `GET /users/me/reviewer-skill` で、AI（または簡易判定）による4軸の平均値を返します
  - `logic`, `specificity`, `empathy`, `insight`

### 7) レビュー推敲（Review Polish）
- `POST /reviews/polish` で、AIがレビュー文を「丁寧で建設的」な表現に書き換えます。
- **安全性の担保**: 変換後の文章が入力時よりも攻撃的（禁止語の増加など）になった場合は、エラー（422）を返して変換を拒否します。

---

## セットアップ（最短で動かす）

### 前提
- Python 3.12 以上
- `uv` がインストール済み（未インストールなら https://github.com/astral-sh/uv の手順に従ってください）
- `go-task` がインストール済み（インストール方法: https://taskfile.dev/installation/）

> 以降、リポジトリルートで `task` を実行します。

### 1. 依存関係インストール（uvで仮想環境作成）
```bash
task install
```
- backend / frontend の依存関係がインストールされます
- backend だけなら `task backend:install` も利用できます

### 2. 環境変数（任意）
```bash
cp backend/.env.example backend/.env
```
SQLiteで動かすだけなら `.env` は不要です（デフォルトは `sqlite:///./dev.db`）。

### 3. 起動（backend / frontend）
```bash
task backend:dev
task frontend:dev
```

### 4. 動作確認
- `http://127.0.0.1:8000/health`
- Swagger UI: `http://127.0.0.1:8000/docs`

---

## Taskfile

`Taskfile.yml` を用意しています。`go-task` をインストール済みなら、以下のように実行できます。

```bash
task --list
```

代表的なタスク例:
```bash
task install
task backend:dev
task frontend:dev
task test
task check
```

`task check` は backend の ruff/ty と frontend の eslint をまとめて実行します。

---

## PostgreSQL（推奨）で動かす

### 1. DB起動（Docker）
```bash
task backend:db-up
```

### 2. `.env` に `DATABASE_URL` を設定
`backend/.env` の `DATABASE_URL` を有効化して、以下を設定します：
```env
DATABASE_URL=postgresql+psycopg://pure_review:pure_review@localhost:5432/pure_review
```

### 3. 起動（backend / frontend）
```bash
task backend:dev
cp frontend/.env.local.example frontend/.env.local
task frontend:dev
```

---

## レビュー類似検知（新機能）

- 概要: レビューコメント間の類似度を文字N-gram + Jaccard係数で判定し、閾値以上でコピー検知・減点を行います。
- 設定値（`backend/app/core/config.py`）:
  - `SIMILARITY_THRESHOLD` (`similarity_threshold` 環境変数): デフォルト 0.5
  - `SIMILARITY_PENALTY_ENABLED` (`similarity_penalty_enabled` 環境変数): デフォルト True
  - `SIMILARITY_NGRAM_N` (`similarity_ngram_n` 環境変数): デフォルト 2

動作確認手順:
1. `POST /review-assignments/{review_assignment_id}/submit` でレビューを提出
2. 類似レビューが存在する場合、`reviews` テーブルに `similarity_score`, `similar_review_id`, `similarity_warning`, `similarity_penalty_rate` が保存されます
3. 採点時のレビュー貢献点に減点が反映されます（`GET /assignments/{assignment_id}/grades/me` を確認）

マイグレーション: `backend/docs/migration_add_review_similarity.md` を参照してください。

      {"criterion_id":"'"$CRIT_LOGIC_ID"'","score":4},
      {"criterion_id":"'"$CRIT_SPEC_ID"'","score":4}
    ]
  }' | jq
```

## レビュー重複検知（新機能）

- 同一ユーザーが同一課題で本文をコピペすると、正規化ハッシュの一致で重複を検知します。
- `duplicate_warning` や `duplicate_of_review_id` をレスポンス/DBに保存し、AI品質スコアを1pt減点、レビュー貢献点を `DUPLICATE_PENALTY_RATE` で減算します。
- 判定基準・正規化手順の詳細: `docs/Issue/review-duplicate-detection.md`

### 7)（任意）レビュアースキル（レーダーチャート用）
```bash
curl -sS "$BASE_URL/users/me/reviewer-skill" -H "$AUTH_S1" | jq
```

---

## Swagger UI（/docs）で操作する場合のコツ
- `503 Service Unavailable`
  - OpenAI 連携機能（推敲など）を呼び出しましたが、サーバー側で `ENABLE_OPENAI` が `false` になっているか、APIキーが設定されていません。
- `422 Unprocessable Entity`
  - レビュー推敲の結果、文章の攻撃性が高まったと判定され、出力がブロックされました。
- 
1. ブラウザで `http://127.0.0.1:8000/docs` を開く
2. まず `POST /auth/register` でアカウント作成
3. `POST /auth/token` でログイン（フォーム入力）
4. 右上の「Authorize」ボタンを押して、`Bearer <token>` を貼り付けて認証
5. 以降のAPIは「Try it out」→ 実行でOK

---

## AI機能（任意）

`.env` に `OPENAI_API_KEY` を設定し、`ENABLE_OPENAI=true` にすると、以下の機能が有効になります。


1. **レビュー品質スコア**（1〜5）と理由
2. **攻撃性/不適切表現**の検知（true/false）と理由
3. **レビューの推敲（Polish）**: 提出前に文章を丁寧・建設的な表現へ変換
4. **レビュアースキル可視化**: 4軸（`logic/specificity/empathy/insight`）の分析

未設定の場合は、短すぎるレビューや禁止語の簡易チェックを行います（完全な検知ではありません）。

---

## 重要な設計メモ（初学者向け）

### 匿名性（Anonymity）
- DBでは `users.id` と `submissions.author_id` で当然紐づきます
- ただし学生に返すレスポンスでは、`alias_for_user()` によって
  - `User_XXXXXXXX`（提出者）
  - `Reviewer_XXXXXXXX`（レビュアー）
  のような **疑似ID** に置き換えます

### 徳（credits）
- レビューを1本提出すると `credits +1`
- マッチングは「まだレビューされていない提出物」を優先しつつ、同条件なら `credits` が高い提出物が先に回ります  
  → **レビューをサボると自分の提出物が後回しになりやすい** 仕組みです

### ランク（rank / 称号）
- ランクは `credits` に基づいて決まり、`/users/me` などで `rank` と `title` が返却されます。
- 定義は `backend/app/core/config.py` の `USER_RANK_DEFINITIONS` にあり、`min_credits` の閾値で判定します。
- デフォルトの称号/閾値:
  - 0: 見習いレビュアー
  - 5: ブロンズレビュアー
  - 15: シルバーレビュアー
  - 30: ゴールドレビュアー
  - 50: プラチナレビュアー
  - 80: ダイヤモンドレビュアー

### ランキング（TOP5）
- `GET /users/ranking?limit=5` で取得できます。
- `period=weekly|monthly` を指定すると週間/月間ランキングを取得できます（省略時は `total`）。
- 週間/月間は直近7日/30日（UTC）を集計し、`period_credits` に獲得creditsを返します。
- 対象は **TA要件（`TA_QUALIFICATION_THRESHOLD`）を満たすユーザーのみ** です。
- フロントの `/start` にランキング表を表示しています。

---

## 開発メモ

- 依存関係は `pyproject.toml` と `uv.lock` で管理しています
- ファイル保存先はデフォルトで `storage/`（`.gitignore` 済み）
