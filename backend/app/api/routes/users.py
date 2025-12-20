from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.review import Review, ReviewAssignment
from app.models.user import User
from app.schemas.user import ReviewerSkill, UserPublic, UserRankingEntry
from app.services.auth import get_current_user
from app.services.rank import get_user_rank

router = APIRouter()


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    return current_user


@router.get("/ranking", response_model=list[UserRankingEntry])
def user_ranking(limit: int = 5, db: Session = Depends(get_db)) -> list[UserRankingEntry]:
    safe_limit = max(1, min(limit, 50))
    users = (
        db.query(User)
        .filter(User.credits >= settings.ta_qualification_threshold)
        .order_by(User.credits.desc(), User.created_at.asc())
        .limit(safe_limit)
        .all()
    )

    results: list[UserRankingEntry] = []
    for u in users:
        rank = get_user_rank(u.credits)
        results.append(
            UserRankingEntry(
                id=u.id,
                name=u.name,
                credits=u.credits,
                rank=rank.key,
                title=rank.title,
                is_ta=u.is_ta,
            )
        )
    return results


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
