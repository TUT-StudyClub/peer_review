import enum
from collections import defaultdict
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import Query
from fastapi import UploadFile
from sqlalchemy import desc
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.course import Course
from app.models.course import CourseEnrollment
from app.models.credit_history import CreditHistory
from app.models.review import MetaReview
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.user import User
from app.schemas.user import AverageSeriesPoint
from app.schemas.user import CreditHistoryPublic
from app.schemas.user import MetricHistoryPoint
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


class RankingMetric(str, enum.Enum):
    credits = "credits"
    review_count = "review_count"
    average_score = "average_score"
    helpful_reviews = "helpful_reviews"


def _period_start(period: RankingPeriod) -> datetime:
    now = datetime.now(UTC)
    if period == RankingPeriod.weekly:
        return now - timedelta(days=7)
    return now - timedelta(days=30)


def _fetch_review_counts(
    user_ids: list[UUID],
    period_start: datetime | None,
    db: Session,
) -> dict[UUID, int]:
    if not user_ids:
        return {}

    rows = (
        db.query(ReviewAssignment.reviewer_id, func.count(Review.id).label("review_count"))
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .filter(ReviewAssignment.reviewer_id.in_(user_ids))
    )
    if period_start:
        rows = rows.filter(Review.created_at >= period_start)

    rows = rows.group_by(ReviewAssignment.reviewer_id).all()
    return {row[0]: int(row[1]) for row in rows}


def _fetch_average_scores(
    user_ids: list[UUID],
    period_start: datetime | None,
    db: Session,
) -> dict[UUID, float | None]:
    if not user_ids:
        return {}

    rows = (
        db.query(ReviewAssignment.reviewer_id, func.avg(Review.ai_quality_score).label("average_score"))
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .filter(ReviewAssignment.reviewer_id.in_(user_ids))
        .filter(Review.ai_quality_score.isnot(None))
    )
    if period_start:
        rows = rows.filter(Review.created_at >= period_start)

    rows = rows.group_by(ReviewAssignment.reviewer_id).all()
    return {row[0]: float(row[1]) if row[1] is not None else None for row in rows}


def _fetch_latest_course_titles(
    user_ids: list[UUID],
    period_start: datetime | None,
    db: Session,
) -> dict[UUID, str | None]:
    if not user_ids:
        return {}

    rows = (
        db.query(ReviewAssignment.reviewer_id, Review.created_at, Course.title)
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .join(Assignment, Assignment.id == ReviewAssignment.assignment_id)
        .outerjoin(Course, Course.id == Assignment.course_id)
        .filter(ReviewAssignment.reviewer_id.in_(user_ids))
    )
    if period_start:
        rows = rows.filter(Review.created_at >= period_start)

    rows = rows.order_by(Review.created_at.desc()).all()
    latest: dict[UUID, str | None] = {}
    for reviewer_id, _created_at, title in rows:
        if reviewer_id in latest:
            continue
        latest[reviewer_id] = title
    return latest


def _fetch_course_titles(
    user_ids: list[UUID],
    period_start: datetime | None,
    db: Session,
) -> dict[UUID, list[str]]:
    if not user_ids:
        return {}

    rows = (
        db.query(ReviewAssignment.reviewer_id, Course.title)
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .join(Assignment, Assignment.id == ReviewAssignment.assignment_id)
        .outerjoin(Course, Course.id == Assignment.course_id)
        .filter(ReviewAssignment.reviewer_id.in_(user_ids))
    )
    if period_start:
        rows = rows.filter(Review.created_at >= period_start)

    rows = rows.order_by(Review.created_at.desc()).all()
    grouped: dict[UUID, list[str]] = defaultdict(list)
    for reviewer_id, title in rows:
        if not title:
            continue
        if title in grouped[reviewer_id]:
            continue
        grouped[reviewer_id].append(title)
    return grouped


def _attach_ranking_extras(
    entries: list[UserRankingEntry],
    period: RankingPeriod,
    db: Session,
) -> None:
    if not entries:
        return

    user_ids = [entry.id for entry in entries]
    period_start = _period_start(period) if period != RankingPeriod.total else None

    review_counts = _fetch_review_counts(user_ids, period_start, db)
    average_scores = _fetch_average_scores(user_ids, period_start, db)
    latest_courses = _fetch_latest_course_titles(user_ids, period_start, db)
    course_titles = _fetch_course_titles(user_ids, period_start, db)

    for entry in entries:
        if entry.review_count is None:
            entry.review_count = review_counts.get(entry.id, 0)
        if entry.average_score is None:
            entry.average_score = average_scores.get(entry.id)
        entry.target_course_title = latest_courses.get(entry.id)
        entry.target_course_titles = course_titles.get(entry.id, [])


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


