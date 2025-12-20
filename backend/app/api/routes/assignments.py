from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.assignment import Assignment, RubricCriterion
from app.models.course import Course
from app.models.submission import Submission
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentPublic,
    RubricCriterionCreate,
    RubricCriterionPublic,
)
from app.schemas.submission import SubmissionTeacherPublic
from app.services.auth import require_teacher

router = APIRouter()


@router.post("", response_model=AssignmentPublic)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    _teacher=Depends(require_teacher),
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
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentPublic])
def list_assignments(
    course_id: UUID | None = None,
    db: Session = Depends(get_db),
) -> list[Assignment]:
    query = db.query(Assignment)
    if course_id is not None:
        query = query.filter(Assignment.course_id == course_id)
    return query.order_by(Assignment.created_at.desc()).all()


@router.post("/{assignment_id}/rubric", response_model=RubricCriterionPublic)
def add_rubric_criterion(
    assignment_id: UUID,
    payload: RubricCriterionCreate,
    db: Session = Depends(get_db),
    _teacher=Depends(require_teacher),
) -> RubricCriterion:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    criterion = RubricCriterion(
        assignment_id=assignment_id,
        name=payload.name,
        description=payload.description,
        max_score=payload.max_score,
        order_index=payload.order_index,
    )
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.get("/{assignment_id}/rubric", response_model=list[RubricCriterionPublic])
def list_rubric_criteria(assignment_id: UUID, db: Session = Depends(get_db)) -> list[RubricCriterion]:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return (
        db.query(RubricCriterion)
        .filter(RubricCriterion.assignment_id == assignment_id)
        .order_by(RubricCriterion.order_index.asc())
        .all()
    )


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionTeacherPublic])
def list_submissions_for_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    _teacher=Depends(require_teacher),
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
