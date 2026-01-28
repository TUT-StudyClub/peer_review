"""
授業エンドポイントのテスト
"""

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

from app.api.routes.courses import get_course_detail
from app.api.routes.courses import unenroll_course
from app.db.base import Base
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.course import CourseEnrollment
from app.models.review import ReviewAssignment
from app.models.submission import Submission
from app.models.submission import SubmissionFileType
from app.models.user import User
from app.models.user import UserRole


def _make_session() -> Session:
    """テスト用DBセッション生成"""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


@pytest.fixture
def db_session():
    """DBセッションフィクスチャ"""
    return _make_session()


@pytest.fixture
def teacher(db_session: Session) -> User:
    """テスト用の教師を作成"""
    teacher = User(
        email="teacher@example.com",
        name="先生 太郎",
        password_hash="hash_teacher",
        role=UserRole.teacher,
    )
    db_session.add(teacher)
    db_session.commit()
    return teacher


@pytest.fixture
def student(db_session: Session) -> User:
    """テスト用の学生を作成"""
    student = User(
        email="student@example.com",
        name="学生 花子",
        password_hash="hash_student",
        role=UserRole.student,
    )
    db_session.add(student)
    db_session.commit()
    return student


@pytest.fixture
def course(db_session: Session, teacher: User) -> Course:
    """テスト用の授業を作成"""
    course = Course(
        title="データ構造",
        description="データ構造とアルゴリズムについて学びます",
        teacher_id=teacher.id,
        theme="sky",
    )
    db_session.add(course)
    db_session.commit()
    return course


class TestGetCourseDetail:
    """GET /courses/{course_id} のテスト"""

    def test_get_course_detail_success(
        self,
        db_session: Session,
        course: Course,
        teacher: User,
    ) -> None:
        """正常系：授業詳細情報を取得できる"""
        result = get_course_detail(course.id, db_session, teacher)

        assert result.id == course.id
        assert result.title == "データ構造"
        assert result.description == "データ構造とアルゴリズムについて学びます"
        assert result.theme == "sky"
        assert result.teacher_id == teacher.id
        assert result.teacher_name == "先生 太郎"
        assert result.student_count == 0
        assert result.is_enrolled is False

    def test_get_course_detail_with_enrolled_students(
        self,
        db_session: Session,
        course: Course,
        teacher: User,
        student: User,
    ) -> None:
        """正常系：受講生がいる場合、student_countが正しく返される"""
        # 学生を授業に登録
        enrollment = CourseEnrollment(course_id=course.id, user_id=student.id)
        db_session.add(enrollment)
        db_session.commit()

        result = get_course_detail(course.id, db_session, teacher)

        assert result.student_count == 1
        assert result.is_enrolled is False

    def test_get_course_detail_when_current_user_enrolled(
        self,
        db_session: Session,
        course: Course,
        student: User,
    ) -> None:
        """正常系：ログインユーザーが受講している場合、is_enrolledがtrueになる"""
        # 学生を授業に登録
        enrollment = CourseEnrollment(course_id=course.id, user_id=student.id)
        db_session.add(enrollment)
        db_session.commit()

        result = get_course_detail(course.id, db_session, student)

        assert result.is_enrolled is True

    def test_get_course_detail_not_found(
        self,
        db_session: Session,
        teacher: User,
    ) -> None:
        """異常系：存在しない授業IDを指定した場合、404エラーが返される"""
        with pytest.raises(HTTPException) as exc_info:
            get_course_detail(uuid4(), db_session, teacher)

        assert exc_info.value.status_code == 404
        assert "Course not found" in exc_info.value.detail

    def test_get_course_detail_schema_excludes_reviewer_skill(
        self,
        db_session: Session,
        course: Course,
        teacher: User,
    ) -> None:
        """正常系：レスポンスにレビューワースキルが含まれていない"""
        result = get_course_detail(course.id, db_session, teacher)

        # CoursePublic スキーマに reviewer_skill 関連の属性がないことを確認
        schema_fields = type(result).model_fields.keys()
        assert "reviewer_skill" not in schema_fields
        assert "logic" not in schema_fields
        assert "specificity" not in schema_fields


