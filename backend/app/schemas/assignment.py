from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    course_id: UUID
    description: str | None = None
    target_reviews_per_submission: int = Field(default=2, ge=1, le=3)
    due_at: datetime | None = None


class AssignmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID | None
    title: str
    description: str | None
    target_reviews_per_submission: int
    created_at: datetime
    due_at: datetime | None


class RubricCriterionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    max_score: int = Field(default=5, ge=1, le=100)
    order_index: int = Field(default=0, ge=0)


class RubricCriterionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    name: str
    description: str | None
    max_score: int
    order_index: int
