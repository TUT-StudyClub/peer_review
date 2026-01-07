from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import REVIEWER_SKILL_TEMPLATE
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.assignment import RubricCriterion
from app.models.course import Course
from app.models.submission import Submission
from app.schemas.assignment import AssignmentCreate
from app.schemas.assignment import AssignmentPublic
from app.schemas.assignment import RubricCriterionCreate
from app.schemas.assignment import RubricCriterionPublic
from app.schemas.submission import SubmissionTeacherPublic
from app.services.auth import require_teacher
from app.services.rubric import ensure_fixed_rubric

router = APIRouter()
db_dependency = Depends(get_db)
teacher_dependency = Depends(require_teacher)


@router.post("", response_model=AssignmentPublic)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = db_dependency,
    _teacher=teacher_dependency,
) -> Assignment:
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != _teacher.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    assignment = Assignment(
        title=payload.title,
        course_id=payload.course_id,
        description=payload.description,
        target_reviews_per_submission=payload.target_reviews_per_submission,
        due_at=payload.due_at,
    )
    db.add(assignment)
    db.flush()
    ensure_fixed_rubric(db, assignment.id)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentPublic])
def list_assignments(
    course_id: UUID | None = None,
    db: Session = db_dependency,
) -> list[Assignment]:
    query = db.query(Assignment)
    if course_id is not None:
        query = query.filter(Assignment.course_id == course_id)
    return query.order_by(Assignment.created_at.desc()).all()


@router.post("/{assignment_id}/rubric", response_model=RubricCriterionPublic)
def add_rubric_criterion(
    assignment_id: UUID,
    payload: RubricCriterionCreate,
    db: Session = db_dependency,
    _teacher=teacher_dependency,
) -> RubricCriterion:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    template_by_name = {item["name"]: item for item in REVIEWER_SKILL_TEMPLATE}
    template = template_by_name.get(payload.name)
    if template is None:
        allowed = ", ".join(template_by_name.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Rubric name must be one of: {allowed}",
        )

    criterion = RubricCriterion(
        assignment_id=assignment_id,
        name=template["name"],
        description=payload.description if payload.description is not None else template["description"],
        max_score=template["max_score"],
        order_index=template["order_index"],
    )
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.get("/{assignment_id}/rubric", response_model=list[RubricCriterionPublic])
def list_rubric_criteria(
    assignment_id: UUID,
    db: Session = db_dependency,
) -> list[RubricCriterion]:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return ensure_fixed_rubric(db, assignment_id)


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionTeacherPublic])
def list_submissions_for_assignment(
    assignment_id: UUID,
    db: Session = db_dependency,
    _teacher=teacher_dependency,
) -> list[Submission]:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id)
        .order_by(Submission.created_at.desc())
        .all()
    )
