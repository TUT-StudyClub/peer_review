# Step 5: 締切リマインダー通知

課題の締切が近づいたとき、未提出の学生に通知を送信します。

## 前提条件

- Step 1〜4 が完了していること
- Assignmentモデルに `deadline` フィールドがあること

---

## 実装方法

締切リマインダーは定期実行（バッチ処理）で実装します。

---

## 実装例（スクリプト）

### backend/scripts/send_reminders.py

```python
#!/usr/bin/env python
"""締切リマインダーを送信するスクリプト"""

import sys
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
from app.models.assignment import Assignment
from app.models.course import CourseEnrollment
from app.models.submission import Submission
from app.services.push_notification import push_service


def send_deadline_reminders(hours_before: int = 24):
    """
    締切が近い課題の未提出者に通知を送信

    Args:
        hours_before: 締切の何時間前に通知するか（デフォルト: 24時間）
    """
    db = SessionLocal()
    try:
        now = datetime.now(UTC)
        deadline_threshold = now + timedelta(hours=hours_before)

        # 締切が近い課題を取得
        assignments = (
            db.query(Assignment)
            .filter(
                Assignment.deadline > now,
                Assignment.deadline <= deadline_threshold,
            )
            .all()
        )

        sent_count = 0

        for assignment in assignments:
            # この課題に提出済みのユーザーIDを取得
            submitted_user_ids = (
                db.query(Submission.author_id)
                .filter(Submission.assignment_id == assignment.id)
                .all()
            )
            submitted_user_ids = {uid[0] for uid in submitted_user_ids}

            # コースに登録している学生を取得
            enrollments = (
                db.query(CourseEnrollment)
                .filter(CourseEnrollment.course_id == assignment.course_id)
                .all()
            )

            for enrollment in enrollments:
                # 未提出の学生にのみ通知
                if enrollment.user_id not in submitted_user_ids:
                    result = push_service.send_to_user(
                        db=db,
                        user_id=str(enrollment.user_id),
                        title="締切が近づいています",
                        body=f"課題「{assignment.title}」の締切まであと{hours_before}時間です",
                        url=f"/assignments/{assignment.id}",
                        notification_type="deadline_reminder",
                    )
                    if result.get("success", 0) > 0:
                        sent_count += 1

        print(f"Sent {sent_count} reminders")
    finally:
        db.close()


if __name__ == "__main__":
    hours = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    send_deadline_reminders(hours)
```

---

## 実行方法

```bash
cd backend
python scripts/send_reminders.py 24  # 24時間前に通知
```

---

## cronで定期実行（例: 毎日9時）

```cron
0 9 * * * cd /path/to/backend && python scripts/send_reminders.py 24
```

---

## 通知の内容

| 項目 | 値 |
|-----|---|
| タイトル | 締切が近づいています |
| 本文 | 課題「{課題名}」の締切まであと{N}時間です |
| クリック先 | /assignments/{assignment_id} |
| 通知タイプ | deadline_reminder |

---

## 注意事項

- Assignmentモデルに `deadline` フィールドが必要です
- なければ追加するか、締切機能を先に実装してください
