from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import EmailStr
from pydantic import Field

from app.models.user import UserRole


class ReviewerSkillOverride(BaseModel):
    logic: float | None = Field(default=None, ge=0, le=5)
    specificity: float | None = Field(default=None, ge=0, le=5)
    structure: float | None = Field(default=None, ge=0, le=5)
    evidence: float | None = Field(default=None, ge=0, le=5)
    overall: float | None = Field(default=None, ge=0, le=5)


class AdminUserUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: UserRole | None = None
    credits: int | None = Field(default=None, ge=0)
    reviewer_skill_override_logic: float | None = Field(default=None, ge=0, le=5)
    reviewer_skill_override_specificity: float | None = Field(default=None, ge=0, le=5)
    reviewer_skill_override_structure: float | None = Field(default=None, ge=0, le=5)
    reviewer_skill_override_evidence: float | None = Field(default=None, ge=0, le=5)
    reviewer_skill_override_overall: float | None = Field(default=None, ge=0, le=5)


class AdminUserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    name: str
    role: UserRole
    credits: int
    rank: str
    title: str
    is_ta: bool
    is_admin: bool
    created_at: datetime
    reviewer_skill_override: ReviewerSkillOverride


class AdminAssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    target_reviews_per_submission: int | None = Field(default=None, ge=1, le=3)
    due_at: datetime | None = None
