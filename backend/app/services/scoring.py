from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.assignment import RubricCriterion
from app.models.review import MetaReview
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.review import ReviewRubricScore
from app.models.submission import Submission
from app.models.submission import SubmissionRubricScore
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

    criteria = db.query(RubricCriterion).filter(RubricCriterion.assignment_id == submission.assignment_id).all()
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


def _rubric_alignment_score(db: Session, *, submission_id: UUID, review_id: UUID, assignment_id: UUID) -> float | None:
    teacher_scores = db.query(SubmissionRubricScore).filter(SubmissionRubricScore.submission_id == submission_id).all()
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


_REVIEW_POINTS_BASE_WEIGHTS = {
    "helpfulness": 0.5,
    "alignment": 0.3,
    "quality": 0.2,
}


def _norm_1_to_5(score: int | None) -> float | None:
    if score is None:
        return None
    return float(score) / 5.0


def calculate_grade_for_user(db: Session, assignment: Assignment, user: User) -> GradeMe:
    submission = (
        db.query(Submission).filter(Submission.assignment_id == assignment.id, Submission.author_id == user.id).first()
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
        helpfulness_raw = meta.helpfulness if meta else None
        helpfulness_norm = _norm_1_to_5(helpfulness_raw)

        alignment = _rubric_alignment_score(
            db,
            submission_id=ra.submission_id,
            review_id=r.id,
            assignment_id=assignment.id,
        )
        alignment_norm = alignment if alignment is not None else None

        quality_raw = r.ai_quality_score if r.ai_quality_score is not None else None
        quality_norm = _norm_1_to_5(quality_raw)
        toxic = bool(r.ai_toxic)
        comment_alignment_raw = r.ai_comment_alignment_score if r.ai_comment_alignment_score is not None else None
        comment_alignment_norm = _norm_1_to_5(comment_alignment_raw)

        available = {
            "helpfulness": helpfulness_norm is not None,
            "alignment": alignment_norm is not None,
            "quality": quality_norm is not None,
        }
        available_weight_sum = sum(_REVIEW_POINTS_BASE_WEIGHTS[key] for key, ok in available.items() if ok)
        weights = {
            key: (_REVIEW_POINTS_BASE_WEIGHTS[key] / available_weight_sum)
            if (available_weight_sum > 0 and available[key])
            else 0.0
            for key in _REVIEW_POINTS_BASE_WEIGHTS
        }

        score_norm = None
        if available_weight_sum > 0:
            score_norm = (
                weights["helpfulness"] * (helpfulness_norm or 0.0)
                + weights["alignment"] * (alignment_norm or 0.0)
                + weights["quality"] * (quality_norm or 0.0)
            )

        points = 0.0 if toxic else 10.0 * (score_norm or 0.0)
        duplicate_penalty = r.duplicate_penalty_rate if r.duplicate_penalty_rate is not None else 0.0
        if duplicate_penalty > 0:
            points = points * (1 - duplicate_penalty)
        # 類似度による減点
        similarity_penalty = r.similarity_penalty_rate if r.similarity_penalty_rate is not None else 0.0
        if similarity_penalty > 0:
            points = points * (1 - similarity_penalty)

        per_review_points.append(points)
        per_review_breakdown.append(
            {
                "review_id": str(r.id),
                "available_weights_sum": available_weight_sum,
                "toxic": toxic,
                "duplicate_penalty": duplicate_penalty,
                "similarity_penalty": similarity_penalty,
                "metrics": {
                    "helpfulness": {
                        "raw": helpfulness_raw,
                        "norm": helpfulness_norm,
                        "base_weight": _REVIEW_POINTS_BASE_WEIGHTS["helpfulness"],
                        "weight": weights["helpfulness"],
                    },
                    "alignment": {
                        "norm": alignment_norm,
                        "base_weight": _REVIEW_POINTS_BASE_WEIGHTS["alignment"],
                        "weight": weights["alignment"],
                    },
                    "quality": {
                        "raw": quality_raw,
                        "norm": quality_norm,
                        "base_weight": _REVIEW_POINTS_BASE_WEIGHTS["quality"],
                        "weight": weights["quality"],
                    },
                    "comment_alignment": {
                        "raw": comment_alignment_raw,
                        "norm": comment_alignment_norm,
                    },
                },
                "score_norm": score_norm,
                "points": points,
            }
        )

    review_contribution = sum(per_review_points)
    final_score = None if assignment_score is None else min(100.0, assignment_score + review_contribution)

    breakdown = {
        "reviews_count": len(per_review_breakdown),
        "review_points_base_weights": _REVIEW_POINTS_BASE_WEIGHTS,
        "per_review": per_review_breakdown,
    }
    return GradeMe(
        assignment_score=assignment_score,
        review_contribution=review_contribution,
        final_score=final_score,
        breakdown=breakdown,
    )
