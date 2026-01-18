# Step 4: メタ評価通知

メタ評価（レビューへの評価）が提出されたとき、レビューの作成者に通知を送信します。

## 前提条件

- Step 1, 2, 3 が完了していること

---

## 変更箇所

### backend/app/api/routes/reviews.py

`create_meta_review` 関数に通知送信を追加します。

#### 1. インポート（Step 2で追加済みならスキップ）

```python
from app.services.push_notification import push_service
```

#### 2. メタ評価保存後に通知送信

`db.refresh(meta)` の後、`return meta` の前に追加:

```python
    # レビュー作成者にプッシュ通知を送信
    if review_assignment:
        assignment = (
            db.query(Assignment)
            .filter(Assignment.id == review_assignment.assignment_id)
            .first()
        )
        if assignment:
            push_service.send_to_user(
                db=db,
                user_id=str(review_assignment.reviewer_id),
                title="レビューが評価されました",
                body=f"課題「{assignment.title}」でのレビューが評価されました",
                url=f"/assignments/{assignment.id}",
                notification_type="meta_review",
            )
```

---

## 変更後のコード（create_meta_review関数全体）

```python
@router.post("/reviews/{review_id}/meta", response_model=MetaReviewPublic)
def create_meta_review(
    review_id: UUID,
    payload: MetaReviewCreate,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> MetaReview:
    review = db.query(Review).filter(Review.id == review_id).first()
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")

    review_assignment = (
        db.query(ReviewAssignment)
        .filter(ReviewAssignment.id == review.review_assignment_id)
        .first()
    )
    if review_assignment is None:
        raise HTTPException(status_code=404, detail="Review assignment not found")

    submission = (
        db.query(Submission)
        .filter(Submission.id == review_assignment.submission_id)
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the submission author can meta-review")

    existing = db.query(MetaReview).filter(MetaReview.review_id == review_id).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Meta-review already submitted")

    meta = MetaReview(
        review_id=review_id,
        rater_id=current_user.id,
        helpfulness=payload.helpfulness,
        comment=payload.comment,
    )
    db.add(meta)
    db.commit()
    db.refresh(meta)

    # レビュー作成者にプッシュ通知を送信
    if review_assignment:
        assignment = (
            db.query(Assignment)
            .filter(Assignment.id == review_assignment.assignment_id)
            .first()
        )
        if assignment:
            push_service.send_to_user(
                db=db,
                user_id=str(review_assignment.reviewer_id),
                title="レビューが評価されました",
                body=f"課題「{assignment.title}」でのレビューが評価されました",
                url=f"/assignments/{assignment.id}",
                notification_type="meta_review",
            )

    return meta
```

---

## 通知の内容

| 項目 | 値 |
|-----|---|
| タイトル | レビューが評価されました |
| 本文 | 課題「{課題名}」でのレビューが評価されました |
| クリック先 | /assignments/{assignment_id} |
| 通知タイプ | meta_review |
