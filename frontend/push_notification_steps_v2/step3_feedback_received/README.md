# Step 3: 教授フィードバック通知

教授がフィードバックを送信したとき、学生に通知を送信します。

## 前提条件

- Step 1, 2 が完了していること

---

## 変更箇所

教授FB送信のAPIがある場合、該当するAPIファイルに追加します。

### インポートを追加

```python
from app.services.push_notification import push_service
```

### フィードバック保存後に通知送信

```python
# 学生にプッシュ通知を送信
push_service.send_to_user(
    db=db,
    user_id=str(submission.author_id),
    title="教授からフィードバックが届きました",
    body=f"課題「{assignment.title}」にフィードバックが届きました",
    url=f"/assignments/{assignment.id}",
    notification_type="feedback_received",
)
```

---

## 実装例（submissions.py に教授FBエンドポイントがある場合）

```python
@router.post("/submissions/{submission_id}/feedback")
def add_teacher_feedback(
    submission_id: UUID,
    payload: FeedbackCreate,
    db: Session = db_dependency,
    current_user: User = teacher_dependency,
):
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # フィードバックを保存
    submission.teacher_feedback = payload.feedback
    db.commit()

    # 学生にプッシュ通知を送信
    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == submission.assignment_id)
        .first()
    )
    if assignment:
        push_service.send_to_user(
            db=db,
            user_id=str(submission.author_id),
            title="教授からフィードバックが届きました",
            body=f"課題「{assignment.title}」にフィードバックが届きました",
            url=f"/assignments/{assignment.id}",
            notification_type="feedback_received",
        )

    return {"status": "ok"}
```

---

## 通知の内容

| 項目 | 値 |
|-----|---|
| タイトル | 教授からフィードバックが届きました |
| 本文 | 課題「{課題名}」にフィードバックが届きました |
| クリック先 | /assignments/{assignment_id} |
| 通知タイプ | feedback_received |
