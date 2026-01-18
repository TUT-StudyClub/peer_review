# Step 2: レビュー受信通知

レビューが提出されたとき、提出物の作成者に通知を送信します。

## 前提条件

- Step 1 が完了していること

---

## 変更箇所

### backend/app/api/routes/reviews.py

#### 1. インポートを追加

ファイル先頭のインポート部分に追加:

```python
from app.services.push_notification import push_service
```

#### 2. submit_review 関数内に通知送信を追加

`submit_review` 関数内で、`db.commit()` の後、`return` の前に追加:

```python
    # 提出者にプッシュ通知を送信
    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == review_assignment.assignment_id)
        .first()
    )
    if assignment and submission.author_id:
        push_service.send_to_user(
            db=db,
            user_id=str(submission.author_id),
            title="レビューが届きました",
            body=f"課題「{assignment.title}」に新しいレビューが届きました",
            url=f"/assignments/{assignment.id}",
            notification_type="review_received",
        )
```

---

## 変更後のコード（該当部分）

```python
    db.commit()
    db.refresh(review)

    # 提出者にプッシュ通知を送信
    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == review_assignment.assignment_id)
        .first()
    )
    if assignment and submission.author_id:
        push_service.send_to_user(
            db=db,
            user_id=str(submission.author_id),
            title="レビューが届きました",
            body=f"課題「{assignment.title}」に新しいレビューが届きました",
            url=f"/assignments/{assignment.id}",
            notification_type="review_received",
        )

    review_public = ReviewPublic.model_validate(review)
    return review_public.model_copy(update=_evaluation_fields(credit))
```

---

## 動作確認

1. ユーザーAでログインし、プッシュ通知を有効化
2. ユーザーAで課題に提出
3. ユーザーBでログインし、ユーザーAの提出物をレビュー
4. ユーザーAに通知が届く

---

## 通知の内容

| 項目 | 値 |
|-----|---|
| タイトル | レビューが届きました |
| 本文 | 課題「{課題名}」に新しいレビューが届きました |
| クリック先 | /assignments/{assignment_id} |
| 通知タイプ | review_received |