class TestUnenrollCourse:
    """DELETE /courses/{course_id}/enroll のテスト"""

    def test_unenroll_course_success(
        self,
        db_session: Session,
        course: Course,
        student: User,
    ) -> None:
        """正常系：学生が受講を取り消せる"""
        # 学生を授業に登録
        enrollment = CourseEnrollment(course_id=course.id, user_id=student.id)
        db_session.add(enrollment)
        db_session.commit()

        # 受講を取り消し
        unenroll_course(course.id, db_session, student)

        # 登録が削除されていることを確認
        remaining = (
            db_session.query(CourseEnrollment)
            .filter(
                CourseEnrollment.course_id == course.id,
                CourseEnrollment.user_id == student.id,
            )
            .first()
        )
        assert remaining is None

    def test_unenroll_course_not_enrolled(
        self,
        db_session: Session,
        course: Course,
        student: User,
    ) -> None:
        """異常系：受講していない授業を取り消そうとした場合、404エラーが返される"""
        with pytest.raises(HTTPException) as exc_info:
            unenroll_course(course.id, db_session, student)

        assert exc_info.value.status_code == 404
        assert "Enrollment not found" in exc_info.value.detail

    def test_unenroll_course_teacher_forbidden(
        self,
        db_session: Session,
        course: Course,
        teacher: User,
    ) -> None:
        """異常系：教師が受講の取り消しを試した場合、403エラーが返される"""
        with pytest.raises(HTTPException) as exc_info:
            unenroll_course(course.id, db_session, teacher)

        assert exc_info.value.status_code == 403
        assert "Student role required" in exc_info.value.detail

    def test_unenroll_course_not_found(
        self,
        db_session: Session,
        student: User,
    ) -> None:
        """異常系：存在しない授業の受講を取り消そうとした場合、404エラーが返される"""
        with pytest.raises(HTTPException) as exc_info:
            unenroll_course(uuid4(), db_session, student)

        assert exc_info.value.status_code == 404
        assert "Enrollment not found" in exc_info.value.detail

    def test_unenroll_course_rejected_when_submission_exists(
        self,
        db_session: Session,
        course: Course,
        student: User,
    ) -> None:
        """異常系：提出済み課題がある場合は取り消しできない"""
        # 受講登録
        enrollment = CourseEnrollment(course_id=course.id, user_id=student.id)
        db_session.add(enrollment)
        db_session.commit()

        assignment = Assignment(course_id=course.id, title="課題1", description="", target_reviews_per_submission=2)
        db_session.add(assignment)
        db_session.commit()

        submission = Submission(
            assignment_id=assignment.id,
            author_id=student.id,
            file_type=SubmissionFileType.markdown,
            original_filename="report.md",
            storage_path="/tmp/report.md",
            markdown_text="# report",
        )
        db_session.add(submission)
        db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            unenroll_course(course.id, db_session, student)

        assert exc_info.value.status_code == 400
        assert "Cannot unenroll after submitting assignments" in exc_info.value.detail

    def test_unenroll_course_rejected_when_review_assignment_exists(
        self,
        db_session: Session,
        course: Course,
        student: User,
    ) -> None:
        """異常系：レビュー割り当てが残っている場合は取り消しできない"""
        # 受講登録
        enrollment = CourseEnrollment(course_id=course.id, user_id=student.id)
        db_session.add(enrollment)
        db_session.commit()

        assignment = Assignment(course_id=course.id, title="課題2", description="", target_reviews_per_submission=2)
        db_session.add(assignment)
        db_session.commit()

        # レビュー対象となる他者の提出物
        other_student = User(
            email="other@example.com",
            name="学生 次郎",
            password_hash="hash_other",
            role=UserRole.student,
        )
        db_session.add(other_student)
        db_session.commit()

        submission = Submission(
            assignment_id=assignment.id,
            author_id=other_student.id,
            file_type=SubmissionFileType.markdown,
            original_filename="other.md",
            storage_path="/tmp/other.md",
            markdown_text="# other",
        )
        db_session.add(submission)
        db_session.commit()

        review_assignment = ReviewAssignment(
            assignment_id=assignment.id,
            submission_id=submission.id,
            reviewer_id=student.id,
        )
        db_session.add(review_assignment)
        db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            unenroll_course(course.id, db_session, student)

        assert exc_info.value.status_code == 400
        assert "Cannot unenroll while review assignments remain" in exc_info.value.detail
