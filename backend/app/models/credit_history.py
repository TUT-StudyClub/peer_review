from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDType


class CreditHistory(Base):
    __tablename__ = "credit_histories"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    total_credits: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(120))
    review_id: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("reviews.id", ondelete="SET NULL"), index=True, default=None
    )
    assignment_id: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("assignments.id", ondelete="SET NULL"), index=True, default=None
    )
    submission_id: Mapped[UUID | None] = mapped_column(
        UUIDType, ForeignKey("submissions.id", ondelete="SET NULL"), index=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user = relationship("User", back_populates="credit_histories")
