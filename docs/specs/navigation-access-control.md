# ナビゲーションバー（サイドバー）の権限・表示条件

## 概要

本ドキュメントでは、アプリケーションのナビゲーションバー（NavBar）におけるメニュー項目の表示条件・アクセス権限について整理します。

実装ファイル: [frontend/src/components/NavBar.tsx](../../frontend/src/components/NavBar.tsx)

---

## 全体構造

ナビゲーションバーは以下の3つのセクションで構成されます：

1. **左セクション**: ロゴ + ナビゲーションメニュー
2. **右セクション**: ユーザー情報 + ログアウト / ログイン・新規登録

---

## ナビゲーション項目一覧（計画）

以下は、サイドバー形式のナビゲーションメニューとして想定される項目の一覧です。

| セクション | 項目名 | アイコン | リンク先（想定） | 権限（ロール） | 備考 |
| --- | --- | --- | --- | --- | --- |
| **メインメニュー** | ホーム | 家 | `/home` | 全員 | ダッシュボード的な役割 |
|  | 授業一覧 | 本 | `/assignments` | `student`、`teacher` | 参加している講義のリスト |
|  | 通知 | ベル | `/notifications` | `student`、`teacher` | バッジ表示（未読数）が必要 |
|  | マイページ | 人 | `/mypage` | `student` のみ | 自身の活動実績や設定 |
|  | 授業を作成 | 本 | `/assignments?view=create` | `teacher` のみ | 新規授業の作成 |
| **その他** | 設定 | 歯車 | `/settings` | `student`、`teacher` | アプリ全体の個人設定 |
|  | 使い方 | クエスチョン | `/tutorial` | 全員 | チュートリアル |

---

## ナビゲーションメニュー項目一覧（現在の実装）

### 1. ホーム（ロゴリンク）

| 項目 | 内容 |
|------|------|
| **ラベル** | "Peer Review" |
| **リンク先** | `/` |
| **表示条件** | 常に表示 |
| **権限要件** | なし（未認証でもアクセス可能） |

---

### 2. 授業一覧

| 項目 | 内容 |
|------|------|
| **ラベル** | "授業一覧" |
| **リンク先** | `/assignments` |
| **表示条件** | `user?.role === "teacher"` または `user?.role === "student"` |
| **権限要件** | ログイン必須（`teacher` または `student` ロール） |
| **備考** | 未認証ユーザーには表示されない |

---

### 3. 授業を作成

| 項目 | 内容 |
|------|------|
| **ラベル** | "授業を作成" |
| **リンク先** | `/assignments?view=create` |
| **表示条件** | `user?.role === "teacher"` |
| **権限要件** | `teacher` ロールのみ |
| **備考** | 学生には表示されない |

---

### 4. マイページ

| 項目 | 内容 |
|------|------|
| **ラベル** | "マイページ" |
| **リンク先** | `/mypage` |
| **表示条件** | `user?.role === "student"` |
| **権限要件** | `student` ロールのみ |
| **備考** | 教師には表示されない（教師の個人設定は「設定」メニューにて行う） |

---

### 5. TAリクエスト

| 項目 | 内容 |
|------|------|
| **ラベル** | "TAリクエスト" |
| **リンク先** | `/ta/requests` |
| **表示条件** | `user?.is_ta === true` |
| **権限要件** | TA権限を持つユーザー（`is_ta` フラグが `true`） |
| **備考** | ロールに関わらず、TA権限があれば表示される |

---

### 6. 通知

| 項目 | 内容 |
|------|------|
| **ラベル** | "通知" |
| **リンク先** | `/notifications` |
| **表示条件** | `user !== null`（ログイン済み） |
| **権限要件** | ログイン必須 |
| **備考** | バッジ表示で未読数を示す。未読がある場合は数値を表示（例: "2"） |

---

### 7. 設定

| 項目 | 内容 |
|------|------|
| **ラベル** | "設定" |
| **リンク先** | `/settings` |
| **表示条件** | `user !== null`（ログイン済み） |
| **権限要件** | ログイン必須 |
| **備考** | アプリ全体の個人設定。教師の個人設定もこちらで行う |

---

### 8. 使い方

| 項目 | 内容 |
|------|------|
| **ラベル** | "使い方" |
| **リンク先** | `/tutorial` |
| **表示条件** | `user !== null`（ログイン済み） |
| **権限要件** | ログイン必須 |
| **備考** | チュートリアル |

---

## ユーザー情報表示

### ログイン済みユーザー（右セクション）

ログイン済みの場合、以下の情報が表示されます：

| 項目 | 表示条件 | 表示内容 |
|------|----------|----------|
| **ユーザー名** | 常に表示 | `user.name` |
| **称号（Title）** | `user.role !== "teacher"` | `user.title` （例: "見習いレビュアー"） |
| **ランク** | `user.role !== "teacher"` | `ランク: {user.rank}` |
| **クレジット** | `user.role !== "teacher"` | `credits: {user.credits}` |
| **ロール** | 常に表示 | `user.role` （`student` / `teacher`） |
| **TAバッジ** | `user.is_ta === true` | `TA⭐` （黄色で強調表示） |
| **ログアウトボタン** | 常に表示 | クリックでログアウト処理 |

