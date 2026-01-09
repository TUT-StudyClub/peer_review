// フラット構成用の ESLint 設定。
// ESLint 9 でこのファイルをメイン設定として利用することを想定している。

import tseslint from "typescript-eslint";

export default tseslint.config({
  // 共通の除外パターン
  ignores: [
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "*.config.*",
  ],
});

// TypeScript ESLint の推奨設定をベースとして利用