@router.get("/credit-history", response_model=list[CreditHistoryPublic])
def users_credit_history(
    user_ids: Annotated[list[UUID], Query()],
    limit: int = 50,
    current_user: User = current_user_dependency,
    db: Session = db_dependency,
) -> list[CreditHistory]:
    safe_limit = max(1, min(limit, 200))
    safe_user_ids = list(dict.fromkeys(user_ids))[:20]
    if not safe_user_ids:
        raise HTTPException(status_code=400, detail="user_ids is required")

    histories: list[CreditHistory] = []
    for user_id in safe_user_ids:
        rows = (
            db.query(CreditHistory)
            .filter(CreditHistory.user_id == user_id)
            .order_by(CreditHistory.created_at.desc())
            .limit(safe_limit)
            .all()
        )
        histories.extend(rows)

    return histories


@router.get("/average-score-history", response_model=list[MetricHistoryPoint])
def users_average_score_history(
    user_ids: Annotated[list[UUID], Query()],
    period: RankingPeriod = RankingPeriod.total,
    db: Session = db_dependency,
) -> list[MetricHistoryPoint]:
    safe_user_ids = list(dict.fromkeys(user_ids))[:20]
    if not safe_user_ids:
        raise HTTPException(status_code=400, detail="user_ids is required")

    period_start = _period_start(period) if period != RankingPeriod.total else None
    rows = (
        db.query(Review, ReviewAssignment, User)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .join(User, User.id == ReviewAssignment.reviewer_id)
        .filter(User.id.in_(safe_user_ids))
        .filter(Review.ai_quality_score.isnot(None))
    )
    if period_start:
        rows = rows.filter(Review.created_at >= period_start)

    rows = rows.all()

    grouped: dict[tuple[UUID, datetime], list[float]] = {}
    for review, _, user in rows:
        created = review.created_at.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        key = (user.id, created)
        grouped.setdefault(key, []).append(float(review.ai_quality_score or 0))

    points: list[MetricHistoryPoint] = []
    for (user_id, created_at), values in grouped.items():
        avg = sum(values) / max(len(values), 1)
        points.append(MetricHistoryPoint(user_id=user_id, value=avg, created_at=created_at))

    points.sort(key=lambda item: (item.user_id, item.created_at))
    return points


def _calculate_credits_average(period: RankingPeriod, enrolled_ids: list[UUID], db: Session) -> float:
    """creditsメトリクスの平均値を計算"""
    period_start = _period_start(period) if period != RankingPeriod.total else None

    if period == RankingPeriod.total:
        avg = db.query(func.avg(User.credits)).filter(User.id.in_(enrolled_ids)).scalar()
        return float(avg or 0)

    rows = (
        db.query(Review, ReviewAssignment, User)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .join(User, User.id == ReviewAssignment.reviewer_id)
        .filter(User.id.in_(enrolled_ids))
    )
    if period_start:
        rows = rows.filter(Review.created_at >= period_start)

    credits_by_user = defaultdict(int)
    for review, review_assignment, user in rows.all():
        credit = calculate_review_credit_gain(
            db,
            review_assignment=review_assignment,
            review=review,
            reviewer=user,
        )
        credits_by_user[user.id] += credit.added

    total = sum(credits_by_user.get(user_id, 0) for user_id in enrolled_ids)
    return float(total / max(len(enrolled_ids), 1))


