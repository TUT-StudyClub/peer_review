# pure-review（匿名ピアレビューMVP / FastAPI）

学生が **PDF/Markdown** のレポートを提出し、システムが **匿名でランダムにレビューを割り当て**、ルーブリックに基づくピアレビュー → メタ評価 → スコア算出まで行うためのバックエンドMVPです。

- Backend: Python + FastAPI
- DB: PostgreSQL（推奨）/ SQLite（最短で動かす用）
- 仮想環境: **uv**
- AI: OpenAI API（任意）/ 未設定時は簡易ヒューリスティック

---

## できること（実装済み）

### 1) 課題提出（Submission）
- `POST /submissions/assignment/{assignment_id}` で PDF/Markdown をアップロード
- ファイルは `storage/` 配下へ保存（ファイル名は匿名化され、元のファイル名はDBにだけ保持）

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
- 提出者が `POST /reviews/{review_id}/meta` で、受け取ったレビューの有用性（1〜5）を評価

### 5) スコア算出（Grade）
- `GET /assignments/{assignment_id}/grades/me` で自分のスコアを取得
  - `assignment_score`: 先生の点数（設定されていればそれ） / 未設定ならピアの平均点（0〜100換算）
  - `review_contribution`: レビュー貢献点（レビュー1本あたり最大10点の簡易式）
  - `final_score`: `min(100, assignment_score + review_contribution)`

### 6) レビュアースキル可視化（レーダーチャート用データ）
- `GET /users/me/reviewer-skill` で、AI（または簡易判定）による4軸の平均値を返します
  - `logic`, `specificity`, `empathy`, `insight`

---

## セットアップ（最短で動かす）

### 前提
- Python 3.12 以上
- `uv` がインストール済み（未インストールなら https://github.com/astral-sh/uv の手順に従ってください）

### 1. 依存関係インストール（uvで仮想環境作成）
```bash
uv sync --python 3.12
```
- `.venv/` が作成され、依存関係がインストールされます

### 2. 環境変数（任意）
```bash
cp .env.example .env
```
SQLiteで動かすだけなら `.env` は不要です（デフォルトは `sqlite:///./dev.db`）。

### 3. 起動
```bash
uv run uvicorn app.main:app --reload
```

### 4. 動作確認
- `http://127.0.0.1:8000/health`
- Swagger UI: `http://127.0.0.1:8000/docs`

---

## PostgreSQL（推奨）で動かす

### 1. DB起動（Docker）
```bash
docker compose up -d
```

### 2. `.env` に `DATABASE_URL` を設定
`.env` の `DATABASE_URL` を有効化して、以下を設定します：
```env
DATABASE_URL=postgresql+psycopg://pure_review:pure_review@localhost:5432/pure_review
```

### 3. 起動
```bash
uv run uvicorn app.main:app --reload
```

---

## 使い方（APIを順番に叩く）

Swagger UI（`/docs`）から操作するのが一番簡単です。  
ただし「どのAPIをどの順番で叩けばよいか」が分かりにくい場合が多いので、ここでは **curlで一連の流れをそのまま再現できる手順** を用意します。

> 以降は `BASE_URL=http://127.0.0.1:8000` を前提にしています。
> すでに起動していない場合は `uv run uvicorn app.main:app --reload` で起動してください。

### 事前準備（おすすめ）

- `curl`（macOS/Linuxなら標準で入っていることが多い）
- `jq`（JSONから `id` や `access_token` を抜き出すのに便利）
  - `jq` が無い場合でも手順は実行できます（レスポンスから手でコピペしてください）

`jq` の有無は次で確認できます：
```bash
command -v jq >/dev/null && echo "jq: OK" || echo "jq: NOT FOUND（なくても進められます）"
```

`jq` が無い場合：
- コマンド末尾の `| jq ...` を外して実行 → 表示されたJSONから値をコピペ
- 例：`TOK_T="<ここにaccess_tokenを貼る>"` のように **手で変数に入れる**

以下の手順では、コピペしやすいように **シェル変数**（`TOK_T` や `ASSIGNMENT_ID` など）にIDを入れて進めます。

