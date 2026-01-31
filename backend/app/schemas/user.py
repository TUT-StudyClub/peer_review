from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import EmailStr
from pydantic import Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    role: UserRole | None = None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    name: str
    avatar_url: str | None = None
    role: UserRole
    credits: int
    rank: str
    title: str
    is_ta: bool
    is_admin: bool
    created_at: datetime


class UserRankingEntry(BaseModel):
    id: UUID
    name: str
    credits: int
    rank: str
    title: str
    is_ta: bool
    period_credits: int | None = None


class CreditHistoryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    delta: int
    total_credits: int
    reason: str
    review_id: UUID | None = None
    assignment_id: UUID | None = None
    submission_id: UUID | None = None
    created_at: datetime


class ReviewerSkill(BaseModel):
    logic: float
    specificity: float
    structure: float
    evidence: float
    overall: float