---

### 未認証ユーザー（右セクション）

ログインしていない場合、以下のボタンが表示されます：

| 項目 | リンク先 |
|------|----------|
| **ログイン** | `/auth/login` |
| **新規登録** | `/auth/register` |

---

## ロール・権限の定義

### UserRole

| ロール | 値 | 説明 |
|--------|-----|------|
| 学生 | `"student"` | 課題提出・レビュー実施が可能 |
| 教師 | `"teacher"` | 授業・課題作成、採点が可能 |

### TA権限

| フラグ | 型 | 説明 |
|--------|-----|------|
| `is_ta` | `boolean` | TA（ティーチングアシスタント）権限の有無 |

- TAは学生ロールを持ちながら、追加でレビュー依頼を受けることができる
- `is_ta` が `true` の場合、TAリクエストメニューが表示される

---

## 表示ロジック（条件式まとめ）

| メニュー項目 | TypeScript条件式 |
|-------------|------------------|
| 授業一覧 | `user?.role === "teacher" \|\| user?.role === "student"` |
| 授業を作成 | `user?.role === "teacher"` |
| マイページ | `user?.role === "student"` |
| TAリクエスト | `user?.is_ta === true` |
| 通知 | `user !== null` |
| 設定 | `user !== null` |
| 使い方 | `true`（常に表示） |
| 称号・ランク・クレジット表示 | `user.role !== "teacher"` |
| TAバッジ | `user.is_ta === true` |

---

## 実装における注意点

### 1. 認証状態の管理

- 認証状態は `useAuth()` フック（`@/app/providers`）から取得
- `user` が `null` の場合は未認証として扱う

### 2. クライアントサイドでの条件分岐

- NavBarは `"use client"` ディレクティブでクライアントコンポーネントとして実装
- `usePathname()`, `useRouter()`, `useSearchParams()` でルーティング状態を取得

### 3. アクティブ状態のスタイリング

- 現在のパスと一致するメニュー項目は異なるスタイルで強調表示
- `pathname === href` で判定

### 4. セキュリティ

- **クライアントサイドの表示制御は推奨事項であり、セキュリティ対策ではない**
- 実際のアクセス制御は**バックエンドAPI**で実施される必要がある
- フロントエンドの条件分岐はUX向上のための表示制御に過ぎない

### 5. 実装イメージ（Sidebarコンポーネント構造案）

メンテナンス性を向上させるため、ナビゲーション項目をオブジェクト配列として定義することを推奨します：

```typescript
// NavBar.tsx または Sidebar.tsx での実装イメージ
import { Home, Book, Bell, User, Settings, HelpCircle, Star } from 'lucide-react';

const navItems = [
  {
    label: 'ホーム',
    href: '/',
    icon: Home,
    show: true
  },
  {
    label: '授業一覧',
    href: '/assignments',
    icon: Book,
    show: user?.role === 'teacher' || user?.role === 'student'
  },
  {
    label: '通知',
    href: '/notifications',
    icon: Bell,
    show: user !== null,
    badge: unreadCount > 0 ? unreadCount : undefined
  },
  {
    label: 'マイページ',
    href: '/mypage',
    icon: User,
    show: user?.role === 'student'
  },
  {
    label: 'TAリクエスト',
    href: '/ta/requests',
    icon: Star,
    show: user?.is_ta === true
  },
  {
    label: '設定',
    href: '/settings',
    icon: Settings,
    show: user !== null,
    section: 'other'
  },
  {
    label: '使い方',
    href: '/tutorial',
    icon: HelpCircle,
    show: true,
    section: 'other'
  },
];

// フィルタリングして表示
const visibleItems = navItems.filter(item => item.show);
```

この構造により、以下のメリットが得られます：
- 新規メニュー項目の追加が容易
- 表示条件の一元管理
- テストコードの記述が簡潔に
- TypeScriptによる型安全性の向上

---

## バックエンドAPI権限（参考）

バックエンドでは以下の認証・認可機能が実装されています：

| 関数 | ファイル | 役割 |
|------|---------|------|
| `get_current_user` | `backend/app/services/auth.py` | JWTトークンからユーザーを取得 |
| `require_teacher` | `backend/app/services/auth.py` | `teacher` ロールを要求 |

例: ファイルダウンロード権限（`backend/app/api/routes/submissions.py`）

```python
# 許可条件:
# 1. 教師である
# 2. 提出者本人である
# 3. レビュー担当者である
allowed = current_user.role == UserRole.teacher or submission.author_id == current_user.id
if not allowed:
    assigned = db.query(ReviewAssignment).filter(...).first()
    allowed = assigned is not None
if not allowed:
    raise HTTPException(status_code=403, detail="Not allowed")
```

---

## まとめ

| 観点 | 内容 |
|------|------|
| **表示制御** | フロントエンドで `user.role` と `user.is_ta` に基づく条件分岐 |
| **アクセス制御** | バックエンドAPIで認証・認可を実施 |
| **設計思想** | DRYを保ちつつ、ロールベースで段階的に機能を開示 |

ナビゲーションメニューは、ユーザーのロールとTA権限に応じて動的に構成され、不要な選択肢を非表示にすることでUXを向上させています。
