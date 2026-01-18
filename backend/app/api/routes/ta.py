from datetime import UTC
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.review import ReviewAssignment
from app.models.review import ReviewAssignmentStatus
from app.models.submission import Submission
from app.models.ta_review_request import TAReviewRequest
from app.models.ta_review_request import TAReviewRequestStatus
from app.models.user import User
from app.models.user import UserRole
from app.schemas.review import TAReviewRequestCreate
from app.schemas.review import TAReviewRequestPublic
from app.schemas.user import UserPublic
from app.services.auth import get_current_user
from app.services.auth import require_teacher

router = APIRouter()
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)
teacher_dependency = Depends(require_teacher)


@router.post("/submissions/{submission_id}/ta-requests", response_model=TAReviewRequestPublic)
def create_ta_review_request(
    submission_id: UUID,
    payload: TAReviewRequestCreate,
    db: Session = db_dependency,
    _teacher: User = teacher_dependency,
) -> TAReviewRequest:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.teacher_total_score is not None:
        raise HTTPException(status_code=400, detail="Teacher has already graded this submission")

    ta_user = db.query(User).filter(User.id == payload.ta_user_id).first()
    if ta_user is None:
        raise HTTPException(status_code=404, detail="TA user not found")
    if not ta_user.is_ta:
        raise HTTPException(
            status_code=400,
            detail="User is not TA-qualified (credits below threshold)",
        )
    if submission.author_id == ta_user.id:
        raise HTTPException(status_code=400, detail="Cannot assign TA to their own submission")

    existing = (
        db.query(TAReviewRequest)
        .filter(TAReviewRequest.submission_id == submission_id, TAReviewRequest.ta_id == ta_user.id)
        .first()
    )
    if existing is not None:
        if existing.status == TAReviewRequestStatus.declined:
            existing.status = TAReviewRequestStatus.offered
            existing.responded_at = None
            existing.review_assignment_id = None
            existing.teacher_id = _teacher.id
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="TA review request already exists for this user")

    request = TAReviewRequest(
        assignment_id=submission.assignment_id,
        submission_id=submission.id,
        teacher_id=_teacher.id,
        ta_id=ta_user.id,
        status=TAReviewRequestStatus.offered,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/assignments/{assignment_id}/ta-requests", response_model=list[TAReviewRequestPublic])
def list_ta_requests_for_assignment(
    assignment_id: UUID,
    _teacher: User = teacher_dependency,
    db: Session = db_dependency,
) -> list[TAReviewRequest]:
    return (
        db.query(TAReviewRequest)
        .filter(TAReviewRequest.assignment_id == assignment_id)
        .order_by(TAReviewRequest.created_at.desc())
        .all()
    )


@router.get("/ta-requests/me", response_model=list[TAReviewRequestPublic])
def list_my_ta_review_requests(
    status: TAReviewRequestStatus | None = None,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> list[TAReviewRequest]:
    query = db.query(TAReviewRequest).filter(TAReviewRequest.ta_id == current_user.id)
    if status is not None:
        query = query.filter(TAReviewRequest.status == status)
    return query.order_by(TAReviewRequest.created_at.desc()).all()


@router.post("/ta-requests/{request_id}/accept", response_model=TAReviewRequestPublic)
def accept_ta_review_request(
    request_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> TAReviewRequest:
    request = db.query(TAReviewRequest).filter(TAReviewRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="TA review request not found")
    if request.ta_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if request.status != TAReviewRequestStatus.offered:
        raise HTTPException(status_code=400, detail="Request is already handled")

    submission = db.query(Submission).filter(Submission.id == request.submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.teacher_total_score is not None:
        raise HTTPException(status_code=400, detail="Teacher has already graded this submission")

    existing_ra = (
        db.query(ReviewAssignment)
        .filter(
            ReviewAssignment.submission_id == request.submission_id,
            ReviewAssignment.reviewer_id == current_user.id,
        )
        .first()
    )
    if existing_ra is None:
        ra = ReviewAssignment(
            assignment_id=request.assignment_id,
            submission_id=request.submission_id,
            reviewer_id=current_user.id,
            status=ReviewAssignmentStatus.assigned,
        )
        db.add(ra)
        db.flush()
        request.review_assignment_id = ra.id
    else:
        request.review_assignment_id = existing_ra.id

    request.status = TAReviewRequestStatus.accepted
    request.responded_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request


@router.get("/ta/eligible", response_model=list[UserPublic])
def list_eligible_tas(
    _teacher: User = teacher_dependency,
    db: Session = db_dependency,
) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == UserRole.student)
        .filter(User.credits >= settings.ta_qualification_threshold)
        .all()
    )


@router.post("/ta-requests/{request_id}/decline", response_model=TAReviewRequestPublic)
def decline_ta_review_request(
    request_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> TAReviewRequest:
    request = db.query(TAReviewRequest).filter(TAReviewRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="TA review request not found")
    if request.ta_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if request.status != TAReviewRequestStatus.offered:
        raise HTTPException(status_code=400, detail="Request is already handled")

    request.status = TAReviewRequestStatus.declined
    request.responded_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request