```bash
BASE_URL="http://127.0.0.1:8000"
```

### 0) アカウント作成・ログイン

#### 0-1. アカウント作成（teacher 1人 + student 2人の例）

teacher：
```bash
curl -sS -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"t@example.com","name":"Teacher","password":"password123","role":"teacher"}'
```

student1：
```bash
curl -sS -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"s1@example.com","name":"Student 1","password":"password123"}'
```

student2：
```bash
curl -sS -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"s2@example.com","name":"Student 2","password":"password123"}'
```

> teacher を作れない場合は、`.env` の `ALLOW_TEACHER_REGISTRATION=true` を確認してください。

#### 0-2. ログインしてトークン取得（重要：ここはJSONではありません）

`POST /auth/token` は **`application/x-www-form-urlencoded`** 形式（ユーザー名＝email）です。

teacher token：
```bash
TOK_T="$(curl -sS -X POST "$BASE_URL/auth/token" \
  -d "username=t@example.com" -d "password=password123" | jq -r .access_token)"
echo "$TOK_T"
```

student1 token：
```bash
TOK_S1="$(curl -sS -X POST "$BASE_URL/auth/token" \
  -d "username=s1@example.com" -d "password=password123" | jq -r .access_token)"
```

student2 token：
```bash
TOK_S2="$(curl -sS -X POST "$BASE_URL/auth/token" \
  -d "username=s2@example.com" -d "password=password123" | jq -r .access_token)"
```

以後、認証が必要なAPIはこのヘッダーを付けます：
```bash
AUTH_T="Authorization: Bearer $TOK_T"
AUTH_S1="Authorization: Bearer $TOK_S1"
AUTH_S2="Authorization: Bearer $TOK_S2"
```

### 1) 課題（Assignment）作成（teacher）

#### 1-1. 課題作成
```bash
ASSIGNMENT_ID="$(curl -sS -X POST "$BASE_URL/assignments" \
  -H "$AUTH_T" -H "Content-Type: application/json" \
  -d '{"title":"レポート課題1","description":"MarkdownかPDFを提出してください","target_reviews_per_submission":2}' | jq -r .id)"
echo "$ASSIGNMENT_ID"
```

#### 1-2. ルーブリック追加（例：2項目）
```bash
CRIT_LOGIC_ID="$(curl -sS -X POST "$BASE_URL/assignments/$ASSIGNMENT_ID/rubric" \
  -H "$AUTH_T" -H "Content-Type: application/json" \
  -d '{"name":"論理性(Logic)","description":"主張と根拠のつながり","max_score":5,"order_index":0}' | jq -r .id)"

CRIT_SPEC_ID="$(curl -sS -X POST "$BASE_URL/assignments/$ASSIGNMENT_ID/rubric" \
  -H "$AUTH_T" -H "Content-Type: application/json" \
  -d '{"name":"具体性(Specificity)","description":"具体例・手順の明確さ","max_score":5,"order_index":1}' | jq -r .id)"
```

（確認）
```bash
curl -sS "$BASE_URL/assignments/$ASSIGNMENT_ID/rubric" | jq
```

### 2) 提出（student）

`POST /submissions/assignment/{assignment_id}` に **`multipart/form-data`** で `file` を送ります。

> AIの「本文＋レビュー」評価をちゃんと行いたい場合、現状は **Markdown提出が推奨** です（PDFの本文抽出は未実装のため）。

#### 2-1. 提出用ファイルを用意（例）
```bash
cat > report_s1.md <<'MD'
# Student 1 Report

主張：〜〜
根拠：〜〜
MD

cat > report_s2.md <<'MD'
# Student 2 Report

結論：〜〜
理由：〜〜
MD
```

#### 2-2. student1 が提出
```bash
SUBMISSION_S1_ID="$(curl -sS -X POST "$BASE_URL/submissions/assignment/$ASSIGNMENT_ID" \
  -H "$AUTH_S1" \
  -F "file=@./report_s1.md;type=text/markdown" | jq -r .id)"
echo "$SUBMISSION_S1_ID"
```

