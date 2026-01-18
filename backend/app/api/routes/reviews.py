from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.review import MetaReview
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.review import ReviewAssignmentStatus
from app.models.review import ReviewRubricScore
from app.models.submission import Submission
from app.models.ta_review_request import TAReviewRequest
from app.models.ta_review_request import TAReviewRequestStatus
from app.models.user import User
from app.schemas.review import MetaReviewCreate
from app.schemas.review import MetaReviewPublic
from app.schemas.review import PolishRequest
from app.schemas.review import PolishResponse
from app.schemas.review import RephraseRequest
from app.schemas.review import RephraseResponse
from app.schemas.review import ReviewAssignmentTask
from app.schemas.review import ReviewPublic
from app.schemas.review import ReviewReceived
from app.schemas.review import ReviewSubmit
from app.schemas.review import RubricCriterionPublic
from app.schemas.review import TeacherReviewPublic
from app.services.ai import FeatureDisabledError
from app.services.ai import ModerationError
from app.services.ai import OpenAIEmptyChoiceError
from app.services.ai import OpenAIRequestError
from app.services.ai import OpenAIResponseParseError
from app.services.ai import OpenAIUnavailableError
from app.services.ai import analyze_review
from app.services.ai import analyze_review_alignment
from app.services.ai import polish_review
from app.services.anonymize import alias_for_user
from app.services.auth import get_current_user
from app.services.auth import require_teacher
from app.services.credits import calculate_review_credit_gain
from app.services.credits import score_1_to_5_from_norm
from app.services.duplicate import detect_duplicate_review
from app.services.duplicate import hash_comment
from app.services.matching import get_or_assign_review_assignment
from app.services.rubric import ensure_fixed_rubric
from app.services.similarity import check_similarity

router = APIRouter()
db_dependency = Depends(get_db)
current_user_dependency = Depends(get_current_user)
teacher_dependency = Depends(require_teacher)


def _evaluation_fields(credit: object | None) -> dict:
    if credit is None:
        return {
            "rubric_alignment_score": None,
            "total_alignment_score": None,
            "credit_awarded": None,
        }
    return {
        "rubric_alignment_score": score_1_to_5_from_norm(getattr(credit, "alignment", None)),
        "total_alignment_score": score_1_to_5_from_norm(getattr(credit, "trust_score", None)),
        "credit_awarded": getattr(credit, "added", None),
    }


@router.get("/assignments/{assignment_id}/reviews/next", response_model=ReviewAssignmentTask)
def next_review_task(
    assignment_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> ReviewAssignmentTask:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    review_assignment = get_or_assign_review_assignment(db, assignment, current_user)
    if review_assignment is None:
        raise HTTPException(status_code=404, detail="No submissions need review right now")

    submission = db.query(Submission).filter(Submission.id == review_assignment.submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    rubric = ensure_fixed_rubric(db, assignment_id)
    rubric_public = [RubricCriterionPublic.model_validate(item) for item in rubric]
    author_alias = alias_for_user(
        user_id=submission.author_id,
        assignment_id=assignment_id,
        prefix="User",
    )

    return ReviewAssignmentTask(
        review_assignment_id=review_assignment.id,
        submission_id=submission.id,
        author_alias=author_alias,
        file_type=submission.file_type,
        rubric=rubric_public,
    )


@router.post("/reviews/polish", response_model=PolishResponse)
def api_polish_review(
    payload: PolishRequest,
    current_user: User = current_user_dependency,
):
    try:
        polished_text, notes = polish_review(payload.text)

    except FeatureDisabledError as e:
        raise HTTPException(status_code=503, detail="OpenAI not configured") from e

    except OpenAIUnavailableError as e:
        raise HTTPException(status_code=503, detail="OpenAI temporarily unavailable") from e

    except OpenAIRequestError as e:
        status = 504 if e.reason == "timeout" else 502
        raise HTTPException(
            status_code=status,
            detail={"message": "OpenAI request failed", "reason": e.reason, "status_code": e.status_code},
        ) from e

    except (OpenAIResponseParseError, OpenAIEmptyChoiceError) as e:
        raise HTTPException(
            status_code=502,
            detail={"message": "OpenAI response parse failed", "reason": str(e)},
        ) from e

    except ModerationError as e:
        raise HTTPException(
            status_code=422, detail={"message": "Polish blocked by moderation", "details": e.args[0]}
        ) from e

    return PolishResponse(polished_text=polished_text, notes=notes)


@router.post("/review-assignments/{review_assignment_id}/submit", response_model=ReviewPublic)
def submit_review(
    review_assignment_id: UUID,
    payload: ReviewSubmit,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> ReviewPublic:
    review_assignment = db.query(ReviewAssignment).filter(ReviewAssignment.id == review_assignment_id).first()
    if review_assignment is None:
        raise HTTPException(status_code=404, detail="Review assignment not found")
    if review_assignment.reviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if review_assignment.status != ReviewAssignmentStatus.assigned:
        raise HTTPException(status_code=400, detail="This task is not open")

    existing_review = db.query(Review).filter(Review.review_assignment_id == review_assignment_id).first()
    if existing_review is not None:
        raise HTTPException(status_code=400, detail="Review already submitted")

    submission = db.query(Submission).filter(Submission.id == review_assignment.submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    rubric_criteria = ensure_fixed_rubric(db, review_assignment.assignment_id)
    criteria_by_id = {c.id: c for c in rubric_criteria}

    if len(payload.rubric_scores) != len(criteria_by_id):
        raise HTTPException(status_code=400, detail="All rubric criteria must be scored")

    for s in payload.rubric_scores:
        criterion = criteria_by_id.get(s.criterion_id)
        if criterion is None:
            raise HTTPException(status_code=400, detail="Invalid criterion_id in rubric_scores")
        if not (0 <= s.score <= criterion.max_score):
            raise HTTPException(status_code=400, detail="Rubric score out of range")

    # submission_text を優先、なければ markdown_text、それもなければ空文字列を使用
    submission_text = submission.submission_text or submission.markdown_text or ""
    ai_result = analyze_review(
        submission_text=submission_text,
        review_text=payload.comment,
    )
    if ai_result.toxic:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Toxic language detected",
                "reason": ai_result.toxic_reason,
                "errors": [
                    {
                        "path": ["comment"],
                        "issue": {
                            "code": "TOXIC_LANGUAGE",
                            "severity": "high",
                            "nested": {
                                "level1": [
                                    {
                                        "level2": {
                                            "level3": [
                                                {"level4": {"ok": False, "note": "deeply nested example"}},
                                                {"value": None},
                                            ]
                                        }
                                    }
                                ]
                            },
                        },
                    }
                ],
                "debug": {
                    "samples": {
                        "numbers": [0, 1, 2.5],
                        "booleans": [True, False],
                        "null": None,
                        "strings": ["a", "b"],
                    },
                    "note": "This nested detail is intentional for frontend robustness testing.",
                },
            },
        )

    alignment_result = analyze_review_alignment(
        teacher_review_text=submission.teacher_feedback,
        student_review_text=payload.comment,
    )

    normalized_comment_hash = hash_comment(payload.comment)
    duplicate_result = detect_duplicate_review(
        db,
        reviewer_id=current_user.id,
        assignment_id=review_assignment.assignment_id,
        normalized_hash=normalized_comment_hash,
    )
    quality_score = ai_result.quality_score
    quality_reason = ai_result.quality_reason
    quality_penalty_points = max(0, int(getattr(settings, "duplicate_quality_penalty_points", 0)))
    if duplicate_result.is_duplicate and quality_penalty_points > 0:
        quality_score = max(1, quality_score - quality_penalty_points)
        extra_reason = "重複検知により品質スコアを減点しました。"
        quality_reason = f"{quality_reason or ''} {extra_reason}".strip()

    # 類似検知を実行
    similarity_result = check_similarity(
        db,
        assignment_id=review_assignment.assignment_id,
        new_comment=payload.comment,
    )

    review = Review(
        review_assignment_id=review_assignment.id,
        comment=payload.comment,
        ai_quality_score=quality_score,
        ai_quality_reason=quality_reason,
        ai_toxic=ai_result.toxic,
        ai_toxic_reason=ai_result.toxic_reason,
        ai_logic=ai_result.logic,
        ai_specificity=ai_result.specificity,
        ai_empathy=ai_result.empathy,
        ai_insight=ai_result.insight,
        ai_comment_alignment_score=alignment_result.alignment_score if alignment_result else None,
        ai_comment_alignment_reason=alignment_result.alignment_reason if alignment_result else None,
        normalized_comment_hash=normalized_comment_hash,
        duplicate_of_review_id=duplicate_result.duplicate_review_id,
        duplicate_warning=duplicate_result.warning_message,
        duplicate_penalty_rate=duplicate_result.penalty_rate if duplicate_result.is_duplicate else None,
        # 類似検知結果を保存
        similarity_score=similarity_result.similarity,
        similar_review_id=similarity_result.similar_review_id,
        similarity_warning=similarity_result.warning_message,
        similarity_penalty_rate=similarity_result.penalty_rate,
    )
    db.add(review)
    db.flush()

    for s in payload.rubric_scores:
        db.add(ReviewRubricScore(review_id=review.id, criterion_id=s.criterion_id, score=s.score))

    review_assignment.status = ReviewAssignmentStatus.submitted
    review_assignment.submitted_at = review.created_at

    credit = calculate_review_credit_gain(
        db,
        review_assignment=review_assignment,
        review=review,
        reviewer=current_user,
    )
    current_user.credits += credit.added

    db.commit()
    db.refresh(review)
    return review


def _simple_rephrase(text: str) -> RephraseResponse:
    cleaned = " ".join(text.split())
    replacements = {
        "と思います": "と考えます",
        "です。": "です。",
        "だと思う": "と考えます",
        "と思う": "と考えます",
        "もう少し": "より一層",
        "いいと思います": "良い点だと感じます",
    }
    rephrased = cleaned
    for src, dst in replacements.items():
        rephrased = rephrased.replace(src, dst)
    if len(rephrased) == 0:
        rephrased = cleaned
    if not rephrased.endswith(("。", ".", "！", "?", "！", "?", "」")) and rephrased:
        rephrased += "。"

    notice = "開発用の簡易言い換えです。必要に応じて調整してください。"
    return RephraseResponse(original=text, rephrased=rephrased, notice=notice)


@router.post("/reviews/paraphrase", response_model=RephraseResponse)
def paraphrase(
    payload: RephraseRequest,
    _current_user: User = current_user_dependency,
) -> RephraseResponse:
    # OpenAIが利用可能なら polish_review を使用、そうでなければ簡易変換にフォールバック
    try:
        polished_text, notes = polish_review(payload.text)
        return RephraseResponse(
            original=payload.text,
            rephrased=polished_text,
            notice=notes,
        )
    except (
        FeatureDisabledError,
        OpenAIUnavailableError,
        OpenAIRequestError,
        OpenAIResponseParseError,
        OpenAIEmptyChoiceError,
    ):
        # OpenAI が使えない場合は簡易変換にフォールバック
        return _simple_rephrase(payload.text)
    except ModerationError:
        # モデレーションエラーは簡易変換を返す（エラーにしない）
        return _simple_rephrase(payload.text)


@router.get("/assignments/{assignment_id}/reviews/received", response_model=list[ReviewReceived])
def received_reviews(
    assignment_id: UUID,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> list[ReviewReceived]:
    submission = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment_id, Submission.author_id == current_user.id)
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    review_assignments = db.query(ReviewAssignment).filter(ReviewAssignment.submission_id == submission.id).all()
    assignment_by_id = {ra.id: ra for ra in review_assignments}
    reviewer_ids = {ra.reviewer_id for ra in review_assignments}
    reviewers = db.query(User).filter(User.id.in_(list(reviewer_ids))).all() if reviewer_ids else []
    reviewer_map = {u.id: u for u in reviewers}
    reviews = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(ReviewAssignment.submission_id == submission.id)
        .order_by(Review.created_at.asc())
        .all()
    )

    results: list[ReviewReceived] = []
    for r in reviews:
        ra = assignment_by_id.get(r.review_assignment_id)
        if ra is None:
            continue
        reviewer_user = reviewer_map.get(ra.reviewer_id)
        credit = (
            calculate_review_credit_gain(
                db,
                review_assignment=ra,
                review=r,
                reviewer=reviewer_user,
            )
            if reviewer_user
            else None
        )
        reviewer_alias = alias_for_user(user_id=ra.reviewer_id, assignment_id=assignment_id, prefix="Reviewer")

        scores = db.query(ReviewRubricScore).filter(ReviewRubricScore.review_id == r.id).all()
        meta = db.query(MetaReview).filter(MetaReview.review_id == r.id).first()
        results.append(
            ReviewReceived(
                id=r.id,
                reviewer_alias=reviewer_alias,
                comment=r.comment,
                created_at=r.created_at,
                rubric_scores=scores,
                meta_review=meta,
                ai_quality_score=r.ai_quality_score,
                ai_quality_reason=r.ai_quality_reason,
                ai_comment_alignment_score=r.ai_comment_alignment_score,
                ai_comment_alignment_reason=r.ai_comment_alignment_reason,
                **_evaluation_fields(credit),
                duplicate_of_review_id=r.duplicate_of_review_id,
                duplicate_warning=r.duplicate_warning,
                duplicate_penalty_rate=r.duplicate_penalty_rate,
                similarity_score=r.similarity_score,
                similar_review_id=r.similar_review_id,
                similarity_warning=r.similarity_warning,
                similarity_penalty_rate=r.similarity_penalty_rate,
            )
        )

    return results


@router.post("/reviews/{review_id}/meta", response_model=MetaReviewPublic)
def create_meta_review(
    review_id: UUID,
    payload: MetaReviewCreate,
    db: Session = db_dependency,
    current_user: User = current_user_dependency,
) -> MetaReview:
    review = db.query(Review).filter(Review.id == review_id).first()
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")

    review_assignment = db.query(ReviewAssignment).filter(ReviewAssignment.id == review.review_assignment_id).first()
    if review_assignment is None:
        raise HTTPException(status_code=404, detail="Review assignment not found")

    submission = db.query(Submission).filter(Submission.id == review_assignment.submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the submission author can meta-review")

    existing = db.query(MetaReview).filter(MetaReview.review_id == review_id).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Meta-review already submitted")

    meta = MetaReview(
        review_id=review_id,
        rater_id=current_user.id,
        helpfulness=payload.helpfulness,
        comment=payload.comment,
    )
    db.add(meta)
    db.commit()
    db.refresh(meta)
    return meta


@router.get("/submissions/{submission_id}/reviews", response_model=list[TeacherReviewPublic])
def list_reviews_for_submission(
    submission_id: UUID,
    db: Session = db_dependency,
    _teacher: User = teacher_dependency,
) -> list[TeacherReviewPublic]:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    review_assignments = db.query(ReviewAssignment).filter(ReviewAssignment.submission_id == submission_id).all()
    ra_by_id = {ra.id: ra for ra in review_assignments}
    reviewer_by_id = {ra.reviewer_id for ra in review_assignments}
    reviewers = db.query(User).filter(User.id.in_(list(reviewer_by_id))).all()
    reviewer_map = {u.id: u for u in reviewers}
    accepted_ta_ids = {
        req.ta_id
        for req in db.query(TAReviewRequest)
        .filter(
            TAReviewRequest.submission_id == submission_id,
            TAReviewRequest.status == TAReviewRequestStatus.accepted,
        )
        .all()
    }
    reviews = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(ReviewAssignment.submission_id == submission_id)
        .order_by(Review.created_at.asc())
        .all()
    )
    results: list[TeacherReviewPublic] = []
    for r in reviews:
        ra = ra_by_id.get(r.review_assignment_id)
        if ra is None:
            continue
        reviewer_user = reviewer_map.get(ra.reviewer_id)
        credit = (
            calculate_review_credit_gain(
                db,
                review_assignment=ra,
                review=r,
                reviewer=reviewer_user,
            )
            if reviewer_user
            else None
        )
        reviewer_alias = alias_for_user(
            user_id=ra.reviewer_id, assignment_id=submission.assignment_id, prefix="Reviewer"
        )
        scores = db.query(ReviewRubricScore).filter(ReviewRubricScore.review_id == r.id).all()
        meta = db.query(MetaReview).filter(MetaReview.review_id == r.id).first()
        results.append(
            TeacherReviewPublic(
                id=r.id,
                reviewer_alias=reviewer_alias,
                is_ta=(
                    bool(reviewer_user.is_ta)
                    if (reviewer_user and reviewer_user.is_ta)
                    else ra.reviewer_id in accepted_ta_ids
                ),
                comment=r.comment,
                created_at=r.created_at,
                rubric_scores=scores,
                meta_review=meta,
                ai_quality_score=r.ai_quality_score,
                ai_quality_reason=r.ai_quality_reason,
                ai_comment_alignment_score=r.ai_comment_alignment_score,
                ai_comment_alignment_reason=r.ai_comment_alignment_reason,
                **_evaluation_fields(credit),
                duplicate_of_review_id=r.duplicate_of_review_id,
                duplicate_warning=r.duplicate_warning,
                duplicate_penalty_rate=r.duplicate_penalty_rate,
            )
        )
    return results
