# 教師基準の信頼度スコアとレビュー文一致度

教師の評価を基準に「学生レビューの信頼度」を算出し、そのスコアに応じて `credits`（徳）を付与する仕組みです。数値評価（rubric）とレビュー文（自由記述）の両方を使い、総合的な一致度でクレジットを決めます。

---

## 1. 目的

- 先生の評価を基準に、学生のレビューがどれだけ妥当かを可視化する
- 数値評価（rubric）だけでなく、レビュー文の文意の一致も加味する
- 一致度に応じて `credits` を付与し、レビューの誠実さを報酬化する

---

## 2. 用語

- **教師rubric評価**: teacher が提出物に対して付けた rubric スコア（`SubmissionRubricScore`）
- **学生rubric評価**: student がレビュー時に付ける rubric スコア（`ReviewRubricScore`）
- **教師レビュー文**: teacher のコメント（`Submission.teacher_feedback`）
- **学生レビュー文**: student のレビューコメント（`Review.comment`）
- **信頼度スコア**: rubric の一致度から算出する 0.0〜1.0 のスコア
- **レビュー文一致度**: 教師文と学生文の文意一致を 1〜5 で評価したもの

---

## 3. 信頼度スコア（rubric一致度）の算出

rubric の各項目について差分を計算し、平均との差分を正規化します。

### 3-1. 差分の計算（各項目）

```
差分_i = | 教師の評価値_i - 学生の評価値_i |
```

### 3-2. 平均差分

```
平均差分 = (差分_1 + ... + 差分_n) / n
```

### 3-3. 正規化差分

```
平均最大スコア = (最大スコア_1 + ... + 最大スコア_n) / n
正規化差分 = 平均差分 / 平均最大スコア
```

### 3-4. 信頼度スコア

```
信頼度スコア = 1 - 正規化差分
```

- 0.0〜1.0 に丸めて扱います
- teacher rubric が無い場合は算出不可（`None`）

---

## 4. レビュー文一致度（文意比較）

教師レビュー文と学生レビュー文の「文意の一致」を OpenAI で評価します。

- スコアは **1〜5**（5が最も一致）
- 出力: `ai_comment_alignment_score`, `ai_comment_alignment_reason`

### 評価の考え方

- 5: 文意がほぼ一致
- 4: ほぼ同じだが一部不足・補足あり
- 3: 一部は一致するがズレもある
- 2: 一致が弱い
- 1: 無関係 or 反対

OpenAI が使えない場合は、簡易的に **文字N-gramのJaccard係数**で代替します。

---

## 5. 総合評価（rubric + レビュー文）で credits を決定

信頼度スコア（rubric一致度）とレビュー文一致度を **重み付き平均**で合成します。

### 5-1. 正規化

```
レビュー文一致度_norm = ai_comment_alignment_score / 5
```

### 5-2. 重み付き平均（総合一致度）

```
総合一致度 = (rubric_weight * 信頼度 + comment_weight * レビュー文一致度_norm)
             / (rubric_weight + comment_weight)
```

- 片方が欠損している場合は、存在する方だけで再正規化します

### 5-3. credits の計算

```
credits_add = round( (review_credit_base + review_credit_alignment_bonus_max * 総合一致度) * multiplier )
```

- `review_credit_base` : ベースのクレジット
- `review_credit_alignment_bonus_max` : 総合一致度による最大ボーナス
- `multiplier` : TA の場合 `TA_CREDIT_MULTIPLIER`
- `credits_add` は最低 1

---

## 6. 欠損時の扱い

- **teacher rubric 未採点**: rubric一致度は `None` → レビュー文一致度のみで計算
- **teacher レビュー文なし**: レビュー文一致度は `None` → rubric一致度のみで計算
- **両方なし**: 総合一致度は 0 → ボーナスなし

> 現状は「レビュー提出時」に計算して固定します。教師採点が後から入った場合は、自動で再計算されません。

---

## 7. APIフロー（最短）

1. teacher が rubric を設定（課題作成 + rubric追加）
2. student がレビュー提出（rubricスコア + コメント）
3. teacher が採点を提出（rubricスコア + teacher_feedback）
4. student のレビューに対して、rubric一致度・レビュー文一致度が算出され credits に反映

---

## 8. 設定項目（.env）

```
# OpenAI
OPENAI_API_KEY=sk-...
# ENABLE_OPENAI=true  # polish など他機能で使用

# credits
REVIEW_CREDIT_BASE=1.0
REVIEW_CREDIT_ALIGNMENT_BONUS_MAX=1.0
REVIEW_CREDIT_RUBRIC_WEIGHT=0.5
REVIEW_CREDIT_COMMENT_WEIGHT=0.5
TA_CREDIT_MULTIPLIER=2.0
```

---

## 9. データ格納先

- rubric一致度: 保存せず、計算時に算出
- レビュー文一致度: `reviews.ai_comment_alignment_score`, `reviews.ai_comment_alignment_reason`

---

## 10. 例

### 2項目（max=5）のrubric
- teacher: [5, 4]
- student: [4, 3]

```
差分: [1, 1]
平均差分 = 1
平均最大スコア = (5+5)/2 = 5
信頼度スコア = 1 - (1/5) = 0.8
```

### レビュー文一致度
- OpenAI 判定: 4
- 正規化: 4/5 = 0.8

### 総合一致度 & credits
- weight = 0.5 / 0.5

```
総合一致度 = (0.8 + 0.8) / 2 = 0.8
credits_add = round(1.0 + 1.0 * 0.8) = round(1.8) = 2
```
