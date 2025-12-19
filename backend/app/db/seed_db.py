"""テストユーザーをDBに作成し、認証情報をファイルに出力"""

import csv
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User, UserRole


def _get_test_users() -> tuple[list[dict], str, str]:
    """実行時にランダムパスワードを生成してテストユーザーを作成。
    
    Returns:
        (テストユーザーリスト, 教員パスワード, 学生パスワード)
    """
    # 暗号学的に安全なランダムパスワードを生成
    teacher_password = secrets.token_urlsafe(16)
    student_password = secrets.token_urlsafe(16)

    test_users = [
        # Teachers (3人)
        {"name": "Teacher Alpha", "email": "teacher1@example.com", "password": teacher_password, "role": UserRole.teacher},
        {"name": "Teacher Beta", "email": "teacher2@example.com", "password": teacher_password, "role": UserRole.teacher},
        {"name": "Teacher Gamma", "email": "teacher3@example.com", "password": teacher_password, "role": UserRole.teacher},
        # Students (10人)
        *[
            {"name": f"Student {i:02d}", "email": f"student{i:02d}@example.com", "password": student_password, "role": UserRole.student}
            for i in range(1, 11)
        ]
    ]

    return test_users, teacher_password, student_password


def seed_db(db: Session) -> None:
    """テストユーザーをDBに作成し、認証情報ファイルを生成"""
    # すでにユーザーが存在する場合はスキップ
    existing_users = db.query(User).first()
    if existing_users:
        print("⚠️  Skip seeding: Users already exist in database")
        return

    # ランダムパスワードを生成
    test_users, teacher_pwd, student_pwd = _get_test_users()
    created_users = []

    for user_data in test_users:
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
    _export_user_credentials(created_users, teacher_pwd, student_pwd)


def _export_user_credentials(users: list[dict], teacher_pwd: str, student_pwd: str) -> None:
    """作成したユーザー情報を CSV と JSON で出力し、パスワード情報を表示"""
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

    # コンソールに明確に表示
    print("\n" + "=" * 70)
    print("✓ Test users created and credentials exported!")
    print("=" * 70)
    print("\n📁 Credentials file locations:")
    print(f"   JSON: {json_path}")
    print(f"   CSV:  {csv_path}")
    print("\n🔑 Generated Passwords:")
    print(f"   Teachers (3人): {teacher_pwd}")
    print(f"   Students (10人): {student_pwd}")
    print("\n💡 Usage: Open the JSON/CSV file to find individual user credentials.")
    print("=" * 70 + "\n")
