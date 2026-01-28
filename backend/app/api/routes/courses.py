from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import COURSE_TITLE_CANDIDATES
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.course import CourseEnrollment
from app.models.review import ReviewAssignment
from app.models.submission import Submission
from app.models.user import User
from app.models.user import UserRole
from app.schemas.course import CourseCreate
from app.schemas.course import CourseEnrollmentPublic
from app.schemas.course import CoursePublic
from app.schemas.user import UserPublic
from app.services.auth import get_current_user
from app.services.auth import require_teacher

router = APIRouter()
COURSE_THEME_OPTIONS = {"sky", "emerald", "amber", "rose", "slate", "violet"}
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)
teacher_dependency = Depends(require_teacher)


@router.post("", response_model=CoursePublic)
def create_course(
    payload: CourseCreate,
    db: Session = db_dependency,
    current_user: User = teacher_dependency,
) -> CoursePublic:
    if payload.title not in COURSE_TITLE_CANDIDATES:
        raise HTTPException(status_code=400, detail="Course title is not allowed")

    if payload.theme and payload.theme not in COURSE_THEME_OPTIONS:
        raise HTTPException(status_code=400, detail="Course theme is not allowed")

    existing_course = (
        db.query(Course).filter(Course.teacher_id == current_user.id, Course.title == payload.title).first()
    )
    if existing_course:
        raise HTTPException(status_code=400, detail="同じ授業名の授業はすでに作成されています")

    course = Course(
        title=payload.title,
        description=payload.description,
        teacher_id=current_user.id,
        theme=payload.theme or "sky",
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return CoursePublic(
        id=course.id,
        title=course.title,
        description=course.description,
        theme=course.theme,
        teacher_id=course.teacher_id,
        created_at=course.created_at,
        teacher_name=current_user.name,
        student_count=0,
    )


@router.get("", response_model=list[CoursePublic])
def list_courses(
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> list[CoursePublic]:
    if current_user.role == UserRole.teacher:
        courses = db.query(Course).filter(Course.teacher_id == current_user.id).order_by(Course.created_at.desc()).all()
        counts: dict[UUID, int] = {}
        if courses:
            rows = (
                db.query(CourseEnrollment.course_id, func.count(CourseEnrollment.id))
                .filter(CourseEnrollment.course_id.in_([c.id for c in courses]))
                .group_by(CourseEnrollment.course_id)
                .all()
            )
            counts = {course_id: count for course_id, count in rows}

        return [
            CoursePublic(
                id=course.id,
                title=course.title,
                description=course.description,
                theme=course.theme,
                teacher_id=course.teacher_id,
                created_at=course.created_at,
                teacher_name=current_user.name,
                student_count=counts.get(course.id, 0),
            )
            for course in courses
        ]

    courses = db.query(Course).order_by(Course.created_at.desc()).all()
    enrolled_ids = {
        row[0] for row in db.query(CourseEnrollment.course_id).filter(CourseEnrollment.user_id == current_user.id).all()
    }
    return [
        CoursePublic(
            id=course.id,
            title=course.title,
            description=course.description,
            theme=course.theme,
            teacher_id=course.teacher_id,
            created_at=course.created_at,
            teacher_name=course.teacher.name if course.teacher else None,
            is_enrolled=course.id in enrolled_ids,
        )
        for course in courses
    ]


@router.get("/{course_id}", response_model=CoursePublic)
def get_course_detail(
    course_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> CoursePublic:
    """講義の詳細情報を取得（講師名、受講生数、ユーザーの登録状況を含む）"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    # 受講生数を取得
    student_count_result = (
        db.query(func.count(CourseEnrollment.id)).filter(CourseEnrollment.course_id == course_id).one()
    )
    student_count: int = student_count_result[0] if student_count_result else 0

    # ユーザーが登録しているかチェック
    is_enrolled = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.user_id == current_user.id,
        )
        .first()
        is not None
    )

    return CoursePublic(
        id=course.id,
        title=course.title,
        description=course.description,
        theme=course.theme,
        teacher_id=course.teacher_id,
        created_at=course.created_at,
        teacher_name=course.teacher.name if course.teacher else None,
        is_enrolled=is_enrolled,
        student_count=student_count,
    )


@router.post("/{course_id}/enroll", response_model=CourseEnrollmentPublic)
def enroll_course(
    course_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> CourseEnrollment:
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Student role required")
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.course_id == course_id, CourseEnrollment.user_id == current_user.id)
        .first()
    )
    if existing is not None:
        return existing

    enrollment = CourseEnrollment(course_id=course_id, user_id=current_user.id)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.delete("/{course_id}/enroll", status_code=204)
def unenroll_course(
    course_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> None:
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Student role required")

    # 既に提出済みの課題がある場合は受講取り消し不可
    has_submissions = (
        db.query(Submission.id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .filter(Assignment.course_id == course_id, Submission.author_id == current_user.id)
        .first()
    )
    if has_submissions:
        raise HTTPException(status_code=400, detail="Cannot unenroll after submitting assignments")

    # レビュー割り当てが残っている場合は受講取り消し不可
    has_review_assignments = (
        db.query(ReviewAssignment.id)
        .join(Assignment, Assignment.id == ReviewAssignment.assignment_id)
        .filter(Assignment.course_id == course_id, ReviewAssignment.reviewer_id == current_user.id)
        .first()
    )
    if has_review_assignments:
        raise HTTPException(status_code=400, detail="Cannot unenroll while review assignments remain")

    enrollment = (
        db.query(CourseEnrollment)
        .filter(CourseEnrollment.course_id == course_id, CourseEnrollment.user_id == current_user.id)
        .first()
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.delete(enrollment)
    db.commit()


@router.get("/{course_id}/students", response_model=list[UserPublic])
def list_course_students(
    course_id: UUID,
    db: Session = db_dependency,
    current_user: User = teacher_dependency,
) -> list[User]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    return (
        db.query(User)
        .join(CourseEnrollment, CourseEnrollment.user_id == User.id)
        .filter(CourseEnrollment.course_id == course_id)
        .filter(User.role == UserRole.student)
        .order_by(User.created_at.asc())
        .all()
    )
