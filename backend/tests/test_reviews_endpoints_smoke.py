from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.reviews import received_reviews
from app.api.routes.reviews import submit_review
from app.db.base import Base
from app.models.assignment import Assignment
from app.models.assignment import RubricCriterion
from app.models.review import ReviewAssignment
from app.models.submission import Submission
from app.models.submission import SubmissionRubricScore
from app.models.user import User
from app.schemas.review import ReviewSubmit
from app.schemas.review import RubricScore


def _make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_submit_and_receive_review_smoke():
    db = _make_session()

    # Setup data
    assignment = Assignment(title="A1")
    db.add(assignment)
    db.flush()

    # 固定ルーブリック基準を作成（REVIEWER_SKILL_TEMPLATEに対応）
    criteria = [
        RubricCriterion(assignment_id=assignment.id, name="論理性", max_score=5, order_index=0),
        RubricCriterion(assignment_id=assignment.id, name="具体性", max_score=5, order_index=1),
        RubricCriterion(assignment_id=assignment.id, name="構成", max_score=5, order_index=2),
        RubricCriterion(assignment_id=assignment.id, name="根拠", max_score=5, order_index=3),
    ]
    db.add_all(criteria)
    db.flush()

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

    # 全ての基準に対して教師のスコアを設定
    for criterion in criteria:
        teacher_score = SubmissionRubricScore(submission_id=submission.id, criterion_id=criterion.id, score=4)
        db.add(teacher_score)

    ra = ReviewAssignment(assignment_id=assignment.id, submission_id=submission.id, reviewer_id=reviewer.id)
    db.add(ra)
    db.flush()

    # 全ての基準に対してスコアを提供
    rubric_scores = [RubricScore(criterion_id=c.id, score=4) for c in criteria]
    payload = ReviewSubmit(comment="Nice job", rubric_scores=rubric_scores)

    # Call submit_review directly
    review = submit_review(ra.id, payload, db=db, current_user=reviewer)

    assert review.comment == "Nice job"

    # Call received_reviews for the author
    received = received_reviews(assignment_id=assignment.id, db=db, current_user=author)
    assert isinstance(received, list)
    assert len(received) == 1
    r = received[0]
    assert r.comment == "Nice job"
    # similarity fields should be present (may be None)
    assert hasattr(r, "similarity_score")
    assert hasattr(r, "similarity_penalty_rate")