def _calculate_metric_average(
    metric: RankingMetric, period: RankingPeriod, enrolled_ids: list[UUID], db: Session
) -> float:
    """メトリクスの平均値を計算（credits以外）"""
    period_start = _period_start(period) if period != RankingPeriod.total else None

    if metric == RankingMetric.review_count:
        rows = (
            db.query(ReviewAssignment.reviewer_id, func.count(Review.id).label("review_count"))
            .join(Review, Review.review_assignment_id == ReviewAssignment.id)
            .filter(ReviewAssignment.reviewer_id.in_(enrolled_ids))
        )
        if period_start:
            rows = rows.filter(Review.created_at >= period_start)
        rows = rows.group_by(ReviewAssignment.reviewer_id).all()
        counts = {row[0]: int(row[1]) for row in rows}
        total = sum(counts.get(user_id, 0) for user_id in enrolled_ids)
        return float(total / max(len(enrolled_ids), 1))

    if metric == RankingMetric.average_score:
        rows = (
            db.query(ReviewAssignment.reviewer_id, func.avg(Review.ai_quality_score).label("avg_score"))
            .join(Review, Review.review_assignment_id == ReviewAssignment.id)
            .filter(ReviewAssignment.reviewer_id.in_(enrolled_ids))
            .filter(Review.ai_quality_score.isnot(None))
        )
        if period_start:
            rows = rows.filter(Review.created_at >= period_start)
        rows = rows.group_by(ReviewAssignment.reviewer_id).all()
        averages = [float(row[1]) for row in rows if row[1] is not None]
        if not averages:
            return 0.0
        return float(sum(averages) / max(len(averages), 1))

    # helpful_reviews
    rows = (
        db.query(ReviewAssignment.reviewer_id, func.count(MetaReview.id).label("helpful_reviews"))
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .join(MetaReview, MetaReview.review_id == Review.id)
        .filter(ReviewAssignment.reviewer_id.in_(enrolled_ids))
        .filter(MetaReview.helpfulness >= 4)
    )
    if period_start:
        rows = rows.filter(MetaReview.created_at >= period_start)
    rows = rows.group_by(ReviewAssignment.reviewer_id).all()
    counts = {row[0]: int(row[1]) for row in rows}
    total = sum(counts.get(user_id, 0) for user_id in enrolled_ids)
    return float(total / max(len(enrolled_ids), 1))


@router.get("/metric-average")
def metric_average(
    metric: RankingMetric = RankingMetric.credits,
    period: RankingPeriod = RankingPeriod.total,
    db: Session = db_dependency,
) -> dict[str, float]:
    enrolled_ids = [row[0] for row in db.query(CourseEnrollment.user_id).distinct().all()]
    if not enrolled_ids:
        return {"average": 0.0}

    if metric == RankingMetric.credits:
        avg = _calculate_credits_average(period, enrolled_ids, db)
        return {"average": avg}

    avg = _calculate_metric_average(metric, period, enrolled_ids, db)
    return {"average": avg}


@router.get("/average-credit-series", response_model=list[AverageSeriesPoint])
def average_credit_series(
    period: RankingPeriod = RankingPeriod.total,
    db: Session = db_dependency,
) -> list[AverageSeriesPoint]:
    enrolled_ids = [row[0] for row in db.query(CourseEnrollment.user_id).distinct().all()]
    if not enrolled_ids:
        return []

    rows = (
        db.query(CreditHistory)
        .filter(CreditHistory.user_id.in_(enrolled_ids))
        .order_by(CreditHistory.created_at.asc())
        .all()
    )
    if not rows:
        return []

    date_to_user_total: dict[datetime, dict[UUID, int]] = defaultdict(dict)
    for row in rows:
        created = row.created_at.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        date_to_user_total[created][row.user_id] = row.total_credits

    all_dates = sorted(date_to_user_total.keys())
    if not all_dates:
        return []

    start = (
        _period_start(period).replace(hour=0, minute=0, second=0, microsecond=0)
        if period != RankingPeriod.total
        else min(all_dates)
    )
    end = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    if start > end:
        return []

    baseline: dict[UUID, int] = {user_id: 0 for user_id in enrolled_ids}
    if period != RankingPeriod.total:
        for row in rows:
            if row.created_at >= start:
                break
            baseline[row.user_id] = row.total_credits

    running: dict[UUID, int] = {user_id: baseline[user_id] for user_id in enrolled_ids}
    points: list[AverageSeriesPoint] = []
    cursor = start
    while cursor <= end:
        updates = date_to_user_total.get(cursor, {})
        for user_id, total in updates.items():
            running[user_id] = total
        if period == RankingPeriod.total:
            avg = sum(running.values()) / max(len(enrolled_ids), 1)
        else:
            avg = sum(running[user_id] - baseline[user_id] for user_id in enrolled_ids) / max(len(enrolled_ids), 1)
        points.append(AverageSeriesPoint(created_at=cursor, value=float(avg)))
        cursor += timedelta(days=1)

    return points


