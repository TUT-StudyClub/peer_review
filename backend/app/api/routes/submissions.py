from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.assignment import Assignment, RubricCriterion
from app.models.review import ReviewAssignment
from app.models.submission import Submission, SubmissionFileType, SubmissionRubricScore
from app.models.user import User, UserRole
from app.schemas.submission import SubmissionPublic, TeacherGradeSubmit
from app.services.auth import get_current_user, require_teacher
from app.services.storage import detect_file_type, ensure_storage_dir, save_upload_file

router = APIRouter()


@router.post("/assignment/{assignment_id}", response_model=SubmissionPublic)
def submit_report(
    assignment_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    ensure_storage_dir()
    submission_id = uuid4()
    stored_path = save_upload_file(
        upload=file,
        assignment_id=assignment_id,
        submission_id=submission_id,
        file_type=file_type,
    )

    markdown_text: str | None = None
    if file_type == SubmissionFileType.markdown:
        markdown_text = stored_path.read_text(encoding="utf-8", errors="replace")

    submission = Submission(
        id=submission_id,
        assignment_id=assignment_id,
        author_id=current_user.id,
        file_type=file_type,
        original_filename=file.filename or "upload",
        storage_path=str(stored_path),
        markdown_text=markdown_text,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/assignment/{assignment_id}/me", response_model=SubmissionPublic)
def get_my_submission(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    return FileResponse(submission.storage_path, filename=filename, media_type=media_type)


@router.post("/{submission_id}/teacher-grade", response_model=SubmissionPublic)
def set_teacher_grade(
    submission_id: UUID,
    payload: TeacherGradeSubmit,
    db: Session = Depends(get_db),
    _teacher: User = Depends(require_teacher),
) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    criteria = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.assignment_id == submission.assignment_id)
        .all()
    )
    criteria_by_id = {c.id: c for c in criteria}
    if len(payload.rubric_scores) != len(criteria_by_id):
        raise HTTPException(status_code=400, detail="All rubric criteria must be scored")

    for s in payload.rubric_scores:
        criterion = criteria_by_id.get(s.criterion_id)
        if criterion is None:
            raise HTTPException(status_code=400, detail="Invalid criterion_id in rubric_scores")
        if not (0 <= s.score <= criterion.max_score):
            raise HTTPException(status_code=400, detail="Rubric score out of range")

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

    db.commit()
    db.refresh(submission)
    return submission
