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


class SpecialSubmissionSpec(TypedDict):
    """特別な提出物の仕様"""

    course_title: str
    assignment_title: str
    student_email: str
    days_ago: int
    seed_name: str
    teacher_score: int
    feedback: str


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


class ReviewSeed(TypedDict):
    course_title: str
    assignment_title: str
    student_email: str
    reviewer_email: str
    teacher_email: str
    days_ago: int
    comment: str
    comment_alignment: int
    rubric_score: int
    helpfulness: int
    quality_score: int


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
    from app.models.credit_history import CreditHistory
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

    ta_credits_base = 60
    ta_credits_low = 70
    ta_credits_mid = 90
    ta_credits_high = 105
    ta_credits_top = 120
    student_credits = 22
    special_tester_credits = 48
    users: list[UserSeed] = [
        {"email": "teacher@example.com", "name": "Teacher", "role": UserRole.teacher},
        {"email": "student@example.com", "name": "Student", "role": UserRole.student, "credits": student_credits},
        {"email": "other@example.com", "name": "Other Student", "role": UserRole.student},
        {"email": "author@example.com", "name": "Author", "role": UserRole.student},
        {"email": "rev@example.com", "name": "Reviewer", "role": UserRole.student},
        {"email": "teacher1@example.com", "name": "Teacher 1", "role": UserRole.teacher},
        {"email": "teacher2@example.com", "name": "Teacher 2", "role": UserRole.teacher},
        {"email": "teacher3@example.com", "name": "Teacher 3", "role": UserRole.teacher},
        {"email": "ta1@example.com", "name": "TA 1", "role": UserRole.student, "credits": ta_credits_top},
        {"email": "ta2@example.com", "name": "TA 2", "role": UserRole.student, "credits": ta_credits_high},
        {"email": "ta3@example.com", "name": "TA 3", "role": UserRole.student, "credits": ta_credits_mid},
        {"email": "ta4@example.com", "name": "TA 4", "role": UserRole.student, "credits": ta_credits_low},
        {"email": "ta5@example.com", "name": "TA 5", "role": UserRole.student, "credits": ta_credits_base},
        {"email": "student_completed@example.com", "name": "Student Completed", "role": UserRole.student},
        {"email": "grade1_student1@example.com", "name": "Grade 1 Student 1", "role": UserRole.student},
        {"email": "grade1_student2@example.com", "name": "Grade 1 Student 2", "role": UserRole.student},
        {"email": "grade2_student1@example.com", "name": "Grade 2 Student 1", "role": UserRole.student},
        {"email": "grade3_student1@example.com", "name": "Grade 3 Student 1", "role": UserRole.student},
        {
            "email": "special_tester@example.com",
            "name": "Special Tester",
            "role": UserRole.student,
            "credits": special_tester_credits,
        },
        {"email": "student1@example.com", "name": "Student 1", "role": UserRole.student, "credits": 28},
        {"email": "student2@example.com", "name": "Student 2", "role": UserRole.student, "credits": 32},
        {"email": "student3@example.com", "name": "Student 3", "role": UserRole.student, "credits": 26},
        *[{"email": f"student{i}@example.com", "name": f"Student {i}", "role": UserRole.student} for i in range(4, 11)],
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
                if "credits" in u and existing.credits != u["credits"]:
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
            for user in db.query(User)
            .filter(User.email.in_(["teacher1@example.com", "teacher2@example.com", "teacher3@example.com"]))
            .all()
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
                "title": "1年生コース: 基礎",
                "description": "[学年別] 1年生向けの基礎レビュー",
                "teacher_email": "teacher1@example.com",
            },
            {
                "title": "2年生コース: 応用",
                "description": "[学年別] 2年生向けの応用レビュー",
                "teacher_email": "teacher2@example.com",
            },
            {
                "title": "3年生コース: 発展",
                "description": "[学年別] 3年生向けの発展レビュー",
                "teacher_email": "teacher3@example.com",
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
                "course_title": "1年生コース: 基礎",
                "title": "1年生レビュー課題",
                "description": "[学年別] レビューの基本を学ぶ",
                "days_from_now": 6,
            },
            {
                "course_title": "2年生コース: 応用",
                "title": "2年生レビュー課題",
                "description": "[学年別] 応用的なレビュー課題",
                "days_from_now": 9,
            },
            {
                "course_title": "3年生コース: 発展",
                "title": "3年生レビュー課題",
                "description": "[学年別] 発展的なレビュー課題",
                "days_from_now": 12,
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

        seed_dir = Path(settings.storage_dir) / "seed-submissions"
        seed_dir.mkdir(parents=True, exist_ok=True)

        seed_emails = [u["email"] for u in users]
        user_lookup = {user.email: user for user in db.query(User).filter(User.email.in_(seed_emails)).all()}

        def ensure_enrollment(*, course: Course, student: User) -> None:
            existing_enrollment = (
                db.query(CourseEnrollment)
                .filter(CourseEnrollment.course_id == course.id, CourseEnrollment.user_id == student.id)
                .first()
            )
            if existing_enrollment is None:
                db.add(CourseEnrollment(course_id=course.id, user_id=student.id))

        def ensure_submission(*, assignment: Assignment, student: User, seed_name: str) -> Submission:
            existing_submission = (
                db.query(Submission)
                .filter(Submission.assignment_id == assignment.id, Submission.author_id == student.id)
                .first()
            )
            if existing_submission is not None:
                return existing_submission

            file_path = seed_dir / f"{assignment.id}-{student.id}-{seed_name}.md"
            file_path.write_text(
                "# Seed submission\n\nこの提出はランキング検証用に自動生成されました。",
                encoding="utf-8",
            )
            submission = Submission(
                assignment_id=assignment.id,
                author_id=student.id,
                file_type=SubmissionFileType.markdown,
                original_filename=f"seed-{seed_name}.md",
                storage_path=str(file_path),
                markdown_text=file_path.read_text(encoding="utf-8"),
                submission_text=file_path.read_text(encoding="utf-8"),
            )
            db.add(submission)
            db.flush()
            db.refresh(submission)
            return submission

        def ensure_teacher_scores(*, submission: Submission, base_score: int) -> None:
            existing_scores = (
                db.query(SubmissionRubricScore).filter(SubmissionRubricScore.submission_id == submission.id).all()
            )
            if existing_scores:
                return

            criteria = ensure_fixed_rubric(db, submission.assignment_id)
            for criterion in criteria:
                score = int(min(base_score, criterion.max_score))
                db.add(
                    SubmissionRubricScore(
                        submission_id=submission.id,
                        criterion_id=criterion.id,
                        score=score,
                    )
                )

        def ensure_review(
            *,
            assignment: Assignment,
            submission: Submission,
            reviewer: User,
            teacher: User,
            created_at: datetime,
            comment: str,
            comment_alignment: int,
            rubric_score: int,
            helpfulness: int,
            quality_score: int,
        ) -> None:
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
                    submitted_at=created_at,
                )
                db.add(review_assignment)
                db.flush()
            else:
                review_assignment.status = ReviewAssignmentStatus.submitted
                review_assignment.submitted_at = created_at

            review = db.query(Review).filter(Review.review_assignment_id == review_assignment.id).first()
            if review is None:
                review = Review(
                    review_assignment_id=review_assignment.id,
                    comment=comment,
                    created_at=created_at,
                    ai_quality_score=quality_score,
                    ai_logic=5,
                    ai_specificity=4,
                    ai_comment_alignment_score=comment_alignment,
                    ai_toxic=False,
                )
                db.add(review)
                db.flush()
            else:
                review.comment = comment
                review.created_at = created_at
                review.ai_quality_score = quality_score
                review.ai_logic = 5
                review.ai_specificity = 4
                review.ai_comment_alignment_score = comment_alignment
                review.ai_toxic = False

            db.query(ReviewRubricScore).filter(ReviewRubricScore.review_id == review.id).delete()
            criteria = ensure_fixed_rubric(db, assignment.id)
            for criterion in criteria:
                score = int(min(rubric_score, criterion.max_score))
                db.add(
                    ReviewRubricScore(
                        review_id=review.id,
                        criterion_id=criterion.id,
                        score=score,
                    )
                )

            meta = db.query(MetaReview).filter(MetaReview.review_id == review.id).first()
            if meta is None:
                db.add(
                    MetaReview(
                        review_id=review.id,
                        rater_id=teacher.id,
                        helpfulness=helpfulness,
                        created_at=created_at,
                    )
                )
            else:
                meta.helpfulness = helpfulness
                meta.created_at = created_at

        # 事前完了課題の作成 (提出・採点済み)

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

        ranking_review_specs: list[ReviewSeed] = [
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "student1@example.com",
                "reviewer_email": "ta5@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 2,
                "comment": "週間ランキング向けのレビュー。要点が明確で読みやすいです。",
                "comment_alignment": 5,
                "rubric_score": 4,
                "helpfulness": 5,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "student2@example.com",
                "reviewer_email": "ta5@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 3,
                "comment": "週間ランキング向けのレビュー。比較観点が整理されています。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 4,
                "quality_score": 4,
            },
            {
                "course_title": "1年生コース: 基礎",
                "assignment_title": "1年生レビュー課題",
                "student_email": "grade1_student1@example.com",
                "reviewer_email": "ta5@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 1,
                "comment": "学年別ランキング(1年)用レビュー。基礎事項が丁寧です。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 5,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student7@example.com",
                "reviewer_email": "ta5@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 0,
                "comment": "デイリー向けのレビュー。短時間で要点がまとまっています。",
                "comment_alignment": 5,
                "rubric_score": 4,
                "helpfulness": 4,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student3@example.com",
                "reviewer_email": "ta4@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 5,
                "comment": "週間ランキング比較用のレビュー。根拠の提示が良いです。",
                "comment_alignment": 4,
                "rubric_score": 3,
                "helpfulness": 4,
                "quality_score": 4,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 2",
                "student_email": "student4@example.com",
                "reviewer_email": "ta2@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 12,
                "comment": "月間ランキング向けのレビュー。構成の改善点が明確です。",
                "comment_alignment": 3,
                "rubric_score": 3,
                "helpfulness": 3,
                "quality_score": 3,
            },
            {
                "course_title": "2年生コース: 応用",
                "assignment_title": "2年生レビュー課題",
                "student_email": "grade2_student1@example.com",
                "reviewer_email": "ta2@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 20,
                "comment": "学年別ランキング(2年)用レビュー。応用面の指摘が適切です。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 4,
                "quality_score": 4,
            },
            {
                "course_title": "3年生コース: 発展",
                "assignment_title": "3年生レビュー課題",
                "student_email": "grade3_student1@example.com",
                "reviewer_email": "ta3@example.com",
                "teacher_email": "teacher3@example.com",
                "days_ago": 25,
                "comment": "学年別ランキング(3年)用レビュー。発展課題の視点が良いです。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 4,
                "quality_score": 4,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "student5@example.com",
                "reviewer_email": "ta1@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 40,
                "comment": "総合ランキング用の旧レビュー。改善点が簡潔に示されています。",
                "comment_alignment": 3,
                "rubric_score": 3,
                "helpfulness": 2,
                "quality_score": 3,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "student6@example.com",
                "reviewer_email": "ta1@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 45,
                "comment": "総合ランキング用の旧レビュー。視点は良いが具体例が不足です。",
                "comment_alignment": 3,
                "rubric_score": 3,
                "helpfulness": 2,
                "quality_score": 3,
            },
            {
                "course_title": "1年生コース: 基礎",
                "assignment_title": "1年生レビュー課題",
                "student_email": "grade1_student2@example.com",
                "reviewer_email": "ta4@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 8,
                "comment": "レビュー数比較用。基礎理解は良いが改善点も多いです。",
                "comment_alignment": 2,
                "rubric_score": 2,
                "helpfulness": 2,
                "quality_score": 2,
            },
            {
                "course_title": "2年生コース: 応用",
                "assignment_title": "2年生レビュー課題",
                "student_email": "grade2_student1@example.com",
                "reviewer_email": "ta4@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 18,
                "comment": "レビュー数比較用。指摘が具体的で良いです。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 4,
                "quality_score": 4,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student8@example.com",
                "reviewer_email": "ta2@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 6,
                "comment": "レビュー数比較用。全体は良いが具体性がやや不足。",
                "comment_alignment": 3,
                "rubric_score": 3,
                "helpfulness": 3,
                "quality_score": 3,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "student9@example.com",
                "reviewer_email": "special_tester@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 4,
                "comment": "指標表示テスト用レビュー。論点が整理されています。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 5,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 2",
                "student_email": "student10@example.com",
                "reviewer_email": "special_tester@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 9,
                "comment": "指標表示テスト用レビュー。具体性が高い指摘です。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 5,
                "quality_score": 4,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student2@example.com",
                "reviewer_email": "ta1@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 3,
                "comment": "平均評価スコアの変化確認用。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 4,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "student3@example.com",
                "reviewer_email": "ta4@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 5,
                "comment": "役立つレビュー数の変化確認用。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 5,
                "quality_score": 4,
            },
            {
                "course_title": "1年生コース: 基礎",
                "assignment_title": "1年生レビュー課題",
                "student_email": "grade1_student1@example.com",
                "reviewer_email": "ta3@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 2,
                "comment": "レビュー提出数の変化確認用。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 4,
                "quality_score": 4,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "student4@example.com",
                "reviewer_email": "ta1@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 28,
                "comment": "平均評価スコア推移用（高評価）。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 4,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "student5@example.com",
                "reviewer_email": "ta1@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 14,
                "comment": "平均評価スコア推移用（中評価）。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 3,
                "quality_score": 3,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student6@example.com",
                "reviewer_email": "ta1@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 6,
                "comment": "平均評価スコア推移用（高評価）。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 5,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 2",
                "student_email": "student7@example.com",
                "reviewer_email": "ta2@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 25,
                "comment": "平均評価スコア推移用（低評価）。",
                "comment_alignment": 3,
                "rubric_score": 3,
                "helpfulness": 2,
                "quality_score": 2,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student8@example.com",
                "reviewer_email": "ta2@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 11,
                "comment": "平均評価スコア推移用（中評価）。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 3,
                "quality_score": 3,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "student9@example.com",
                "reviewer_email": "ta2@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 4,
                "comment": "平均評価スコア推移用（高評価）。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 4,
                "quality_score": 5,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "student10@example.com",
                "reviewer_email": "special_tester@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 22,
                "comment": "平均評価スコア推移用（低評価）。",
                "comment_alignment": 3,
                "rubric_score": 3,
                "helpfulness": 2,
                "quality_score": 2,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 2",
                "student_email": "student2@example.com",
                "reviewer_email": "special_tester@example.com",
                "teacher_email": "teacher2@example.com",
                "days_ago": 13,
                "comment": "平均評価スコア推移用（中評価）。",
                "comment_alignment": 4,
                "rubric_score": 4,
                "helpfulness": 3,
                "quality_score": 3,
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 2",
                "student_email": "student3@example.com",
                "reviewer_email": "special_tester@example.com",
                "teacher_email": "teacher1@example.com",
                "days_ago": 5,
                "comment": "平均評価スコア推移用（高評価）。",
                "comment_alignment": 5,
                "rubric_score": 5,
                "helpfulness": 4,
                "quality_score": 5,
            },
        ]

        utc_now = datetime.now(jst)
        for spec in ranking_review_specs:
            course = courses_by_title[spec["course_title"]]
            assignment = assignments_by_key[(course.id, spec["assignment_title"])]
            student = user_lookup[spec["student_email"]]
            reviewer = user_lookup[spec["reviewer_email"]]
            teacher = user_lookup[spec["teacher_email"]]

            ensure_enrollment(course=course, student=student)
            submission = ensure_submission(
                assignment=assignment,
                student=student,
                seed_name=f"ranking-{reviewer.email}",
            )
            ensure_teacher_scores(submission=submission, base_score=3)

            created_at = utc_now - timedelta(days=spec["days_ago"])
            ensure_review(
                assignment=assignment,
                submission=submission,
                reviewer=reviewer,
                teacher=teacher,
                created_at=created_at,
                comment=spec["comment"],
                comment_alignment=spec["comment_alignment"],
                rubric_score=spec["rubric_score"],
                helpfulness=spec["helpfulness"],
                quality_score=spec["quality_score"],
            )

        fallback_course = courses_by_title.get(COURSE_TITLE_CANDIDATES[0])
        fallback_assignment = (
            assignments_by_key.get((fallback_course.id, "レビュー演習 1")) if fallback_course else None
        )
        fallback_teacher = user_lookup.get("teacher1@example.com") or next(
            (user for user in user_lookup.values() if user.role == UserRole.teacher),
            None,
        )
        student_candidates = [user for user in user_lookup.values() if user.role == UserRole.student]

        def has_recent_review(reviewer: User, since: datetime) -> bool:
            return (
                db.query(Review)
                .join(ReviewAssignment, Review.review_assignment_id == ReviewAssignment.id)
                .filter(ReviewAssignment.reviewer_id == reviewer.id)
                .filter(Review.created_at >= since)
                .first()
                is not None
            )

        if fallback_course and fallback_assignment and fallback_teacher and student_candidates:
            for reviewer in student_candidates:
                if has_recent_review(reviewer, utc_now - timedelta(days=30)):
                    continue

                author = user_lookup.get("student@example.com") or student_candidates[0]
                if author.id == reviewer.id:
                    author = next((student for student in student_candidates if student.id != reviewer.id), author)

                ensure_enrollment(course=fallback_course, student=author)
                ensure_enrollment(course=fallback_course, student=reviewer)
                submission = ensure_submission(
                    assignment=fallback_assignment,
                    student=author,
                    seed_name=f"fallback-{reviewer.email}",
                )
                ensure_teacher_scores(submission=submission, base_score=3)
                ensure_review(
                    assignment=fallback_assignment,
                    submission=submission,
                    reviewer=reviewer,
                    teacher=fallback_teacher,
                    created_at=utc_now - timedelta(days=2),
                    comment="未設定回避用のレビュー。",
                    comment_alignment=4,
                    rubric_score=3,
                    helpfulness=3,
                    quality_score=4,
                )

        special_submission_specs: list[SpecialSubmissionSpec] = [
            {
                "course_title": COURSE_TITLE_CANDIDATES[0],
                "assignment_title": "レビュー演習 1",
                "student_email": "special_tester@example.com",
                "days_ago": 21,
                "seed_name": "special-review-1",
                "teacher_score": 86,
                "feedback": "要点が整理されており、改善点も明確です。",
            },
            {
                "course_title": COURSE_TITLE_CANDIDATES[1],
                "assignment_title": "データ構造レポート 1",
                "student_email": "special_tester@example.com",
                "days_ago": 10,
                "seed_name": "special-review-2",
                "teacher_score": 74,
                "feedback": "具体例が追加されるとさらに良くなります。",
            },
        ]

        for spec in special_submission_specs:
            course = courses_by_title[spec["course_title"]]
            assignment = assignments_by_key[(course.id, spec["assignment_title"])]
            student = user_lookup.get(spec["student_email"])
            if not student:
                continue
            ensure_enrollment(course=course, student=student)
            submission = ensure_submission(
                assignment=assignment,
                student=student,
                seed_name=spec["seed_name"],
            )
            submission.created_at = utc_now - timedelta(days=spec["days_ago"])
            ensure_teacher_scores(submission=submission, base_score=spec["teacher_score"] // 20 or 3)
            submission.teacher_total_score = spec["teacher_score"]
            submission.teacher_feedback = spec["feedback"]

        def ensure_credit_history_series(
            user: User,
            total: int,
            now: datetime,
            deltas: list[int] | None = None,
        ) -> None:
            existing = db.query(CreditHistory).filter(CreditHistory.user_id == user.id).all()
            if total <= 0:
                return
            if existing:
                if any(history.reason != "seed_history" for history in existing):
                    return
                db.query(CreditHistory).filter(CreditHistory.user_id == user.id).delete()

            if deltas:
                safe_deltas = [max(0, int(delta)) for delta in deltas if delta > 0]
                if not safe_deltas:
                    return
                offsets = [90, 60, 45, 30, 21, 14, 7, 3][-len(safe_deltas) :]
                running_total = 0
                for idx, delta_value in enumerate(safe_deltas):
                    delta_original = delta_value
                    running_total += delta_value
                    adjusted_delta = delta_value
                    if idx == len(safe_deltas) - 1 and running_total != total:
                        adjusted_delta = max(0, delta_value + (total - running_total))
                        running_total = running_total - delta_original + adjusted_delta
                    db.add(
                        CreditHistory(
                            user_id=user.id,
                            delta=adjusted_delta,
                            total_credits=running_total,
                            reason="seed_history",
                            created_at=now - timedelta(days=offsets[idx]),
                        )
                    )
                return

            step_count = min(6, total)
            base = total // step_count
            remainder = total % step_count
            offsets = [60, 45, 30, 14, 7, 2][-step_count:]

            running_total = 0
            for idx in range(step_count):
                delta = base + (1 if idx < remainder else 0)
                running_total += delta
                db.add(
                    CreditHistory(
                        user_id=user.id,
                        delta=delta,
                        total_credits=running_total,
                        reason="seed_history",
                        created_at=now - timedelta(days=offsets[idx]),
                    )
                )

        trend_seed_map = {
            "ta1@example.com": [10, 20, 15, 30, 25, 20],
            "ta2@example.com": [12, 18, 22, 10, 25, 18],
            "ta3@example.com": [8, 16, 24, 12, 14, 16],
            "ta4@example.com": [5, 10, 15, 8, 12, 20],
            "ta5@example.com": [6, 9, 12, 7, 11, 15],
            "student@example.com": [2, 4, 6, 3, 4, 3],
            "student1@example.com": [4, 6, 5, 4, 5, 4],
            "student2@example.com": [5, 7, 6, 4, 5, 5],
            "student3@example.com": [3, 5, 4, 3, 5, 6],
            "special_tester@example.com": [4, 9, 5, 12, 6, 12],
        }
        enrollment_course = courses_by_title.get(COURSE_TITLE_CANDIDATES[0])
        for email, deltas in trend_seed_map.items():
            target_user = user_lookup.get(email)
            if not target_user:
                continue
            if enrollment_course:
                ensure_enrollment(course=enrollment_course, student=target_user)
            ensure_credit_history_series(target_user, target_user.credits, utc_now, deltas=deltas)

        db.commit()

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