#### 2-3. student2 が提出
```bash
SUBMISSION_S2_ID="$(curl -sS -X POST "$BASE_URL/submissions/assignment/$ASSIGNMENT_ID" \
  -H "$AUTH_S2" \
  -F "file=@./report_s2.md;type=text/markdown" | jq -r .id)"
echo "$SUBMISSION_S2_ID"
```

（自分の提出を確認）
```bash
curl -sS "$BASE_URL/submissions/assignment/$ASSIGNMENT_ID/me" -H "$AUTH_S1" | jq
```

### 3) レビュー（student）

流れは必ずこの順番です：
1. `GET /assignments/{assignment_id}/reviews/next`（次のレビュー対象を受け取る）
2. `GET /submissions/{submission_id}/file`（提出物を取得）
3. `POST /review-assignments/{review_assignment_id}/submit`（レビュー提出）

> `reviews/next` は、未提出のタスクが残っている場合は **同じタスクを返し続けます**（タスクを溜め込めないようにするため）。

#### 3-1. student1 が「次にレビューすべき提出物」を取得
```bash
TASK_S1="$(curl -sS "$BASE_URL/assignments/$ASSIGNMENT_ID/reviews/next" -H "$AUTH_S1")"
echo "$TASK_S1" | jq
RA_S1_ID="$(echo "$TASK_S1" | jq -r .review_assignment_id)"
TARGET_SUBMISSION_FOR_S1="$(echo "$TASK_S1" | jq -r .submission_id)"
```

`TASK_S1` の中身の見方：
- `author_alias`: 匿名の提出者ID（表示用）
- `submission_id`: ファイル取得に使うID
- `review_assignment_id`: レビュー提出に使うID
- `file_type`: `pdf` / `markdown`

#### 3-2. student1 が提出物ファイルをダウンロード
```bash
curl -sS -L "$BASE_URL/submissions/$TARGET_SUBMISSION_FOR_S1/file" \
  -H "$AUTH_S1" \
  -o reviewed_by_s1
ls -la reviewed_by_s1
```

#### 3-3. student1 がレビュー提出（ルーブリックは全項目必須）
```bash
curl -sS -X POST "$BASE_URL/review-assignments/$RA_S1_ID/submit" \
  -H "$AUTH_S1" -H "Content-Type: application/json" \
  -d '{
    "comment":"良い点：主張が明確です。改善案：根拠を1つ追加すると説得力が増します。例えば〜〜。",
    "rubric_scores":[
      {"criterion_id":"'"$CRIT_LOGIC_ID"'","score":4},
      {"criterion_id":"'"$CRIT_SPEC_ID"'","score":3}
    ]
  }' | jq
```

> 攻撃的な表現（例：「バカ」「死ね」など）があると 400 で弾かれます。  
> `.env` に `OPENAI_API_KEY` があればAI判定、無ければ簡易判定です。

#### 3-4. student2 も同様にレビュー
```bash
TASK_S2="$(curl -sS "$BASE_URL/assignments/$ASSIGNMENT_ID/reviews/next" -H "$AUTH_S2")"
RA_S2_ID="$(echo "$TASK_S2" | jq -r .review_assignment_id)"
TARGET_SUBMISSION_FOR_S2="$(echo "$TASK_S2" | jq -r .submission_id)"

curl -sS -L "$BASE_URL/submissions/$TARGET_SUBMISSION_FOR_S2/file" \
  -H "$AUTH_S2" \
  -o reviewed_by_s2

curl -sS -X POST "$BASE_URL/review-assignments/$RA_S2_ID/submit" \
  -H "$AUTH_S2" -H "Content-Type: application/json" \
  -d '{
    "comment":"ここが分かりやすかったです。もう少し結論に至る手順を箇条書きにするとさらに良いと思います。",
    "rubric_scores":[
      {"criterion_id":"'"$CRIT_LOGIC_ID"'","score":4},
      {"criterion_id":"'"$CRIT_SPEC_ID"'","score":4}
    ]
  }' | jq
```

