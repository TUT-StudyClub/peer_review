from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models.assignment import Assignment, RubricCriterion
from app.schemas.assignment import AssignmentCreate, AssignmentPublic, RubricCriterionCreate, RubricCriterionPublic
from app.services.auth import require_teacher

router = APIRouter()


@router.post("", response_model=AssignmentPublic)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    _teacher=Depends(require_teacher),
) -> Assignment:
    assignment = Assignment(
        title=payload.title,
        description=payload.description,
        target_reviews_per_submission=payload.target_reviews_per_submission,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentPublic])
def list_assignments(db: Session = Depends(get_db)) -> list[Assignment]:
    return db.query(Assignment).order_by(Assignment.created_at.desc()).all()


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

