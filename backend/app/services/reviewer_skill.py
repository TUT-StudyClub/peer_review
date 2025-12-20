from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import REVIEWER_SKILL_TEMPLATE
from app.models.assignment import RubricCriterion
from app.models.review import Review, ReviewAssignment, ReviewRubricScore
from app.models.submission import SubmissionRubricScore
from app.schemas.user import ReviewerSkill
from app.services.rubric import normalize_rubric_name


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _alignment_norm(review_score: int, teacher_score: int, max_score: int) -> float | None:
    if max_score <= 0:
        return None
    diff = abs(float(review_score) - float(teacher_score))
    return max(0.0, min(1.0, 1.0 - (diff / float(max_score))))


def _norm_to_1_5(norm: float | None) -> float:
    if norm is None:
        return 0.0
    return max(1.0, min(5.0, 1.0 + (4.0 * norm)))


def calculate_reviewer_skill(
    db: Session,
    *,
    reviewer_id: UUID,
    assignment_id: UUID | None = None,
) -> ReviewerSkill:
    axes = REVIEWER_SKILL_TEMPLATE
    axis_keys = [axis["key"] for axis in axes]
    axis_norms: dict[str, list[float]] = {key: [] for key in axis_keys}

    query = (
        db.query(ReviewAssignment, Review)
        .join(Review, Review.review_assignment_id == ReviewAssignment.id)
        .filter(ReviewAssignment.reviewer_id == reviewer_id)
    )
    if assignment_id is not None:
        query = query.filter(ReviewAssignment.assignment_id == assignment_id)

    rows = query.all()
    if not rows:
        return ReviewerSkill(
            logic=0.0,
            specificity=0.0,
            structure=0.0,
            evidence=0.0,
            overall=0.0,
        )

    review_ids = [review.id for _, review in rows]
    submission_ids = [ra.submission_id for ra, _ in rows]
    assignment_ids = {ra.assignment_id for ra, _ in rows}

    review_scores = (
        db.query(ReviewRubricScore)
        .filter(ReviewRubricScore.review_id.in_(review_ids))
        .all()
    )
    teacher_scores = (
        db.query(SubmissionRubricScore)
        .filter(SubmissionRubricScore.submission_id.in_(submission_ids))
        .all()
    )
    criteria = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.assignment_id.in_(list(assignment_ids)))
        .all()
    )

    review_by_review_id: dict[UUID, dict[UUID, int]] = defaultdict(dict)
    for score in review_scores:
        review_by_review_id[score.review_id][score.criterion_id] = score.score

    teacher_by_submission_id: dict[UUID, dict[UUID, int]] = defaultdict(dict)
    for score in teacher_scores:
        teacher_by_submission_id[score.submission_id][score.criterion_id] = score.score

    template_by_norm = {
        normalize_rubric_name(item["name"]): item["key"] for item in REVIEWER_SKILL_TEMPLATE
    }
    criterion_axis: dict[UUID, str] = {}
    criterion_max: dict[UUID, int] = {}
    for criterion in criteria:
        axis_key = template_by_norm.get(normalize_rubric_name(criterion.name))
        if axis_key is None:
            continue
        criterion_axis[criterion.id] = axis_key
        criterion_max[criterion.id] = criterion.max_score

    for ra, review in rows:
        review_scores_map = review_by_review_id.get(review.id, {})
        teacher_scores_map = teacher_by_submission_id.get(ra.submission_id, {})
        if not review_scores_map or not teacher_scores_map:
            continue

        for criterion_id, teacher_score in teacher_scores_map.items():
            review_score = review_scores_map.get(criterion_id)
            if review_score is None:
                continue
            axis_key = criterion_axis.get(criterion_id)
            if axis_key is None:
                continue
            max_score = criterion_max.get(criterion_id, 0)
            norm = _alignment_norm(review_score, teacher_score, max_score)
            if norm is None:
                continue
            axis_norms[axis_key].append(norm)

    axis_scores: dict[str, float] = {}
    for key in axis_keys:
        axis_scores[key] = _norm_to_1_5(_avg(axis_norms[key]))

    overall_values = [score for score in axis_scores.values() if score > 0]
    overall = _avg(overall_values) or 0.0

    return ReviewerSkill(
        logic=axis_scores.get("logic", 0.0),
        specificity=axis_scores.get("specificity", 0.0),
        structure=axis_scores.get("structure", 0.0),
        evidence=axis_scores.get("evidence", 0.0),
        overall=overall,
    )
