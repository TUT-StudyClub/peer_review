from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.review import ReviewAssignment
from app.models.review import ReviewAssignmentStatus
from app.models.submission import Submission
from app.models.user import User


def get_or_assign_review_assignment(db: Session, assignment: Assignment, reviewer: User) -> ReviewAssignment | None:
    open_task = (
        db.query(ReviewAssignment)
        .filter(
            ReviewAssignment.assignment_id == assignment.id,
            ReviewAssignment.reviewer_id == reviewer.id,
            ReviewAssignment.status == ReviewAssignmentStatus.assigned,
        )
        .order_by(ReviewAssignment.assigned_at.asc())
        .first()
    )
    if open_task is not None:
        return open_task

    target = assignment.target_reviews_per_submission

    assigned_count_subq = (
        db.query(
            ReviewAssignment.submission_id.label("submission_id"),
            func.count(ReviewAssignment.id).label("assigned_count"),
        )
        .filter(
            ReviewAssignment.assignment_id == assignment.id,
            ReviewAssignment.status.in_([ReviewAssignmentStatus.assigned, ReviewAssignmentStatus.submitted]),
        )
        .group_by(ReviewAssignment.submission_id)
        .subquery()
    )

    already_assigned_subq = db.query(ReviewAssignment.submission_id).filter(
        ReviewAssignment.assignment_id == assignment.id,
        ReviewAssignment.reviewer_id == reviewer.id,
    )

    candidate = (
        db.query(Submission)
        .join(User, User.id == Submission.author_id)
        .outerjoin(assigned_count_subq, assigned_count_subq.c.submission_id == Submission.id)
        .filter(
            Submission.assignment_id == assignment.id,
            Submission.author_id != reviewer.id,
        )
        .filter(~Submission.id.in_(already_assigned_subq))
        .filter(func.coalesce(assigned_count_subq.c.assigned_count, 0) < target)
        .order_by(
            func.coalesce(assigned_count_subq.c.assigned_count, 0).asc(),
            User.credits.desc(),
            func.random(),
        )
        .first()
    )
    if candidate is None:
        return None

    review_assignment = ReviewAssignment(
        assignment_id=assignment.id,
        submission_id=candidate.id,
        reviewer_id=reviewer.id,
        status=ReviewAssignmentStatus.assigned,
    )
    db.add(review_assignment)
    db.commit()
    db.refresh(review_assignment)
    return review_assignment
