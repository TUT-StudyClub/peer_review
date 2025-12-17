# ブランチ保護（main直push禁止 / PR必須 / CI必須 / approve必須）

このリポジトリは **設定ファイルだけでは「main直push禁止」を完全に強制できません**。  
GitHub / GitLab のリポジトリ設定（ブランチ保護・ルールセット）で有効化してください。

---

## GitHub（推奨：Rulesets）

### 1. Ruleset を作成
`Settings` → `Rules` → `Rulesets` → `New branch ruleset`

- **Enforcement status**: `Active`
- **Target branches**: `Include` → `main`

### 2. 必須ルール（要件対応）
- **Require a pull request before merging**
  - Required approvals: `1`
  - Dismiss stale approvals: お好み（推奨: ON）
  - Require conversation resolution: 推奨: ON
- **Require status checks to pass**
  - Required checks: `CI / backend (ruff)` と `CI / frontend (lint/build)`（表示名は実際のワークフロー結果に合わせて選択）
- **Block force pushes**: ON
- **Block deletions**: ON

### 3. 「adminだけ直push可能」にする（運用方針）
GitHubは「管理者を例外にできる（bypass）」仕組みがあります。

- Ruleset の **Bypass list** に `Admins` / `Maintainers` 相当のユーザー・チームを追加
- 通常はPRで運用し、緊急時のみ管理者が直pushで復旧（という形が現実的です）

> 直pushを完全にゼロにしたい場合は、bypassを使わず「管理者もルール対象」にしてください。

---

## GitHub（従来：Branch protection rule）

`Settings` → `Branches` → `Branch protection rules` → `Add rule`

- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - Required approving reviews: `1`
- ✅ Require status checks to pass before merging
  - `CI / backend (ruff)` と `CI / frontend (lint/build)` を追加
- ✅ Restrict who can push to matching branches
  - **adminチーム/管理者だけ** を許可（= それ以外はmainへpush/mergeできません）
- ✅ Block force pushes / Deletions: ON

> この方式だと「mainへのマージ（push）」も制限されるため、PRをマージできるのは許可された人だけになります。

---

## GitLab（Protected branches）

`Settings` → `Repository` → `Protected branches`

- `main` を Protected に設定
- **Allowed to push**: `Maintainers` のみ
- **Allowed to merge**: 運用に合わせて（例：`Developers + Maintainers` か `Maintainers` のみ）
- Merge request approvals: `1` を必須に設定
- Pipeline must succeed: 有効化（CIがある場合）

