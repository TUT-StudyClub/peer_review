"""テストユーザーをDBに作成し、認証情報をファイルに出力"""

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User, UserRole

# テストユーザー定義
TEST_USERS = [
    # Teachers (3人)
    {"name": "Teacher Alpha", "email": "teacher1@example.com", "password": "teacher123", "role": UserRole.teacher},
    {"name": "Teacher Beta", "email": "teacher2@example.com", "password": "teacher123", "role": UserRole.teacher},
    {"name": "Teacher Gamma", "email": "teacher3@example.com", "password": "teacher123", "role": UserRole.teacher},
    # Students (10人)
    *[
        {"name": f"Student {i:02d}", "email": f"student{i:02d}@example.com", "password": "student123", "role": UserRole.student}
        for i in range(1, 11)
    ]
]


def seed_db(db: Session) -> None:
    """テストユーザーをDBに作成し、CSV に出力"""
    # すでにユーザーが存在する場合はスキップ
    existing_users = db.query(User).first()
    if existing_users:
        return

    created_users = []

    for user_data in TEST_USERS:
        user = User(
            id=uuid4(),
            email=user_data["email"],
            name=user_data["name"],
            role=user_data["role"],
            password_hash=get_password_hash(user_data["password"]),
            credits=0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        created_users.append(
            {
                "username": user_data["name"],
                "email": user_data["email"],
                "password": user_data["password"],
                "role": user_data["role"].value,
            }
        )

    db.commit()

    # ファイルに出力
    _export_user_credentials(created_users)


def _export_user_credentials(users: list[dict]) -> None:
    """作成したユーザー情報を CSV と JSON で出力"""
    # バックエンド直下の test_users へ絶対パスで出力（起動場所に依存しない）
    backend_root = Path(__file__).resolve().parents[2]
    output_dir = backend_root / "test_users"
    output_dir.mkdir(exist_ok=True)

    # CSV で出力
    csv_path = output_dir / "test_users.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["username", "email", "password", "role"])
        writer.writeheader()
        writer.writerows(users)

    # JSON で出力
    json_path = output_dir / "test_users.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)

    print(f"✓ Test users exported to {csv_path} and {json_path}")
