from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.core.config import REVIEWER_SKILL_TEMPLATE
from app.models.assignment import RubricCriterion


def normalize_rubric_name(name: str) -> str:
    base = re.split(r"[（(]", name, maxsplit=1)[0]
    base = re.sub(r"\s+", "", base)
    return base.strip().lower()


def ensure_fixed_rubric(db: Session, assignment_id) -> list[RubricCriterion]:
    criteria = db.query(RubricCriterion).filter(RubricCriterion.assignment_id == assignment_id).all()
    by_norm: dict[str, RubricCriterion] = {normalize_rubric_name(c.name): c for c in criteria}

    fixed: list[RubricCriterion] = []
    created = False
    for item in REVIEWER_SKILL_TEMPLATE:
        norm = normalize_rubric_name(item["name"])
        criterion = by_norm.get(norm)
        if criterion is None:
            criterion = RubricCriterion(
                assignment_id=assignment_id,
                name=item["name"],
                description=item["description"],
                max_score=item["max_score"],
                order_index=item["order_index"],
            )
            db.add(criterion)
            by_norm[norm] = criterion
            created = True
        fixed.append(criterion)

    if created:
        db.flush()

    return fixed
