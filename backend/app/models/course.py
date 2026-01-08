from datetime import UTC
from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDType


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    teacher_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    teacher = relationship("User", back_populates="courses_taught")
    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="course")


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"
    __table_args__ = (UniqueConstraint("course_id", "user_id", name="uq_course_enrollment"),)

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    course_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[UUID] = mapped_column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    course = relationship("Course", back_populates="enrollments")
    user = relationship("User", back_populates="course_enrollments")
