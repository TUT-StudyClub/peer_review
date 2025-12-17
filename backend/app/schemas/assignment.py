from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    target_reviews_per_submission: int = Field(default=2, ge=1, le=3)


class AssignmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    target_reviews_per_submission: int
    created_at: datetime


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

