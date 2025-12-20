from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None


class CoursePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    teacher_id: UUID
    created_at: datetime
    teacher_name: str | None = None
    is_enrolled: bool | None = None
    student_count: int | None = None


class CourseEnrollmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    user_id: UUID
    created_at: datetime
