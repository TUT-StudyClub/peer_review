import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.assignment import Assignment
from app.models.assignment import RubricCriterion
from app.models.review import MetaReview
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.models.review import ReviewRubricScore
from app.models.submission import Submission
from app.models.submission import SubmissionRubricScore
from app.models.user import User
from app.services.scoring import calculate_grade_for_user


def _make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_similarity_penalty_applies_to_review_points():
    db = _make_session()

    # セットアップ: Assignment, Criteria, Users, Submission
    assignment = Assignment(title="A1")
    db.add(assignment)
    db.flush()

    criterion = RubricCriterion(assignment_id=assignment.id, name="crit", max_score=5)
    db.add(criterion)

    author = User(email="author@example.com", name="Author", password_hash="x")
    reviewer = User(email="rev@example.com", name="Rev", password_hash="y")
    db.add_all([author, reviewer])
    db.flush()

    submission = Submission(
        assignment_id=assignment.id,
        author_id=author.id,
        file_type="markdown",
        original_filename="f.md",
        storage_path="/tmp/f",
    )
    db.add(submission)
    db.flush()

    # teacher rubric score to allow alignment calculation
    teacher_score = SubmissionRubricScore(submission_id=submission.id, criterion_id=criterion.id, score=4)
    db.add(teacher_score)

    # Review assignment + review
    ra = ReviewAssignment(assignment_id=assignment.id, submission_id=submission.id, reviewer_id=reviewer.id)
    db.add(ra)
    db.flush()

    review = Review(review_assignment_id=ra.id, comment="ok", ai_quality_score=5, similarity_penalty_rate=0.25)
    db.add(review)
    db.flush()

    # Review rubric matching teacher to get alignment=1.0
    rrs = ReviewRubricScore(review_id=review.id, criterion_id=criterion.id, score=4)
    db.add(rrs)

    # Meta review helpfulness = 5
    meta = MetaReview(review_id=review.id, rater_id=reviewer.id, helpfulness=5)
    db.add(meta)

    db.commit()

    grade = calculate_grade_for_user(db, assignment, reviewer)

    assert grade.review_contribution == pytest.approx(7.5)
    assert grade.breakdown["reviews_count"] == 1
    per = grade.breakdown["per_review"][0]
    assert per["points"] == pytest.approx(7.5)
    assert per["similarity_penalty"] == pytest.approx(0.25)
