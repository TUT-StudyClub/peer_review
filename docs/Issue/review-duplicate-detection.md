# レビュー重複判定の基準と挙動

## 正規化とハッシュ
- 入力本文を NFKC 正規化し、全角スペース→半角スペース、改行/タブ→スペース、記号除去・小文字化・連続空白の圧縮を行う（`app.services.similarity.normalize_text`）。
- 重複判定用には空白も取り除いた文字列を SHA-256 でハッシュ化し、`reviews.normalized_comment_hash` に保存する。
- 過去レビューにハッシュが無い場合は照合時に計算して埋め直す。

## 重複の定義
- **同一レビュアーが同一課題で提出したレビュー本文の正規化ハッシュが一致する** こと。
- 判定は過去レビューのうち最初に一致したものを `duplicate_of_review_id` として紐付ける。

## 検知時のアクション
- レビュー保存時に `duplicate_warning` と `duplicate_of_review_id` を付与し、レスポンスにも返す。
- AI品質スコアを `DUPLICATE_QUALITY_PENALTY_POINTS`（デフォルト1pt、下限1）だけ減点する。
- `DUPLICATE_PENALTY_RATE`（デフォルト0.4）をレビュー貢献点に乗算減点する。提出はブロックしない。
- 判定値は `ReviewPublic` / `ReviewReceived` / `TeacherReviewPublic` で参照可能。

## 再現メモ
1. 同じユーザーで同じ課題に対し、同一本文のレビューを2回投稿する。
2. 2回目のレスポンスに `duplicate_warning` が入り、`ai_quality_score` が減点され、`duplicate_penalty_rate` が保存される。
