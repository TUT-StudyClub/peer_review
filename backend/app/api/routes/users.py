import enum
from collections import defaultdict
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.user import User
from app.schemas.user import ReviewerSkill
from app.schemas.user import UserPublic
from app.schemas.user import UserRankingEntry
from app.services.auth import get_current_user
from app.services.credits import calculate_review_credit_gain
from app.services.rank import get_user_rank
from app.services.reviewer_skill import calculate_reviewer_skill

router = APIRouter()
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)


class RankingPeriod(str, enum.Enum):
    total = "total"
    weekly = "weekly"
    monthly = "monthly"


def _period_start(period: RankingPeriod) -> datetime:
    now = datetime.now(UTC)
    if period == RankingPeriod.weekly:
        return now - timedelta(days=7)
    return now - timedelta(days=30)


@router.get("/me", response_model=UserPublic)
def me(
    current_user: User = current_user_dependency,
    db: Session = db_dependency,
) -> User:
    return current_user


@router.get("/ranking", response_model=list[UserRankingEntry])
def user_ranking(
    limit: int = 5,
    period: RankingPeriod = RankingPeriod.total,
    db: Session = db_dependency,
) -> list[UserRankingEntry]:
    safe_limit = max(1, min(limit, 50))
    if period == RankingPeriod.total:
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

    period_start = _period_start(period)
    rows = (
        db.query(Review, ReviewAssignment, User)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .join(User, User.id == ReviewAssignment.reviewer_id)
        .filter(Review.created_at >= period_start)
        .filter(User.credits >= settings.ta_qualification_threshold)
        .all()
    )

    credits_by_user = defaultdict(int)
    user_by_id = {}
    for review, review_assignment, user in rows:
        credit = calculate_review_credit_gain(
            db,
            review_assignment=review_assignment,
            review=review,
            reviewer=user,
        )
        credits_by_user[user.id] += credit.added
        user_by_id[user.id] = user

    ranked: list[tuple[int, datetime, UserRankingEntry]] = []
    for user_id, period_credits in credits_by_user.items():
        user = user_by_id[user_id]
        rank = get_user_rank(user.credits)
        ranked.append(
            (
                period_credits,
                user.created_at,
                UserRankingEntry(
                    id=user.id,
                    name=user.name,
                    credits=user.credits,
                    rank=rank.key,
                    title=rank.title,
                    is_ta=user.is_ta,
                    period_credits=period_credits,
                ),
            )
        )
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [entry for _, _, entry in ranked[:safe_limit]]


@router.get("/me/reviewer-skill", response_model=ReviewerSkill)
def my_reviewer_skill(
    assignment_id: UUID | None = None,
    current_user: User = current_user_dependency,
    db: Session = db_dependency,
) -> ReviewerSkill:
    return calculate_reviewer_skill(
        db,
        reviewer_id=current_user.id,
        assignment_id=assignment_id,
    )
