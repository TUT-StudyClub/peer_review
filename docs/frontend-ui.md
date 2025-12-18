# Frontend UI方針（shadcn/ui）

このリポジトリのフロントエンド（`frontend/`）は **Next.js(App Router) + Tailwind CSS** を使用しています。  
UIコンポーネントは **shadcn/ui を優先**して追加・拡張します。

---

## 1. 方針（重要）

- 新規のUI部品は `frontend/src/components/ui/`（shadcn/ui）に追加する
- 既存の自作UIは `frontend/src/components/legacy-ui/` に残す（段階的に置換していく）
- 色は `bg-background` / `text-foreground` / `bg-primary` のような **セマンティックなトークン**を使う（固定色 `text-black` 等は原則増やさない）

---

## 2. shadcn/ui の設定ファイル

- `frontend/components.json`
  - 生成先: `@/components/ui`
  - utils: `@/lib/utils`
  - Tailwind: `frontend/tailwind.config.cjs`

---

## 3. 追加済みのUIコンポーネント（例）

`frontend/src/components/ui/` に以下を追加しています。

- `button.tsx`
- `input.tsx`
- `textarea.tsx`
- `select.tsx`
- `card.tsx`
- `label.tsx`
- `alert.tsx`
- `dialog.tsx`
- `field.tsx`

---

## 4. 追加方法（新しいコンポーネントを増やす）

`frontend/` 配下で `shadcn` CLI を実行します（`components.json` を参照します）。

```bash
cd frontend
npx shadcn@latest add button
```

> 追加したいコンポーネントに合わせて `button` の部分を変更してください。

---

## 5. Tailwind / デザイントークン

- デザイントークン（CSS変数）は `frontend/src/app/globals.css` にあります
- Tailwindの色マッピングは `frontend/tailwind.config.cjs` にあります

---

## 6. ダークモード方針

- **class-based**（`darkMode: ["class"]`）に統一します
- 現時点ではトグルUIは未提供です（必要なら `next-themes` 導入を検討）
- 動作確認したい場合は、`<html>` に `dark` クラスを付けて確認します

---

## 7. フォント方針

- `frontend/src/app/layout.tsx` で `next/font`（Geist）を読み込み、`--font-sans` / `--font-mono` を設定しています
- 画面側では `font-sans` / `font-mono` を使う方針です
