from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.user import User
from app.services.scoring import _rubric_alignment_score


@dataclass(frozen=True)
class CreditGainResult:
    added: int
    base: float
    alignment: float | None
    comment_alignment: float | None
    trust_score: float | None
    alignment_bonus: float
    multiplier: float
    is_ta: bool


def _norm_1_to_5(score: int | None) -> float | None:
    if score is None:
        return None
    return float(score) / 5.0


def _weighted_average(values: list[tuple[float | None, float]]) -> float | None:
    total = 0.0
    weight_sum = 0.0
    for value, weight in values:
        if value is None or weight <= 0:
            continue
        total += value * weight
        weight_sum += weight
    if weight_sum <= 0:
        return None
    return total / weight_sum


def score_1_to_5_from_norm(value: float | None) -> int | None:
    if value is None:
        return None
    return max(1, min(5, int(round(value * 4 + 1))))


def calculate_review_credit_gain(
    db: Session,
    *,
    review_assignment: ReviewAssignment,
    review: Review,
    reviewer: User,
) -> CreditGainResult:
    base = max(0.0, float(settings.review_credit_base))
    alignment = _rubric_alignment_score(
        db,
        submission_id=review_assignment.submission_id,
        review_id=review.id,
        assignment_id=review_assignment.assignment_id,
    )
    comment_alignment = _norm_1_to_5(review.ai_comment_alignment_score)
    rubric_weight = max(0.0, float(getattr(settings, "review_credit_rubric_weight", 0.5)))
    comment_weight = max(0.0, float(getattr(settings, "review_credit_comment_weight", 0.5)))
    trust_score = _weighted_average(
        [
            (alignment, rubric_weight),
            (comment_alignment, comment_weight),
        ]
    )
    if trust_score is not None:
        trust_score = max(0.0, min(1.0, trust_score))

    alignment_bonus = max(0.0, float(settings.review_credit_alignment_bonus_max)) * (trust_score or 0.0)

    is_ta = reviewer.is_ta
    multiplier = float(settings.ta_credit_multiplier if is_ta else 1.0)
    total = (base + alignment_bonus) * multiplier
    added = max(1, int(round(total)))
    return CreditGainResult(
        added=added,
        base=base,
        alignment=alignment,
        comment_alignment=comment_alignment,
        trust_score=trust_score,
        alignment_bonus=alignment_bonus,
        multiplier=multiplier,
        is_ta=is_ta,
    )