def _compute_count_series(
    enrolled_ids: list[UUID],
    rows: list[tuple],
    start: datetime | None,
    end: datetime,
    use_meta: bool = False,
) -> list[AverageSeriesPoint]:
    """カウント系メトリクスの時系列データを計算"""
    date_to_counts: dict[datetime, dict[UUID, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        if use_meta:
            _review, assignment, meta = row
            created = meta.created_at.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            review, assignment = row
            created = review.created_at.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        date_to_counts[created][assignment.reviewer_id] += 1

    if not date_to_counts:
        return []

    start = start or min(date_to_counts.keys())
    if start > end:
        return []

    running: dict[UUID, int] = {user_id: 0 for user_id in enrolled_ids}
    points: list[AverageSeriesPoint] = []
    cursor = start
    while cursor <= end:
        updates = date_to_counts.get(cursor, {})
        for user_id, count in updates.items():
            running[user_id] += count
        avg = sum(running.values()) / max(len(enrolled_ids), 1)
        points.append(AverageSeriesPoint(created_at=cursor, value=float(avg)))
        cursor += timedelta(days=1)
    return points


def _compute_score_series(
    enrolled_ids: list[UUID],
    rows: list[tuple],
    start: datetime | None,
    end: datetime,
) -> list[AverageSeriesPoint]:
    """スコア系メトリクスの時系列データを計算"""
    date_to_scores: dict[datetime, dict[UUID, list[float]]] = defaultdict(lambda: defaultdict(list))
    for review, assignment in rows:
        created = review.created_at.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        date_to_scores[created][assignment.reviewer_id].append(float(review.ai_quality_score or 0))

    if not date_to_scores:
        return []

    start = start or min(date_to_scores.keys())
    if start > end:
        return []

    running_sum: dict[UUID, float] = {user_id: 0.0 for user_id in enrolled_ids}
    running_count: dict[UUID, int] = {user_id: 0 for user_id in enrolled_ids}
    points: list[AverageSeriesPoint] = []
    cursor = start
    while cursor <= end:
        updates = date_to_scores.get(cursor, {})
        for user_id, scores in updates.items():
            running_sum[user_id] += sum(scores)
            running_count[user_id] += len(scores)
        averages = [
            (running_sum[user_id] / running_count[user_id]) if running_count[user_id] else 0.0
            for user_id in enrolled_ids
        ]
        avg = sum(averages) / max(len(enrolled_ids), 1)
        points.append(AverageSeriesPoint(created_at=cursor, value=float(avg)))
        cursor += timedelta(days=1)
    return points


@router.get("/metric-average-series", response_model=list[AverageSeriesPoint])
def metric_average_series(
    metric: RankingMetric = RankingMetric.credits,
    period: RankingPeriod = RankingPeriod.total,
    db: Session = db_dependency,
) -> list[AverageSeriesPoint]:
    if metric == RankingMetric.credits:
        return average_credit_series(period=period, db=db)

    enrolled_ids = [row[0] for row in db.query(CourseEnrollment.user_id).distinct().all()]
    if not enrolled_ids:
        return []

    start = (
        _period_start(period).replace(hour=0, minute=0, second=0, microsecond=0)
        if period != RankingPeriod.total
        else None
    )
    end = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

    if metric == RankingMetric.review_count:
        rows = (
            db.query(Review, ReviewAssignment)
            .join(ReviewAssignment, Review.review_assignment_id == ReviewAssignment.id)
            .filter(ReviewAssignment.reviewer_id.in_(enrolled_ids))
            .order_by(Review.created_at.asc())
            .all()
        )
        return _compute_count_series(enrolled_ids, rows, start, end)

    if metric == RankingMetric.helpful_reviews:
        rows = (
            db.query(Review, ReviewAssignment, MetaReview)
            .join(ReviewAssignment, Review.review_assignment_id == ReviewAssignment.id)
            .join(MetaReview, MetaReview.review_id == Review.id)
            .filter(ReviewAssignment.reviewer_id.in_(enrolled_ids))
            .filter(MetaReview.helpfulness >= 4)
            .order_by(MetaReview.created_at.asc())
            .all()
        )
        return _compute_count_series(enrolled_ids, rows, start, end, use_meta=True)

    if metric == RankingMetric.average_score:
        rows = (
            db.query(Review, ReviewAssignment)
            .join(ReviewAssignment, Review.review_assignment_id == ReviewAssignment.id)
            .filter(ReviewAssignment.reviewer_id.in_(enrolled_ids))
            .filter(Review.ai_quality_score.isnot(None))
            .order_by(Review.created_at.asc())
            .all()
        )
        return _compute_score_series(enrolled_ids, rows, start, end)

    return []


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
    metric: RankingMetric = RankingMetric.credits,
    db: Session = db_dependency,
) -> list[UserRankingEntry]:
    safe_limit = max(1, min(limit, 50))
    if metric == RankingMetric.credits and period == RankingPeriod.total:
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
        _attach_ranking_extras(results, period, db)
        return results

    period_start = _period_start(period) if period != RankingPeriod.total else None

    if metric == RankingMetric.credits:
        rows = (
            db.query(Review, ReviewAssignment, User)
            .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
            .join(User, User.id == ReviewAssignment.reviewer_id)
            .filter(User.credits >= settings.ta_qualification_threshold)
        )
        if period_start:
            rows = rows.filter(Review.created_at >= period_start)

        credits_by_user = defaultdict(int)
        user_by_id = {}
        for review, review_assignment, user in rows.all():
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
        results = [entry for _, _, entry in ranked[:safe_limit]]
        _attach_ranking_extras(results, period, db)
        return results

    if metric == RankingMetric.review_count:
        rows = (
            db.query(
                User,
                func.count(Review.id).label("review_count"),
            )
            .join(ReviewAssignment, ReviewAssignment.reviewer_id == User.id)
            .join(Review, Review.review_assignment_id == ReviewAssignment.id)
            .filter(User.credits >= settings.ta_qualification_threshold)
        )
        if period_start:
            rows = rows.filter(Review.created_at >= period_start)

        rows = rows.group_by(User.id).order_by(desc("review_count"), User.created_at.asc()).limit(safe_limit).all()

        results: list[UserRankingEntry] = []
        for user, review_count in rows:
            rank = get_user_rank(user.credits)
            results.append(
                UserRankingEntry.model_validate(
                    {
                        "id": user.id,
                        "name": user.name,
                        "credits": user.credits,
                        "rank": rank.key,
                        "title": rank.title,
                        "is_ta": user.is_ta,
                        "review_count": int(review_count),
                    }
                )
            )
        _attach_ranking_extras(results, period, db)
        return results

    if metric == RankingMetric.average_score:
        rows = (
            db.query(
                User,
                func.avg(Review.ai_quality_score).label("average_score"),
            )
            .join(ReviewAssignment, ReviewAssignment.reviewer_id == User.id)
            .join(Review, Review.review_assignment_id == ReviewAssignment.id)
            .filter(User.credits >= settings.ta_qualification_threshold)
            .filter(Review.ai_quality_score.isnot(None))
        )
        if period_start:
            rows = rows.filter(Review.created_at >= period_start)

        rows = rows.group_by(User.id).order_by(desc("average_score"), User.created_at.asc()).limit(safe_limit).all()

        results: list[UserRankingEntry] = []
        for user, average_score in rows:
            rank = get_user_rank(user.credits)
            results.append(
                UserRankingEntry.model_validate(
                    {
                        "id": user.id,
                        "name": user.name,
                        "credits": user.credits,
                        "rank": rank.key,
                        "title": rank.title,
                        "is_ta": user.is_ta,
                        "average_score": float(average_score) if average_score is not None else None,
                    }
                )
            )
        _attach_ranking_extras(results, period, db)
        return results

    rows = (
        db.query(
            User,
            func.count(MetaReview.id).label("helpful_reviews"),
        )
        .join(ReviewAssignment, ReviewAssignment.reviewer_id == User.id)
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .join(MetaReview, MetaReview.review_id == Review.id)
        .filter(User.credits >= settings.ta_qualification_threshold)
        .filter(MetaReview.helpfulness >= 4)
    )
    if period_start:
        rows = rows.filter(MetaReview.created_at >= period_start)

    rows = rows.group_by(User.id).order_by(desc("helpful_reviews"), User.created_at.asc()).limit(safe_limit).all()

    results: list[UserRankingEntry] = []
    for user, helpful_reviews in rows:
        rank = get_user_rank(user.credits)
        results.append(
            UserRankingEntry.model_validate(
                {
                    "id": user.id,
                    "name": user.name,
                    "credits": user.credits,
                    "rank": rank.key,
                    "title": rank.title,
                    "is_ta": user.is_ta,
                    "helpful_reviews": int(helpful_reviews),
                }
            )
        )
    _attach_ranking_extras(results, period, db)
    return results


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
