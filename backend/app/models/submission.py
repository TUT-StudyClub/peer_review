import enum
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SubmissionFileType(str, enum.Enum):
    pdf = "pdf"
    markdown = "markdown"


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[UUID] = mapped_column(SAUuid(as_uuid=True), primary_key=True, default=uuid4)
    assignment_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    file_type: Mapped[SubmissionFileType] = mapped_column(Enum(SubmissionFileType))
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))
    markdown_text: Mapped[str | None] = mapped_column(Text, default=None)

    teacher_total_score: Mapped[int | None] = mapped_column(Integer, default=None)
    teacher_feedback: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    assignment = relationship("Assignment", back_populates="submissions")
    author = relationship("User", back_populates="submissions")
    review_assignments = relationship("ReviewAssignment", back_populates="submission")
    teacher_rubric_scores = relationship(
        "SubmissionRubricScore", back_populates="submission", cascade="all, delete-orphan"
    )


class SubmissionRubricScore(Base):
    __tablename__ = "submission_rubric_scores"

    id: Mapped[UUID] = mapped_column(SAUuid(as_uuid=True), primary_key=True, default=uuid4)
    submission_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    criterion_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("rubric_criteria.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[int] = mapped_column(Integer)

    submission = relationship("Submission", back_populates="teacher_rubric_scores")
