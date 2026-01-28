# Gemini CLI の使い方

このリポジトリでは、**GitHub Actions + Gemini CLI** を使って PR レビューや Issue トリアージを実行します。
基本的な入口は `.github/workflows/gemini-dispatch.yml` で、コメント内容やイベントに応じて各ワークフローに振り分けます。

---

## 1. できること（このリポジトリの動き）

- **PR レビュー（自動）**
  PR 作成時に自動でレビュー（フォーク PR は対象外）。
- **PR レビュー（手動）**
  コメントで `@gemini-cli /review` を送るとレビューを実行。
- **Issue トリアージ**
  Issue 作成/再オープン時にラベルを推定して付与。
- **任意プロンプト実行（invoke）**
  `@gemini-cli 〜` のコメント内容をそのまま実行。

> コメント実行は **OWNER / MEMBER / COLLABORATOR** のみ対象です。

---

## 2. 事前準備（GitHub の Secrets / Variables）

### 必須
- **Secrets**
  - `GEMINI_API_KEY`
    Gemini API のキー（これが無いと実行できません）。

### 推奨（任意）
- **Variables**
  - `GEMINI_MODEL`
    使うモデル名。未設定の場合は `gemini-3-flash` を使います。
  - `GEMINI_CLI_VERSION`
    CLI バージョン固定（未設定なら Action 側のデフォルト）。
  - `GEMINI_DEBUG`
    `true` の場合、詳細ログを出します。
  - `UPLOAD_ARTIFACTS`
    生成物（stdout/stderr/telemetry）をアップロードします。

### Vertex AI を使う場合（任意）
- **Variables**
  - `GOOGLE_GENAI_USE_VERTEXAI`（`true`）
  - `GOOGLE_CLOUD_PROJECT`
  - `GOOGLE_CLOUD_LOCATION`
  - `SERVICE_ACCOUNT_EMAIL`
  - `GCP_WIF_PROVIDER`

### GitHub App を使う場合（任意）
- **Variables**
  - `APP_ID`
- **Secrets**
  - `APP_PRIVATE_KEY`

---

## 3. 使い方（コメントで実行）

### PR レビュー
- PR 作成時に自動で走ります（fork PR は除外）
- 手動実行する場合：
  ```
  @gemini-cli /review
  ```
  追加で指示を書く場合：
  ```
  @gemini-cli /review 重点的に API 周りを見てください
  ```

### Issue トリアージ
```
@gemini-cli /triage
```

### 任意プロンプト実行（invoke）
```
@gemini-cli テストが落ちている原因を推測して
```

---

## 4. ワークフロー対応表

- `gemini-dispatch.yml`
  コメント/イベントを解析し、次のワークフローへ振り分け
- `gemini-review.yml`
  PR レビューを生成して PR に投稿
- `gemini-triage.yml`
  Issue のラベルを推定して付与
- `gemini-invoke.yml`
  任意の指示を実行
- `gemini-scheduled-triage.yml`
  定期で未トリアージ Issue をまとめて処理（cron）

---

## 5. よくあるエラー

### `TerminalQuotaError` / 429 が出る
- **モデルの無料枠が 0** になっている可能性があります。
- 対応策：
  - `GEMINI_MODEL` を `gemini-3-flash` に変更（無料枠で動くケースが多い）
  - 課金/クォータを付与して再実行

### `GEMINI_API_KEY` が無い
- Secrets に `GEMINI_API_KEY` が設定されているか確認してください。

---

## 6. 関連ファイル（役割つき）

- `.github/workflows/gemini-dispatch.yml`
  コメントやイベントを解析し、review / triage / invoke に振り分ける入口。
- `.github/workflows/gemini-review.yml`
  PR の内容を読み取り、レビューコメント（pending → submit）を作成する。
- `.github/workflows/gemini-triage.yml`
  Issue の本文からラベル候補を推定し、該当ラベルを付与する。
- `.github/workflows/gemini-invoke.yml`
  任意のプロンプトを実行して結果をコメントする（汎用実行）。
- `.github/workflows/gemini-scheduled-triage.yml`
  定期実行で未トリアージの Issue を収集し、まとめてトリアージする。
