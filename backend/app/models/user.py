import enum
from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.core.config import settings
from app.db.base import Base
from app.services.rank import get_user_rank


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(SAUuid(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.student)
    password_hash: Mapped[str] = mapped_column(String(255))
    credits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    submissions = relationship("Submission", back_populates="author")
    review_assignments = relationship("ReviewAssignment", back_populates="reviewer")
    courses_taught = relationship("Course", back_populates="teacher")
    course_enrollments = relationship("CourseEnrollment", back_populates="user")

    @property
    def is_ta(self) -> bool:
        return self.credits >= settings.ta_qualification_threshold

    @property
    def rank(self) -> str:
        return get_user_rank(self.credits).key

    @property
    def title(self) -> str:
        return get_user_rank(self.credits).title
