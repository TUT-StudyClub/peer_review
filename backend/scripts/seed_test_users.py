import os
import sys
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from pathlib import Path
from typing import TYPE_CHECKING
from typing import NotRequired
from typing import TypedDict

from dotenv import load_dotenv

if TYPE_CHECKING:
    from app.models.user import UserRole


class UserSeed(TypedDict):
    email: str
    name: str
    role: "UserRole"
    credits: NotRequired[int]


class CourseSeed(TypedDict):
    title: str
    description: str
    teacher_email: str


class AssignmentSeed(TypedDict):
    course_title: str
    title: str
    description: str
    days_from_now: int


class CompletedAssignmentSeed(TypedDict):
    course_title: str
    assignment_title: str
    student_email: str
    teacher_email: str
    teacher_score: int
    feedback: str


# Ensure project root (backend/) is on sys.path when running as a script
ROOT = Path(__file__).resolve().parent.parent


def _ensure_app_path() -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))


def main() -> int:  # noqa: PLR0915
    load_dotenv()
    _ensure_app_path()
    # JTC（日本標準時）を定義
    jst = timezone(timedelta(hours=9))
    from app.core.config import COURSE_TITLE_CANDIDATES
    from app.core.config import settings
    from app.core.security import get_password_hash
    from app.db.session import SessionLocal
    from app.models.assignment import Assignment
    from app.models.course import Course
    from app.models.course import CourseEnrollment
    from app.models.review import MetaReview
    from app.models.review import Review
    from app.models.review import ReviewAssignment
    from app.models.review import ReviewAssignmentStatus
    from app.models.review import ReviewRubricScore
    from app.models.submission import Submission
    from app.models.submission import SubmissionFileType
    from app.models.submission import SubmissionRubricScore
    from app.models.user import User
    from app.models.user import UserRole
    from app.services.rubric import ensure_fixed_rubric

    password = os.getenv("TEST_USER_PASSWORD")
    assert password, "TEST_USER_PASSWORD is required"
    assert settings.allow_teacher_registration, "Teacher registration must be enabled"

    ta_credits = settings.ta_qualification_threshold + 5
    users: list[UserSeed] = [
        {"email": "teacher1@example.com", "name": "Teacher 1", "role": UserRole.teacher},
        {"email": "teacher2@example.com", "name": "Teacher 2", "role": UserRole.teacher},
        {"email": "teacher3@example.com", "name": "Teacher 3", "role": UserRole.teacher},
        {"email": "ta1@example.com", "name": "TA 1", "role": UserRole.student, "credits": ta_credits},
        {"email": "ta2@example.com", "name": "TA 2", "role": UserRole.student, "credits": ta_credits},
        {"email": "ta3@example.com", "name": "TA 3", "role": UserRole.student, "credits": ta_credits},
        {"email": "student_completed@example.com", "name": "Student Completed", "role": UserRole.student},
        *[{"email": f"student{i}@example.com", "name": f"Student {i}", "role": UserRole.student} for i in range(1, 11)],
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
                if "credits" in u and existing.credits < u["credits"]:
                    existing.credits = u["credits"]
                    updated_users += 1
                skipped_users += 1
                continue

            user_credits = u["credits"] if "credits" in u else 0
            db.add(
                User(
                    email=u["email"],
                    name=u["name"],
                    role=u["role"],
                    password_hash=get_password_hash(password),
                    credits=user_credits,
                )
            )
            created_users += 1

        db.commit()

        teacher_lookup = {
            user.email: user
            for user in db.query(User).filter(User.email.in_(["teacher1@example.com", "teacher2@example.com"])).all()
        }

        course_specs: list[CourseSeed] = [
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
            {
                "title": "脱退パターン検証: 提出なし・割当なし",
                "description": "[テストケース] このコースから脱退可能（提出なし × レビュー割当なし）",
                "teacher_email": "teacher1@example.com",
            },
            {
                "title": "脱退パターン検証: 提出あり・割当なし",
                "description": "[テストケース] このコースから脱退可能（提出あり × レビュー割当なし）",
                "teacher_email": "teacher2@example.com",
            },
            {
                "title": "脱退パターン検証: 提出なし・割当あり",
                "description": "[テストケース] このコースから脱退不可（提出なし × レビュー割当あり）",
                "teacher_email": "teacher1@example.com",
            },
            {
                "title": "脱退パターン検証: 提出あり・割当あり",
                "description": "[テストケース] このコースから脱退不可（提出あり × レビュー割当あり）",
                "teacher_email": "teacher2@example.com",
            },
        ]

        courses_by_title: dict[str, Course] = {}
        for spec in course_specs:
            teacher = teacher_lookup[spec["teacher_email"]]
            existing_course = (
                db.query(Course).filter(Course.title == spec["title"], Course.teacher_id == teacher.id).first()
            )
            if existing_course:
                courses_by_title[spec["title"]] = existing_course
                skipped_courses += 1
            else:
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
        assignment_specs: list[AssignmentSeed] = [
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
            {
                "course_title": "脱退パターン検証: 提出なし・割当なし",
                "title": "テスト課題 1",
                "description": "脱退テスト用: 提出なし × 割当なし",
                "days_from_now": 5,
            },
            {
                "course_title": "脱退パターン検証: 提出あり・割当なし",
                "title": "テスト課題 2",
                "description": "脱退テスト用: 提出あり × 割当なし",
                "days_from_now": 5,
            },
            {
                "course_title": "脱退パターン検証: 提出なし・割当あり",
                "title": "テスト課題 3",
                "description": "脱退テスト用: 提出なし × 割当あり",
                "days_from_now": 5,
            },
            {
                "course_title": "脱退パターン検証: 提出あり・割当あり",
                "title": "テスト課題 4",
                "description": "脱退テスト用: 提出あり × 割当あり",
                "days_from_now": 5,
            },
        ]

        for spec in assignment_specs:
            course = courses_by_title[spec["course_title"]]
            existing_assignment = (
                db.query(Assignment)
                .filter(Assignment.title == spec["title"], Assignment.course_id == course.id)
                .first()
            )
            if existing_assignment:
                skipped_assignments += 1
            else:
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

        # 事前完了課題の作成 (提出・採点済み)
        seed_dir = Path(settings.storage_dir) / "seed-submissions"
        seed_dir.mkdir(parents=True, exist_ok=True)

        assignments_by_key = {
            (assignment.course_id, assignment.title): assignment for assignment in db.query(Assignment).all()
        }

        completed_specs: list[CompletedAssignmentSeed] = [
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "student_completed@example.com",
                "teacher_email": "teacher1@example.com",
                "teacher_score": 18,
                "feedback": "基本要件は満たしています。次回は根拠をもう一段具体的に。",
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "student_completed@example.com",
                "teacher_email": "teacher2@example.com",
                "teacher_score": 19,
                "feedback": "整理された構成です。計算量の比較を追記するとさらに良くなります。",
            },
            {
                "course_title": "脱退パターン検証: 提出あり・割当なし",
                "assignment_title": "テスト課題 2",
                "student_email": "student_completed@example.com",
                "teacher_email": "teacher2@example.com",
                "teacher_score": 15,
                "feedback": "脱退テスト用: 提出済み × レビュー割当なし",
            },
            {
                "course_title": "脱退パターン検証: 提出あり・割当あり",
                "assignment_title": "テスト課題 4",
                "student_email": "student_completed@example.com",
                "teacher_email": "teacher2@example.com",
                "teacher_score": 16,
                "feedback": "脱退テスト用: 提出済み × レビュー割当あり",
            },
        ]

        for spec in completed_specs:
            course = courses_by_title[spec["course_title"]]
            assignment = assignments_by_key[(course.id, spec["assignment_title"])]
            student = db.query(User).filter(User.email == spec["student_email"]).first()
            assert student, f"Student not found: {spec['student_email']}"
            teacher = db.query(User).filter(User.email == spec["teacher_email"]).first()
            assert teacher, f"Teacher not found: {spec['teacher_email']}"

            enrollment = (
                db.query(CourseEnrollment)
                .filter(CourseEnrollment.course_id == course.id, CourseEnrollment.user_id == student.id)
                .first()
            )
            if enrollment is None:
                db.add(CourseEnrollment(course_id=course.id, user_id=student.id))

            submission = (
                db.query(Submission)
                .filter(Submission.assignment_id == assignment.id, Submission.author_id == student.id)
                .first()
            )
            if submission is None:
                file_path = seed_dir / f"{assignment.id}-{student.id}.md"
                file_path.write_text(
                    "# Seed submission\n\nこの提出はシードデータとして自動生成されました。",
                    encoding="utf-8",
                )
                submission = Submission(
                    assignment_id=assignment.id,
                    author_id=student.id,
                    file_type=SubmissionFileType.markdown,
                    original_filename="seed.md",
                    storage_path=str(file_path),
                    markdown_text=file_path.read_text(encoding="utf-8"),
                    submission_text=file_path.read_text(encoding="utf-8"),
                )
                db.add(submission)
                db.flush()
                db.refresh(submission)

            criteria = ensure_fixed_rubric(db, assignment.id)
            db.query(SubmissionRubricScore).filter(SubmissionRubricScore.submission_id == submission.id).delete()

            # rubric得点を均等配分（上限をmax_scoreに抑制）
            base_score = max(1, spec["teacher_score"] // max(len(criteria), 1))
            remaining = spec["teacher_score"]
            for idx, criterion in enumerate(criteria):
                raw = base_score if idx < len(criteria) - 1 else remaining
                score = int(min(raw, criterion.max_score))
                remaining -= score
                db.add(
                    SubmissionRubricScore(
                        submission_id=submission.id,
                        criterion_id=criterion.id,
                        score=score,
                    )
                )

            submission.teacher_total_score = spec["teacher_score"]
            submission.teacher_feedback = spec["feedback"]

            reviewer = db.query(User).filter(User.email == "ta1@example.com").first()
            if reviewer:
                review_assignment = (
                    db.query(ReviewAssignment)
                    .filter(
                        ReviewAssignment.submission_id == submission.id,
                        ReviewAssignment.reviewer_id == reviewer.id,
                    )
                    .first()
                )
                if review_assignment is None:
                    review_assignment = ReviewAssignment(
                        assignment_id=assignment.id,
                        submission_id=submission.id,
                        reviewer_id=reviewer.id,
                        status=ReviewAssignmentStatus.submitted,
                        submitted_at=datetime.now(jst),
                    )
                    db.add(review_assignment)
                    db.flush()

                review = db.query(Review).filter(Review.review_assignment_id == review_assignment.id).first()
                if review is None:
                    review = Review(
                        review_assignment_id=review_assignment.id,
                        comment="全体的に読みやすく、要点が整理されています。",
                        ai_quality_score=5,
                        ai_logic=5,
                        ai_specificity=4,
                        ai_comment_alignment_score=5,
                        ai_toxic=False,
                    )
                    db.add(review)
                    db.flush()

                db.query(ReviewRubricScore).filter(ReviewRubricScore.review_id == review.id).delete()
                for criterion in criteria:
                    db.add(
                        ReviewRubricScore(
                            review_id=review.id,
                            criterion_id=criterion.id,
                            score=min(criterion.max_score, 4),
                        )
                    )

                meta = db.query(MetaReview).filter(MetaReview.review_id == review.id).first()
                if meta is None:
                    db.add(MetaReview(review_id=review.id, rater_id=teacher.id, helpfulness=5))

        # 脱退テスト用: レビュー割り当てのみ (提出なし・割当あり)
        test_course_1 = courses_by_title.get("脱退パターン検証: 提出なし・割当あり")
        test_assignment_1 = assignments_by_key.get((test_course_1.id, "テスト課題 3")) if test_course_1 else None
        student_test = db.query(User).filter(User.email == "student_completed@example.com").first()
        if test_course_1 and test_assignment_1 and student_test:
            # コース登録
            enrollment_test = (
                db.query(CourseEnrollment)
                .filter(CourseEnrollment.course_id == test_course_1.id, CourseEnrollment.user_id == student_test.id)
                .first()
            )
            if enrollment_test is None:
                db.add(CourseEnrollment(course_id=test_course_1.id, user_id=student_test.id))

            # ダミー提出を作成（提出状態なしのテストケース）
            submission_dummy_1 = (
                db.query(Submission)
                .filter(Submission.assignment_id == test_assignment_1.id, Submission.author_id == student_test.id)
                .first()
            )
            if submission_dummy_1 is None:
                file_path_dummy_1 = seed_dir / f"{test_assignment_1.id}-{student_test.id}-dummy1.md"
                file_path_dummy_1.write_text(
                    "# ダミー提出（割当テスト用）\n\nこれはレビュー割当テスト用のダミー提出です。",
                    encoding="utf-8",
                )
                submission_dummy_1 = Submission(
                    assignment_id=test_assignment_1.id,
                    author_id=student_test.id,
                    file_type=SubmissionFileType.markdown,
                    original_filename="dummy1.md",
                    storage_path=str(file_path_dummy_1),
                    markdown_text=file_path_dummy_1.read_text(encoding="utf-8"),
                    submission_text=file_path_dummy_1.read_text(encoding="utf-8"),
                )
                db.add(submission_dummy_1)
                db.flush()

            # レビュー割り当て (提出なし状態で割当)
            review_assignment_1 = (
                db.query(ReviewAssignment)
                .filter(
                    ReviewAssignment.assignment_id == test_assignment_1.id,
                    ReviewAssignment.reviewer_id == student_test.id,
                )
                .first()
            )
            if review_assignment_1 is None:
                db.add(
                    ReviewAssignment(
                        assignment_id=test_assignment_1.id,
                        submission_id=submission_dummy_1.id,
                        reviewer_id=student_test.id,
                        status=ReviewAssignmentStatus.assigned,
                    )
                )

        # 脱退テスト用: レビュー割り当てあり (提出あり・割当あり)
        test_course_2 = courses_by_title.get("脱退パターン検証: 提出あり・割当あり")
        test_assignment_2 = assignments_by_key.get((test_course_2.id, "テスト課題 4")) if test_course_2 else None
        if test_course_2 and test_assignment_2 and student_test:
            # コース登録
            enrollment_test_2 = (
                db.query(CourseEnrollment)
                .filter(CourseEnrollment.course_id == test_course_2.id, CourseEnrollment.user_id == student_test.id)
                .first()
            )
            if enrollment_test_2 is None:
                db.add(CourseEnrollment(course_id=test_course_2.id, user_id=student_test.id))

            # ダミー提出を作成（提出あり状態）
            submission_dummy_2 = (
                db.query(Submission)
                .filter(Submission.assignment_id == test_assignment_2.id, Submission.author_id == student_test.id)
                .first()
            )
            if submission_dummy_2 is None:
                file_path_dummy_2 = seed_dir / f"{test_assignment_2.id}-{student_test.id}-dummy2.md"
                file_path_dummy_2.write_text(
                    "# ダミー提出（割当テスト用）\n\nこれはレビュー割当テスト用のダミー提出です。",
                    encoding="utf-8",
                )
                submission_dummy_2 = Submission(
                    assignment_id=test_assignment_2.id,
                    author_id=student_test.id,
                    file_type=SubmissionFileType.markdown,
                    original_filename="dummy2.md",
                    storage_path=str(file_path_dummy_2),
                    markdown_text=file_path_dummy_2.read_text(encoding="utf-8"),
                    submission_text=file_path_dummy_2.read_text(encoding="utf-8"),
                )
                db.add(submission_dummy_2)
                db.flush()

            # レビュー割り当て (提出あり状態で割当)
            review_assignment_2 = (
                db.query(ReviewAssignment)
                .filter(
                    ReviewAssignment.assignment_id == test_assignment_2.id,
                    ReviewAssignment.reviewer_id == student_test.id,
                )
                .first()
            )
            if review_assignment_2 is None:
                db.add(
                    ReviewAssignment(
                        assignment_id=test_assignment_2.id,
                        submission_id=submission_dummy_2.id,
                        reviewer_id=student_test.id,
                        status=ReviewAssignmentStatus.assigned,
                    )
                )

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
