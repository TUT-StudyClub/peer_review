import enum
from collections import defaultdict
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.credit_history import CreditHistory
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.user import User
from app.schemas.user import CreditHistoryPublic
from app.schemas.user import ReviewerSkill
from app.schemas.user import UserPublic
from app.schemas.user import UserRankingEntry
from app.services.auth import get_current_user
from app.services.credits import calculate_review_credit_gain
from app.services.rank import get_user_rank
from app.services.reviewer_skill import calculate_reviewer_skill
from app.services.storage import build_download_response
from app.services.storage import delete_storage_path
from app.services.storage import save_avatar_file

router = APIRouter()
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)
avatar_file_dependency = File(...)


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


@router.get("/me/credit-history", response_model=list[CreditHistoryPublic])
def my_credit_history(
    limit: int = 50,
    current_user: User = current_user_dependency,
    db: Session = db_dependency,
) -> list[CreditHistory]:
    safe_limit = max(1, min(limit, 200))
    return (
        db.query(CreditHistory)
        .filter(CreditHistory.user_id == current_user.id)
        .order_by(CreditHistory.created_at.desc())
        .limit(safe_limit)
        .all()
    )


@router.post("/me/avatar", response_model=UserPublic)
def upload_avatar(
    file: UploadFile = avatar_file_dependency,
    current_user: User = current_user_dependency,
    db: Session = db_dependency,
) -> User:
    stored, content_type = save_avatar_file(upload=file, user_id=current_user.id)
    old_path = current_user.avatar_path
    current_user.avatar_path = stored.storage_path
    current_user.avatar_content_type = content_type

    try:
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        delete_storage_path(stored.storage_path)
        raise
    finally:
        stored.cleanup()

    if old_path and old_path != stored.storage_path:
        delete_storage_path(old_path)
    return current_user


@router.delete("/me/avatar", response_model=UserPublic)
def delete_avatar(
    current_user: User = current_user_dependency,
    db: Session = db_dependency,
) -> User:
    old_path = current_user.avatar_path
    current_user.avatar_path = None
    current_user.avatar_content_type = None

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    if old_path:
        delete_storage_path(old_path)
    return current_user


@router.get("/{user_id}/avatar")
def get_avatar(
    user_id: UUID,
    db: Session = db_dependency,
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.avatar_path:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return build_download_response(
        storage_path=user.avatar_path,
        filename="avatar",
        media_type=user.avatar_content_type or "application/octet-stream",
    )


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
