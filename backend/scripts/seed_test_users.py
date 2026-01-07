import os
import sys
from datetime import datetime, timedelta, timezone
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
<<<<<<< HEAD
    from app.core.config import COURSE_TITLE_CANDIDATES, settings
    from app.core.security import get_password_hash
    from app.db.session import SessionLocal
    from app.models.assignment import Assignment
    from app.models.course import Course
    from app.models.user import User, UserRole
=======
    from app.core.config import settings  # noqa: PLC0415
    from app.core.security import get_password_hash  # noqa: PLC0415
    from app.db.session import SessionLocal  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415
    from app.models.user import UserRole  # noqa: PLC0415
>>>>>>> main

    password = os.getenv("TEST_USER_PASSWORD")
    if not password:
        print("ERROR: TEST_USER_PASSWORD is not set. Add it to backend/.env or export it before running.")
        return 1

    if not settings.allow_teacher_registration:
        print("ERROR: Teacher registration is disabled (ALLOW_TEACHER_REGISTRATION=false).")
        return 1

    ta_credits = settings.ta_qualification_threshold + 5
    users = [
        {"email": "teacher1@example.com", "name": "Teacher 1", "role": UserRole.teacher},
        {"email": "teacher2@example.com", "name": "Teacher 2", "role": UserRole.teacher},
        {"email": "teacher3@example.com", "name": "Teacher 3", "role": UserRole.teacher},
<<<<<<< HEAD
        {"email": "ta1@example.com", "name": "TA 1", "role": UserRole.student, "credits": ta_credits},
        {"email": "ta2@example.com", "name": "TA 2", "role": UserRole.student, "credits": ta_credits},
        {"email": "ta3@example.com", "name": "TA 3", "role": UserRole.student, "credits": ta_credits},
        *[
            {"email": f"student{i}@example.com", "name": f"Student {i}", "role": UserRole.student}
            for i in range(1, 11)
        ],
=======
        *[{"email": f"student{i}@example.com", "name": f"Student {i}", "role": UserRole.student} for i in range(1, 11)],
>>>>>>> main
    ]

    created_users = 0
    skipped_users = 0
    updated_users = 0
    created_courses = 0
    skipped_courses = 0
    created_assignments = 0
    skipped_assignments = 0
    with SessionLocal() as db:
        for u in users:
            existing = db.query(User).filter_by(email=u["email"]).first()
            if existing:
                desired_credits = u.get("credits")
                if desired_credits is not None and existing.credits < desired_credits:
                    existing.credits = desired_credits
                    updated_users += 1
                print(f"skip (exists) {u['email']}")
                skipped_users += 1
                continue

            db.add(
                User(
                    email=u["email"],
                    name=u["name"],
                    role=u["role"],
                    password_hash=get_password_hash(password),
                    credits=u.get("credits", 0),
                )
            )
            created_users += 1

        db.commit()

        teacher_lookup = {
            user.email: user
            for user in db.query(User).filter(User.email.in_(["teacher1@example.com", "teacher2@example.com"])).all()
        }

        course_specs = [
            {
                "title": COURSE_TITLE_CANDIDATES[0],
                "description": "アルゴリズムの基礎とレビュー実践",
                "teacher_email": "teacher1@example.com",
            },
            {
                "title": COURSE_TITLE_CANDIDATES[1],
                "description": "データ構造の理解を深める演習",
                "teacher_email": "teacher2@example.com",
            },
        ]

        courses_by_title: dict[str, Course] = {}
        for spec in course_specs:
            teacher = teacher_lookup.get(spec["teacher_email"])
            if not teacher:
                continue
            existing_course = (
                db.query(Course)
                .filter(Course.title == spec["title"], Course.teacher_id == teacher.id)
                .first()
            )
            if existing_course:
                courses_by_title[spec["title"]] = existing_course
                skipped_courses += 1
                continue
            course = Course(
                title=spec["title"],
                description=spec["description"],
                teacher_id=teacher.id,
            )
            db.add(course)
            db.flush()
            courses_by_title[spec["title"]] = course
            created_courses += 1

        now = datetime.now(timezone(timedelta(hours=9)))
        assignment_specs = [
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "title": "レビュー演習 1",
                "description": "レビューの観点を学ぶ課題",
                "days_from_now": 3,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "title": "レビュー演習 2",
                "description": "根拠の示し方を意識する課題",
                "days_from_now": 7,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "title": "データ構造レポート 1",
                "description": "スタックとキューの違いをまとめる",
                "days_from_now": 10,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "title": "データ構造レポート 2",
                "description": "木構造の利点を説明する",
                "days_from_now": 14,
            },
        ]

        for spec in assignment_specs:
            course = courses_by_title.get(spec["course_title"])
            if not course:
                continue
            existing_assignment = (
                db.query(Assignment)
                .filter(Assignment.title == spec["title"], Assignment.course_id == course.id)
                .first()
            )
            if existing_assignment:
                skipped_assignments += 1
                continue
            due_at = now + timedelta(days=spec["days_from_now"])
            db.add(
                Assignment(
                    course_id=course.id,
                    title=spec["title"],
                    description=spec["description"],
                    target_reviews_per_submission=2,
                    due_at=due_at,
                )
            )
            created_assignments += 1

        db.commit()

    print(
        "done:"
        f" users created={created_users}, skipped={skipped_users}, updated={updated_users};"
        f" courses created={created_courses}, skipped={skipped_courses};"
        f" assignments created={created_assignments}, skipped={skipped_assignments}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
