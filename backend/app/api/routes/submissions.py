import logging
from pathlib import Path
from uuid import UUID
from uuid import uuid4

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.submission import Submission
from app.models.submission import SubmissionFileType
from app.models.submission import SubmissionRubricScore
from app.models.user import User
from app.models.user import UserRole
from app.schemas.submission import SubmissionPublic
from app.schemas.submission import TeacherGradeSubmit
from app.services.ai import analyze_review_alignment
from app.services.auth import get_current_user
from app.services.auth import require_teacher
from app.services.credits import CREDIT_REASON_REVIEW_RECALCULATED
from app.services.credits import calculate_review_credit_gain
from app.services.credits import record_credit_history
from app.services.pdf import PDFExtractionService
from app.services.rubric import ensure_fixed_rubric
from app.services.storage import build_download_response
from app.services.storage import detect_file_type
from app.services.storage import save_upload_file

logger = logging.getLogger(__name__)

router = APIRouter()
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)
teacher_dependency = Depends(require_teacher)
upload_file_dependency = File(...)


@router.post("/assignment/{assignment_id}", response_model=SubmissionPublic)
def submit_report(
    assignment_id: UUID,
    file: UploadFile = upload_file_dependency,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> Submission:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    existing = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id, Submission.author_id == current_user.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="You have already submitted for this assignment")

    file_type = detect_file_type(file)
    if file_type is None:
        raise HTTPException(status_code=400, detail="Only PDF or Markdown files are supported")

    submission_id = uuid4()
    stored = save_upload_file(
        upload=file,
        assignment_id=assignment_id,
        submission_id=submission_id,
        file_type=file_type,
    )

    # テキスト抽出処理
    submission_text: str | None = None
    markdown_text: str | None = None

    try:
        if file_type == SubmissionFileType.pdf:
            # PDF形式：PDFExtractionServiceで抽出
            try:
                stored_path_obj = Path(stored.local_path)
                extracted_text = PDFExtractionService.extract_text(
                    stored_path_obj,
                    max_pages=50,
                    max_chars=50000,
                )
                submission_text = extracted_text if extracted_text.strip() else None
            except Exception as e:
                # PDF抽出失敗時はログ記録しつつ提出を続行
                logger.warning(f"PDF text extraction failed for submission {submission_id}: {e}")
                submission_text = None
        elif file_type == SubmissionFileType.markdown:
            # Markdown形式：ファイル内容を読み込み
            markdown_text = stored.local_path.read_text(encoding="utf-8", errors="replace")
            submission_text = markdown_text
    finally:
        stored.cleanup()

    submission = Submission(
        id=submission_id,
        assignment_id=assignment_id,
        author_id=current_user.id,
        file_type=file_type,
        original_filename=file.filename or "upload",
        storage_path=stored.storage_path,
        markdown_text=markdown_text,
        submission_text=submission_text,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/assignment/{assignment_id}/me", response_model=SubmissionPublic)
def get_my_submission(
    assignment_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> Submission:
    submission = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id, Submission.author_id == current_user.id)
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.get("/{submission_id}", response_model=SubmissionPublic)
def get_submission(
    submission_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    if current_user.role != UserRole.teacher and submission.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return submission


@router.get("/{submission_id}/file")
def download_submission_file(
    submission_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> FileResponse:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    allowed = current_user.role == UserRole.teacher or submission.author_id == current_user.id
    if not allowed:
        assigned = (
            db.query(ReviewAssignment)
            .filter(
                ReviewAssignment.submission_id == submission_id,
                ReviewAssignment.reviewer_id == current_user.id,
            )
            .first()
        )
        allowed = assigned is not None
    if not allowed:
        raise HTTPException(status_code=403, detail="Not allowed")

    filename = "submission.pdf" if submission.file_type == SubmissionFileType.pdf else "submission.md"
    media_type = "application/pdf" if submission.file_type == SubmissionFileType.pdf else "text/markdown"
    return build_download_response(
        storage_path=submission.storage_path,
        filename=filename,
        media_type=media_type,
    )


@router.post("/{submission_id}/teacher-grade", response_model=SubmissionPublic)
def set_teacher_grade(
    submission_id: UUID,
    payload: TeacherGradeSubmit,
    db: Session = db_dependency,
    _teacher: User = teacher_dependency,
) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    criteria = ensure_fixed_rubric(db, submission.assignment_id)
    criteria_by_id = {c.id: c for c in criteria}
    if len(payload.rubric_scores) != len(criteria_by_id):
        raise HTTPException(status_code=400, detail="All rubric criteria must be scored")

    for s in payload.rubric_scores:
        criterion = criteria_by_id.get(s.criterion_id)
        if criterion is None:
            raise HTTPException(status_code=400, detail="Invalid criterion_id in rubric_scores")
        if not (0 <= s.score <= criterion.max_score):
            raise HTTPException(status_code=400, detail="Rubric score out of range")

    was_graded = submission.teacher_total_score is not None
    submission.teacher_total_score = payload.teacher_total_score
    submission.teacher_feedback = payload.teacher_feedback

    db.query(SubmissionRubricScore).filter(SubmissionRubricScore.submission_id == submission.id).delete()
    for s in payload.rubric_scores:
        db.add(
            SubmissionRubricScore(
                submission_id=submission.id,
                criterion_id=s.criterion_id,
                score=s.score,
            )
        )

    reviews = (
        db.query(Review, ReviewAssignment, User)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .join(User, User.id == ReviewAssignment.reviewer_id)
        .filter(ReviewAssignment.submission_id == submission.id)
        .all()
    )
    for review, review_assignment, reviewer in reviews:
        if payload.teacher_feedback and payload.teacher_feedback.strip():
            alignment = analyze_review_alignment(
                teacher_review_text=payload.teacher_feedback,
                student_review_text=review.comment,
            )
            if alignment is None:
                review.ai_comment_alignment_score = None
                review.ai_comment_alignment_reason = None
            else:
                review.ai_comment_alignment_score = alignment.alignment_score
                review.ai_comment_alignment_reason = alignment.alignment_reason

        new_credit = calculate_review_credit_gain(
            db,
            review_assignment=review_assignment,
            review=review,
            reviewer=reviewer,
        )
        old_awarded = review.credit_awarded
        if old_awarded is None:
            if was_graded:
                old_awarded = new_credit.added
            else:
                base = max(0.0, float(settings.review_credit_base))
                multiplier = float(settings.ta_credit_multiplier if reviewer.is_ta else 1.0)
                old_awarded = max(1, int(round(base * multiplier)))
        delta = new_credit.added - old_awarded
        if delta != 0:
            reviewer.credits = max(0, reviewer.credits + delta)
            record_credit_history(
                db,
                user=reviewer,
                delta=delta,
                total_credits=reviewer.credits,
                reason=CREDIT_REASON_REVIEW_RECALCULATED,
                review_id=review.id,
                assignment_id=review_assignment.assignment_id,
                submission_id=review_assignment.submission_id,
            )
        review.credit_awarded = new_credit.added

    db.commit()
    db.refresh(submission)
    return submission
