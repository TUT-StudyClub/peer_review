# AGENT.md

このファイルは AGENTS.md の考え方（エージェント向けのREADME）に基づく、作業指針です。

## 応答方針
- 回答は日本語で行うこと。
- 実装や修正を行った場合は、変更内容の解説（どこをどう変えたか・意図）を簡潔に書くこと。
- 変更がない場合は、その旨を明確に伝えること。

## リポジトリ概要
- Backend: Python + FastAPI
- Frontend: Next.js (React) + Tailwind CSS
- DB: PostgreSQL（推奨）/ SQLite（最短で動かす用）

## 主要ディレクトリ
- `backend/` … FastAPI + DB + マッチング/採点ロジック
- `frontend/` … UI（Next.js）

## セットアップ / 起動コマンド
### backend
- 依存関係: `cd backend && uv sync --python 3.12`
- 起動: `cd backend && uv run uvicorn app.main:app --reload`
- DB: `.env` が無い場合は `sqlite:///./dev.db` を使用

### frontend
- 依存関係: `cd frontend && cp .env.local.example .env.local && npm ci`
- 起動: `cd frontend && npm run dev`

### UI 修正提案
- 依存関係: `cd "UI 修正提案" && npm i`
- 起動: `cd "UI 修正提案" && npm run dev`

## テスト / 品質チェック（CI相当）
- backend: `cd backend && uv run ruff check app` / `uv run python -m compileall app`
- frontend: `cd frontend && npm run lint` / `npm run build`

## リポジトリ固有ルール
- `main` への直pushは禁止。変更はPRで行い、1人のApproveとCI通過が必須。
- `.env` など機密情報はコミットしない。
- UIは `docs/frontend-ui.md` の方針に従う。

## 参考資料
- 開発ルール: `CONTRIBUTING.md`
- ブランチ保護: `docs/branch-protection.md`
- Issue運用: `docs/issue-management.md`
