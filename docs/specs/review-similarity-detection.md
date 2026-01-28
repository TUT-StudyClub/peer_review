# レビュー近似検知（重複/コピペ防止）

## 方針
- 方式: **SimHash（UTF-8テキストの shingle + hash）** を採用。理由: 軽量・決定的・閾値で類似判定がしやすい。
- 閾値: **Hamming 距離 ≤ 8 (64bit)** を初期値とする。環境変数で調整できるようにする。
- 対象: レビュー本文（comment）。Rubric 点数は対象外。
- 運用: 類似レビューを「警告として保存し、減点はしない」。UIに警告を返してユーザーに再編集を促す。
- エラー時: 近似判定に失敗してもレビュー投稿は許可し、警告を出さない（安全側）。
- 将来拡張: embedding ベースや MinHash に差し替え可能な構造にする（インタフェース分離）。

## 実装概要
- 新サービス `app/services/similarity.py`
  - `compute_simhash(text: str) -> int` (64bit int)
  - `hamming_distance(a: int, b: int) -> int`
  - `is_similar(text, existing_hashes, threshold)`
- 新設定: `SIMHASH_THRESHOLD=8`（.env.example に追記、config で `simhash_threshold`）。
- DB: レビューに simhash を保存するカラムを追加（64bit int）。既存データは null 可、既存レビューは未計算でも可。
- 判定タイミング: レビュー投稿時 (`POST /review-assignments/{id}/submit`) に計算し、同じ assignment に属する過去レビュー（全ユーザー分）の simhash と比較。
- 動作:
  1) 新レビューの simhash を計算し保存。
  2) 直近のレビュー群で Hamming 距離 ≤ threshold のものがあれば `similar_review_ids` をレスポンスに含め、`warning` メッセージを返す。
  3) 警告のみで減点なし。
- API変更: `ReviewPublic` に `similar_review_ids: list[UUID]` と `similarity_warning: str | None` を追加。クライアントは警告表示を行う。

## 運用と閾値調整
- 初期閾値 8 は「短文で偶発一致しにくい、長文でも緩やかに検出」程度を想定。
- 誤検知が多い場合: 閾値を下げる（例: 6）。見逃しが多い場合: 上げる（例: 10）。
- 短文が多い課題では shingle 長を短くする・閾値を下げるなど課題ごとチューニングも検討。

## 移行手順
- DBマイグレーション: reviews テーブルに `simhash` BIGINT を追加（null 可）。
- 既存データ: 必要に応じてバッチで simhash 再計算、または新規投稿のみ計算。
- フロント: 警告表示を追加（既存レビューには similar_review_ids が無い場合は何もしない）。
- 環境: `.env` に `SIMHASH_THRESHOLD` を追加し、バックエンド再起動。
