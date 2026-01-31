from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.user import User
from app.schemas.admin import AdminAssignmentUpdate
from app.schemas.admin import AdminUserPublic
from app.schemas.admin import AdminUserUpdate
from app.schemas.admin import ReviewerSkillOverride
from app.schemas.assignment import AssignmentPublic
from app.services.auth import require_admin
from app.services.credits import CREDIT_REASON_ADMIN_ADJUSTMENT
from app.services.credits import record_credit_history

router = APIRouter()
db_dependency = Depends(get_db)
admin_dependency = Depends(require_admin)


def _admin_user_public(user: User) -> AdminUserPublic:
    return AdminUserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        credits=user.credits,
        rank=user.rank,
        title=user.title,
        is_ta=user.is_ta,
        is_admin=user.is_admin,
        created_at=user.created_at,
        reviewer_skill_override=ReviewerSkillOverride(
            logic=user.reviewer_skill_override_logic,
            specificity=user.reviewer_skill_override_specificity,
            structure=user.reviewer_skill_override_structure,
            evidence=user.reviewer_skill_override_evidence,
            overall=user.reviewer_skill_override_overall,
        ),
    )


@router.get("/users", response_model=list[AdminUserPublic])
def list_users(
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = db_dependency,
    _admin: User = admin_dependency,
) -> list[AdminUserPublic]:
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    q = db.query(User)
    if query:
        like = f"%{query.strip()}%"
        q = q.filter(or_(User.email.ilike(like), User.name.ilike(like)))

    users = q.order_by(User.created_at.desc()).offset(safe_offset).limit(safe_limit).all()
    return [_admin_user_public(user) for user in users]


@router.patch("/users/{user_id}", response_model=AdminUserPublic)
def update_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    db: Session = db_dependency,
    _admin: User = admin_dependency,
) -> AdminUserPublic:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    fields = payload.model_fields_set

    if "email" in fields and payload.email is not None:
        if payload.email != user.email:
            exists = db.query(User).filter(User.email == payload.email).first()
            if exists:
                raise HTTPException(status_code=409, detail="Email already exists")
            user.email = payload.email

    if "name" in fields and payload.name is not None:
        user.name = payload.name

    if "role" in fields and payload.role is not None:
        user.role = payload.role

    if "credits" in fields and payload.credits is not None:
        next_credits = max(0, int(payload.credits))
        if next_credits != user.credits:
            delta = next_credits - user.credits
            user.credits = next_credits
            record_credit_history(
                db,
                user=user,
                delta=delta,
                total_credits=next_credits,
                reason=CREDIT_REASON_ADMIN_ADJUSTMENT,
            )

    if "reviewer_skill_override_logic" in fields:
        user.reviewer_skill_override_logic = payload.reviewer_skill_override_logic
    if "reviewer_skill_override_specificity" in fields:
        user.reviewer_skill_override_specificity = payload.reviewer_skill_override_specificity
    if "reviewer_skill_override_structure" in fields:
        user.reviewer_skill_override_structure = payload.reviewer_skill_override_structure
    if "reviewer_skill_override_evidence" in fields:
        user.reviewer_skill_override_evidence = payload.reviewer_skill_override_evidence
    if "reviewer_skill_override_overall" in fields:
        user.reviewer_skill_override_overall = payload.reviewer_skill_override_overall

    db.add(user)
    db.commit()
    db.refresh(user)
    return _admin_user_public(user)


@router.get("/assignments", response_model=list[AssignmentPublic])
def list_assignments(
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = db_dependency,
    _admin: User = admin_dependency,
) -> list[Assignment]:
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    q = db.query(Assignment)
    if query:
        like = f"%{query.strip()}%"
        q = q.filter(Assignment.title.ilike(like))

    return q.order_by(Assignment.created_at.desc()).offset(safe_offset).limit(safe_limit).all()


@router.patch("/assignments/{assignment_id}", response_model=AssignmentPublic)
def update_assignment(
    assignment_id: UUID,
    payload: AdminAssignmentUpdate,
    db: Session = db_dependency,
    _admin: User = admin_dependency,
) -> Assignment:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    fields = payload.model_fields_set

    if "title" in fields and payload.title is not None:
        assignment.title = payload.title
    if "description" in fields:
        assignment.description = payload.description
    if "target_reviews_per_submission" in fields and payload.target_reviews_per_submission is not None:
        assignment.target_reviews_per_submission = payload.target_reviews_per_submission
    if "due_at" in fields:
        assignment.due_at = payload.due_at

    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment
