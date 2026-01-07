import enum
from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import Float
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDType


class ReviewAssignmentStatus(str, enum.Enum):
    assigned = "assigned"
    submitted = "submitted"


class ReviewAssignment(Base):
    __tablename__ = "review_assignments"
    __table_args__ = (UniqueConstraint("submission_id", "reviewer_id", name="uq_submission_reviewer"),)

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    assignment_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    submission_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    status: Mapped[ReviewAssignmentStatus] = mapped_column(
        Enum(ReviewAssignmentStatus), default=ReviewAssignmentStatus.assigned
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    submission = relationship("Submission", back_populates="review_assignments")
    reviewer = relationship("User", back_populates="review_assignments")
    review = relationship("Review", back_populates="review_assignment", uselist=False)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    review_assignment_id: Mapped[UUID] = mapped_column(
        UUIDType,
        ForeignKey("review_assignments.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    ai_quality_score: Mapped[int | None] = mapped_column(Integer, default=None)
    ai_quality_reason: Mapped[str | None] = mapped_column(Text, default=None)
    ai_toxic: Mapped[bool | None] = mapped_column(Boolean, default=None)
    ai_toxic_reason: Mapped[str | None] = mapped_column(Text, default=None)

    ai_logic: Mapped[int | None] = mapped_column(Integer, default=None)
    ai_specificity: Mapped[int | None] = mapped_column(Integer, default=None)
    ai_empathy: Mapped[int | None] = mapped_column(Integer, default=None)
    ai_insight: Mapped[int | None] = mapped_column(Integer, default=None)
    ai_comment_alignment_score: Mapped[int | None] = mapped_column(Integer, default=None)
    ai_comment_alignment_reason: Mapped[str | None] = mapped_column(Text, default=None)

    # 重複検知関連
    normalized_comment_hash: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
    duplicate_of_review_id: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("reviews.id", ondelete="SET NULL"), default=None, index=True
    )
    duplicate_warning: Mapped[str | None] = mapped_column(Text, default=None)
    duplicate_penalty_rate: Mapped[float | None] = mapped_column(Float, default=None)

    # 類似検知関連
    similarity_score: Mapped[float | None] = mapped_column(Float, default=None)
    similar_review_id: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("reviews.id", ondelete="SET NULL"), default=None, index=True
    )
    similarity_warning: Mapped[str | None] = mapped_column(Text, default=None)
    similarity_penalty_rate: Mapped[float | None] = mapped_column(Float, default=None)

    review_assignment = relationship("ReviewAssignment", back_populates="review")
    rubric_scores = relationship("ReviewRubricScore", back_populates="review", cascade="all, delete-orphan")
    meta_review = relationship("MetaReview", back_populates="review", uselist=False)


class ReviewRubricScore(Base):
    __tablename__ = "review_rubric_scores"
    __table_args__ = (UniqueConstraint("review_id", "criterion_id", name="uq_review_criterion"),)

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    review_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    criterion_id: Mapped[UUID] = mapped_column(
        UUIDType, ForeignKey("rubric_criteria.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[int] = mapped_column(Integer)

    review = relationship("Review", back_populates="rubric_scores")


class MetaReview(Base):
    __tablename__ = "meta_reviews"
    __table_args__ = (UniqueConstraint("review_id", name="uq_meta_review_review"),)

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    review_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    rater_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    helpfulness: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    review = relationship("Review", back_populates="meta_review")
