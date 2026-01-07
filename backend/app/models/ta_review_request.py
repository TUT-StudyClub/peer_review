import enum
from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDType


class TAReviewRequestStatus(str, enum.Enum):
    offered = "offered"
    accepted = "accepted"
    declined = "declined"


class TAReviewRequest(Base):
    __tablename__ = "ta_review_requests"
    __table_args__ = (UniqueConstraint("submission_id", "ta_id", name="uq_submission_ta"),)

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    assignment_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    submission_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ta_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[TAReviewRequestStatus] = mapped_column(
        Enum(TAReviewRequestStatus), default=TAReviewRequestStatus.offered
    )
    review_assignment_id: Mapped[UUID | None] = mapped_column(
        UUIDType,
        ForeignKey("review_assignments.id", ondelete="SET NULL"),
        default=None,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    submission = relationship("Submission")
    teacher = relationship("User", foreign_keys=[teacher_id])
    ta = relationship("User", foreign_keys=[ta_id])
    review_assignment = relationship("ReviewAssignment", foreign_keys=[review_assignment_id])
