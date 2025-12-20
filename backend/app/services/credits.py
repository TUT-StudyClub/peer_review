from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.review import Review, ReviewAssignment
from app.models.user import User
from app.services.scoring import _rubric_alignment_score


@dataclass(frozen=True)
class CreditGainResult:
    added: int
    base: float
    alignment: float | None
    alignment_bonus: float
    multiplier: float
    is_ta: bool


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
    alignment_bonus = (
        max(0.0, float(settings.review_credit_alignment_bonus_max)) * alignment
        if alignment is not None
        else 0.0
    )

    is_ta = reviewer.is_ta
    multiplier = float(settings.ta_credit_multiplier if is_ta else 1.0)
    total = (base + alignment_bonus) * multiplier
    added = max(1, int(round(total)))
    return CreditGainResult(
        added=added,
        base=base,
        alignment=alignment,
        alignment_bonus=alignment_bonus,
        multiplier=multiplier,
        is_ta=is_ta,
    )
