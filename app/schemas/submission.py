from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.submission import SubmissionFileType


class SubmissionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    file_type: SubmissionFileType
    original_filename: str
    teacher_total_score: int | None
    teacher_feedback: str | None
    created_at: datetime


class TeacherRubricScore(BaseModel):
    criterion_id: UUID
    score: int


class TeacherGradeSubmit(BaseModel):
    teacher_total_score: int
    teacher_feedback: str | None = None
    rubric_scores: list[TeacherRubricScore]
