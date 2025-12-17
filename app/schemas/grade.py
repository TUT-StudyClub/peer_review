from pydantic import BaseModel


class GradeMe(BaseModel):
    assignment_score: float | None
    review_contribution: float
    final_score: float | None
    breakdown: dict

