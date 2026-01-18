import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Ensure project root (backend/) is on sys.path when running as a script
ROOT = Path(__file__).resolve().parent.parent


def _ensure_app_path() -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))


def main() -> int:
    load_dotenv()
    _ensure_app_path()
    from app.core.config import settings  # noqa: PLC0415
    from app.core.security import get_password_hash  # noqa: PLC0415
    from app.db.session import SessionLocal  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415
    from app.models.user import UserRole  # noqa: PLC0415

    password = os.getenv("TEST_USER_PASSWORD")
    if not password:
        print("ERROR: TEST_USER_PASSWORD is not set. Add it to backend/.env or export it before running.")
        return 1

    if not settings.allow_teacher_registration:
        print("ERROR: Teacher registration is disabled (ALLOW_TEACHER_REGISTRATION=false).")
        return 1

    users = [
        {"email": "teacher1@example.com", "name": "Teacher 1", "role": UserRole.teacher},
        {"email": "teacher2@example.com", "name": "Teacher 2", "role": UserRole.teacher},
        {"email": "teacher3@example.com", "name": "Teacher 3", "role": UserRole.teacher},
        *[{"email": f"student{i}@example.com", "name": f"Student {i}", "role": UserRole.student} for i in range(1, 11)],
    ]

    created = 0
    skipped = 0
    with SessionLocal() as db:
        for u in users:
            if db.query(User).filter_by(email=u["email"]).first():
                print(f"skip (exists) {u['email']}")
                skipped += 1
                continue

            db.add(
                User(
                    email=u["email"],
                    name=u["name"],
                    role=u["role"],
                    password_hash=get_password_hash(password),
                )
            )
            created += 1

        db.commit()

    print(f"done: created={created}, skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
