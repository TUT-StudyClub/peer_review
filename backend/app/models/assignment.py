from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDType


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    course_id: Mapped[UUID | None] = mapped_column(
        UUIDType,
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
        default=None,
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    target_reviews_per_submission: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    course = relationship("Course", back_populates="assignments")
    rubric_criteria = relationship("RubricCriterion", back_populates="assignment", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="assignment")


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    assignment_id: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("assignments.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    max_score: Mapped[int] = mapped_column(Integer, default=5)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    assignment = relationship("Assignment", back_populates="rubric_criteria")
