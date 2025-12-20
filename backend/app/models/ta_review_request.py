import enum
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TAReviewRequestStatus(str, enum.Enum):
    offered = "offered"
    accepted = "accepted"
    declined = "declined"


class TAReviewRequest(Base):
    __tablename__ = "ta_review_requests"
    __table_args__ = (UniqueConstraint("submission_id", "ta_id", name="uq_submission_ta"),)

    id: Mapped[UUID] = mapped_column(SAUuid(as_uuid=True), primary_key=True, default=uuid4)
    assignment_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), index=True
    )
    submission_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    teacher_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    ta_id: Mapped[UUID] = mapped_column(
        SAUuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[TAReviewRequestStatus] = mapped_column(
        Enum(TAReviewRequestStatus), default=TAReviewRequestStatus.offered
    )
    review_assignment_id: Mapped[UUID | None] = mapped_column(
        SAUuid(as_uuid=True),
        ForeignKey("review_assignments.id", ondelete="SET NULL"),
        default=None,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    submission = relationship("Submission")
    teacher = relationship("User", foreign_keys=[teacher_id])
    ta = relationship("User", foreign_keys=[ta_id])
    review_assignment = relationship("ReviewAssignment", foreign_keys=[review_assignment_id])
