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
from app.db.base import Base
from app.models.course import Course
from app.models.course import CourseEnrollment
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
