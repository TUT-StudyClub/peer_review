# Issue運用（タスク管理）
このリポジトリでは、タスク管理を **GitHub Issues** に統一します。
（チャットや個人メモに情報が散らばらないようにするため）

Qiita記事の考え方（Issue + Projects / Epic > Story > Task）に合わせた運用です。

---

## 1. Issueの種類（テンプレート）

Issue作成時は、基本的にテンプレートを使ってください。

- Feature: `.github/ISSUE_TEMPLATE/feature_request.md`
- Bug: `.github/ISSUE_TEMPLATE/bug_report.md`
- Investigation: `.github/ISSUE_TEMPLATE/investigation.md`
- Epic / Story / Task: `.github/ISSUE_TEMPLATE/epic.md` / `story.md` / `task.md`

---

## 2. Epic > Story > Task の3階層

大きい変更はいきなり実装せず、以下の粒度に分解します。

- Epic: 大きな機能単位（複数のStory/Taskを内包）
- Story: ユーザー視点の価値（受け入れ条件を明確にする）
- Task: 具体的な実装作業（数時間〜1日）

### コツ（重要）
- Taskは「1つの観点」だけにする（例：フィルター実装 と ソート実装 は分ける）
- 迷ったら細かくする（見積もり・進捗管理が楽になる）

---

## 3. 親子関係の付け方（Sub-issues）

GitHubの **Sub-issues** 機能が使える場合：
- Epic に Story を紐付ける
- Story に Task を紐付ける

Sub-issues が使えない場合：
- 親Issue側にチェックリストで `- [ ] #123` のようにリンクを貼る
- 子Issue側の本文に `Parent: #456` を書く

---

## 4. Labels（ラベル）運用

テンプレートで自動付与される（想定）のラベル：
- `enhancement`（Feature）
- `bug`（Bug）
- `investigation`（Investigation）
- `Epic` / `Story` / `Task`（階層）

追加であると便利なラベル例：
- 領域: `backend`, `frontend`
- 優先度: `P0`, `P1`, `P2`
- 状態: `blocked`

> ラベルはGitHub/GitLabのUIで作成してください（テンプレで指定したラベル名が存在しない場合、付与されないことがあります）。

### GitHubでラベルを作る手順

1. リポジトリの `Issues` → `Labels`
2. `New label`
3. `Name` に `Epic` / `Story` / `Task` / `investigation` などを作成

---

## 5. Projects（カンバン）で見える化

GitHub Projects を作成して、Issueをボードで管理します。

推奨カラム例：
- Todo
- In Progress
- Done

おすすめ設定：
- Viewの `Group by: Assignees` を使って、担当者ごとの負荷を可視化する
- フィルタで `label:Epic` / `label:Story` / `label:Task` を切り替える

### GitHub Projects 作成手順（例）

1. リポジトリ上部の `Projects` タブ → `New project`
2. テンプレートは `Board` を選択
3. カラムを `Todo / In Progress / Done` に調整
4. Issueをプロジェクトに追加して運用開始

---

## 6. PRとのリンク（必須）

- 原則「Issue → PR」の順で進める（いきなりPRを作らない）
- PR本文に `Closes #123` を書く（マージ時にIssueを自動クローズ）
- PRテンプレ `.github/pull_request_template.md` の「関連Issue」を埋める

---

## 7. Doneの定義（最低限）

- 仕様/意図がIssueに残っている（Whyが追える）
- 実装が完了している
- CIが通る（backend: ruff / frontend: lint+build）
- 必要ならREADME/Docsが更新されている
