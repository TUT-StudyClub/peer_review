from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.review import Review, ReviewAssignment
from app.models.user import User
from app.schemas.user import ReviewerSkill, UserPublic
from app.services.auth import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    return current_user


@router.get("/me/reviewer-skill", response_model=ReviewerSkill)
def my_reviewer_skill(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewerSkill:
    reviews = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(ReviewAssignment.reviewer_id == current_user.id)
        .all()
    )

    def avg(values: list[int | None]) -> float:
        nums = [float(v) for v in values if v is not None]
        return (sum(nums) / len(nums)) if nums else 0.0

    return ReviewerSkill(
        logic=avg([r.ai_logic for r in reviews]),
        specificity=avg([r.ai_specificity for r in reviews]),
        empathy=avg([r.ai_empathy for r in reviews]),
        insight=avg([r.ai_insight for r in reviews]),
    )
