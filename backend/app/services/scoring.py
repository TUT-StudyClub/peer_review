from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.assignment import Assignment, RubricCriterion
from app.models.review import MetaReview, Review, ReviewAssignment, ReviewRubricScore
from app.models.submission import Submission, SubmissionRubricScore
from app.models.user import User
from app.schemas.grade import GradeMe


def _avg(nums: list[float]) -> float | None:
    if not nums:
        return None
    return sum(nums) / len(nums)


def _submission_score_from_peers(db: Session, submission: Submission) -> float | None:
    reviews = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(ReviewAssignment.submission_id == submission.id)
        .all()
    )
    if not reviews:
        return None

    criteria = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.assignment_id == submission.assignment_id)
        .all()
    )
    total_max = sum(c.max_score for c in criteria) or 0
    if total_max <= 0:
        return None

    totals: list[float] = []
    for r in reviews:
        scores = db.query(ReviewRubricScore).filter(ReviewRubricScore.review_id == r.id).all()
        if not scores:
            continue
        total = sum(s.score for s in scores)
        totals.append(100.0 * (total / total_max))
    return _avg(totals)


def _rubric_alignment_score(
    db: Session, *, submission_id: UUID, review_id: UUID, assignment_id: UUID
) -> float | None:
    teacher_scores = (
        db.query(SubmissionRubricScore)
        .filter(SubmissionRubricScore.submission_id == submission_id)
        .all()
    )
    if not teacher_scores:
        return None

    review_scores = db.query(ReviewRubricScore).filter(ReviewRubricScore.review_id == review_id).all()
    if not review_scores:
        return None

    criteria = db.query(RubricCriterion).filter(RubricCriterion.assignment_id == assignment_id).all()
    max_by_criterion = {c.id: c.max_score for c in criteria}
    teacher_by_criterion = {s.criterion_id: s.score for s in teacher_scores}
    review_by_criterion = {s.criterion_id: s.score for s in review_scores}

    diffs: list[float] = []
    max_diffs: list[float] = []
    for criterion_id, teacher_score in teacher_by_criterion.items():
        if criterion_id not in review_by_criterion:
            continue
        diffs.append(abs(float(review_by_criterion[criterion_id]) - float(teacher_score)))
        max_diffs.append(float(max_by_criterion.get(criterion_id, 5)))

    if not diffs or not max_diffs:
        return None

    avg_diff = sum(diffs) / len(diffs)
    avg_max_diff = sum(max_diffs) / len(max_diffs)
    if avg_max_diff <= 0:
        return None

    return max(0.0, min(1.0, 1.0 - (avg_diff / avg_max_diff)))


def calculate_grade_for_user(db: Session, assignment: Assignment, user: User) -> GradeMe:
    submission = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment.id, Submission.author_id == user.id)
        .first()
    )

    assignment_score: float | None = None
    if submission is not None and submission.teacher_total_score is not None:
        assignment_score = float(submission.teacher_total_score)
    elif submission is not None:
        assignment_score = _submission_score_from_peers(db, submission)

    my_reviews = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(ReviewAssignment.assignment_id == assignment.id, ReviewAssignment.reviewer_id == user.id)
        .all()
    )

    per_review_points: list[float] = []
    per_review_breakdown: list[dict] = []
    for r in my_reviews:
        ra = db.query(ReviewAssignment).filter(ReviewAssignment.id == r.review_assignment_id).first()
        if ra is None:
            continue
        meta = db.query(MetaReview).filter(MetaReview.review_id == r.id).first()
        helpfulness_norm = (float(meta.helpfulness) / 5.0) if meta else 0.6

        alignment = _rubric_alignment_score(
            db,
            submission_id=ra.submission_id,
            review_id=r.id,
            assignment_id=assignment.id,
        )
        alignment_norm = alignment if alignment is not None else 0.6

        quality_norm = (float(r.ai_quality_score) / 5.0) if r.ai_quality_score else 0.6
        toxic = bool(r.ai_toxic)
        points = 0.0 if toxic else 10.0 * (0.5 * helpfulness_norm + 0.3 * alignment_norm + 0.2 * quality_norm)
        per_review_points.append(points)
        per_review_breakdown.append(
            {
                "review_id": str(r.id),
                "helpfulness_norm": helpfulness_norm,
                "alignment_norm": alignment_norm,
                "quality_norm": quality_norm,
                "toxic": toxic,
                "points": points,
            }
        )

    review_contribution = sum(per_review_points)
    final_score = None if assignment_score is None else min(100.0, assignment_score + review_contribution)

    breakdown = {
        "reviews_count": len(my_reviews),
        "per_review": per_review_breakdown,
    }
    return GradeMe(
        assignment_score=assignment_score,
        review_contribution=review_contribution,
        final_score=final_score,
        breakdown=breakdown,
    )
