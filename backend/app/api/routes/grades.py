from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.user import User
from app.schemas.grade import GradeMe
from app.services.auth import get_current_user
from app.services.scoring import calculate_grade_for_user

router = APIRouter()
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)


@router.get("/assignments/{assignment_id}/grades/me", response_model=GradeMe)
def my_grade(
    assignment_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> GradeMe:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return calculate_grade_for_user(db, assignment, current_user)