### 4) レビュー受領・メタ評価（student）

#### 4-1.（例）student2 が受け取ったレビュー一覧を見る
```bash
RECEIVED_S2="$(curl -sS "$BASE_URL/assignments/$ASSIGNMENT_ID/reviews/received" -H "$AUTH_S2")"
echo "$RECEIVED_S2" | jq
REVIEW_ID_FOR_S2="$(echo "$RECEIVED_S2" | jq -r '.[0].id')"
```

#### 4-2. student2 が「そのレビューが役に立ったか」を評価（メタ評価）
```bash
curl -sS -X POST "$BASE_URL/reviews/$REVIEW_ID_FOR_S2/meta" \
  -H "$AUTH_S2" -H "Content-Type: application/json" \
  -d '{"helpfulness":5,"comment":"具体例があって助かりました"}' | jq
```

> メタ評価できるのは **その提出物の提出者だけ** です（他人は403）。

### 5) 成績確認（student）

```bash
curl -sS "$BASE_URL/assignments/$ASSIGNMENT_ID/grades/me" -H "$AUTH_S1" | jq
```

- `assignment_score` は「teacher採点があればそれ / 無ければピア平均（0〜100換算）」です
- `review_contribution` は「レビュー貢献点」です（メタ評価・rubric一致・AI品質を簡易的に合成）
- `final_score = min(100, assignment_score + review_contribution)`

### 6)（任意）teacher が採点すると「目利き力（rubric一致度）」が効く

teacher が各提出物を採点すると、レビュー貢献点に「teacher採点とのズレ（Rubric Alignment）」が反映されます。

例：teacher が student1 の提出（`$SUBMISSION_S1_ID`）を採点
```bash
curl -sS -X POST "$BASE_URL/submissions/$SUBMISSION_S1_ID/teacher-grade" \
  -H "$AUTH_T" -H "Content-Type: application/json" \
  -d '{
    "teacher_total_score": 80,
    "teacher_feedback":"全体的に良い。根拠をもう少し増やすとさらに良い。",
    "rubric_scores":[
      {"criterion_id":"'"$CRIT_LOGIC_ID"'","score":4},
      {"criterion_id":"'"$CRIT_SPEC_ID"'","score":4}
    ]
  }' | jq
```

### 7)（任意）レビュアースキル（レーダーチャート用）
```bash
curl -sS "$BASE_URL/users/me/reviewer-skill" -H "$AUTH_S1" | jq
```

---

## Swagger UI（/docs）で操作する場合のコツ

1. ブラウザで `http://127.0.0.1:8000/docs` を開く
2. まず `POST /auth/register` でアカウント作成
3. `POST /auth/token` でログイン（フォーム入力）
4. 右上の「Authorize」ボタンを押して、`Bearer <token>` を貼り付けて認証
5. 以降のAPIは「Try it out」→ 実行でOK

---

## よくあるエラーと対処

- `401 Could not validate credentials`
  - トークンが無い/間違っている/期限切れの可能性があります（`Authorization: Bearer ...` を確認）
- `403 Not allowed`
  - 提出物の閲覧やメタ評価は権限が限定されています（提出者・teacher・割当レビュアーのみ）
- `404 No submissions need review right now`
  - その課題で「レビューが必要な提出物」がありません（全員がレビューし終えた等）
- `400 All rubric criteria must be scored`
  - ルーブリックは **全項目必須** です（項目数と `rubric_scores` の数を合わせてください）

---

## AI機能（任意）

`.env` に `OPENAI_API_KEY` を設定すると、レビュー提出時に以下を実行します。

1. **レビュー品質スコア**（1〜5）と理由
2. **攻撃性/不適切表現**の検知（true/false）と理由
3. レーダーチャート用 4軸（`logic/specificity/empathy/insight`）

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

---

## 開発メモ

- 依存関係は `pyproject.toml` と `uv.lock` で管理しています
- ファイル保存先はデフォルトで `storage/`（`.gitignore` 済み）
