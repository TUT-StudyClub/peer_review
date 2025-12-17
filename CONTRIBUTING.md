# Contributing / 開発ルール

## 基本方針

- `main` への直pushは禁止（例外：緊急時に限り管理者が対応）
- 変更は **必ずPR（Pull Request）** で行う
- PRは **1人のApprove** を必須とする
- CI（品質ゲート）が通っていることを必須とする

ブランチ保護の具体的な設定手順は `docs/branch-protection.md` を参照してください。

Issue運用（タスク管理）の方針は `docs/issue-management.md` を参照してください。

---

## ディレクトリ

- `backend/` … FastAPI（Python）
- `frontend/` … Next.js（TypeScript）

---

## ローカル開発コマンド

### backend

```bash
cd backend
uv sync --python 3.12
uv run uvicorn app.main:app --reload
```

品質チェック（CI相当）：
```bash
cd backend
uv run ruff check app
uv run python -m compileall app
```

### frontend

```bash
cd frontend
cp .env.local.example .env.local
npm ci
npm run dev
```

品質チェック（CI相当）：
```bash
cd frontend
npm run lint
npm run build
```

---

## PRの目安（レビュー観点）

- 変更理由が説明されている（Why）
- 影響範囲が明確（どの画面/APIが変わるか）
- エラー/バリデーション/権限が壊れていない
- `.env` 等の機密情報をコミットしていない
- CIが通ること
