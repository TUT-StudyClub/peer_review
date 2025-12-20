from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.submission import SubmissionFileType
from app.models.ta_review_request import TAReviewRequestStatus


class RubricScore(BaseModel):
    criterion_id: UUID
    score: int = Field(ge=0, le=100)


class ReviewSubmit(BaseModel):
    comment: str = Field(min_length=1, max_length=20_000)
    rubric_scores: list[RubricScore]


class ReviewPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    review_assignment_id: UUID
    comment: str
    created_at: datetime
    ai_quality_score: int | None
    ai_quality_reason: str | None
    ai_toxic: bool | None
    ai_toxic_reason: str | None
    ai_logic: int | None
    ai_specificity: int | None
    ai_empathy: int | None
    ai_insight: int | None


class MetaReviewCreate(BaseModel):
    helpfulness: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2_000)


class MetaReviewPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    review_id: UUID
    rater_id: UUID
    helpfulness: int
    comment: str | None
    created_at: datetime


class RubricCriterionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    max_score: int
    order_index: int


class ReviewAssignmentTask(BaseModel):
    review_assignment_id: UUID
    submission_id: UUID
    author_alias: str
    file_type: SubmissionFileType
    rubric: list[RubricCriterionPublic]


class ReviewRubricScorePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    criterion_id: UUID
    score: int


class ReviewReceived(BaseModel):
    id: UUID
    reviewer_alias: str
    comment: str
    created_at: datetime
    rubric_scores: list[ReviewRubricScorePublic]
    meta_review: MetaReviewPublic | None
    ai_quality_score: int | None
    ai_quality_reason: str | None


class TAReviewRequestCreate(BaseModel):
    ta_user_id: UUID


class TAReviewRequestPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    submission_id: UUID
    teacher_id: UUID
    ta_id: UUID
    status: TAReviewRequestStatus
    review_assignment_id: UUID | None
    created_at: datetime
    responded_at: datetime | None
