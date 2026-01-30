from fastapi import BackgroundTasks
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.reviews import received_reviews
from app.api.routes.reviews import submit_review
from app.db.base import Base
from app.models.assignment import Assignment
from app.models.review import ReviewAssignment
from app.models.submission import Submission
from app.models.submission import SubmissionRubricScore
from app.models.user import User
from app.schemas.review import ReviewSubmit
from app.schemas.review import RubricScore
from app.services.rubric import ensure_fixed_rubric


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

    # ensure_fixed_rubricで作成されるルーブリック基準を取得
    rubric_criteria = ensure_fixed_rubric(db, assignment.id)

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

    # 全てのルーブリック基準に対してスコアを設定
    for criterion in rubric_criteria:
        teacher_score = SubmissionRubricScore(submission_id=submission.id, criterion_id=criterion.id, score=4)
        db.add(teacher_score)

    ra = ReviewAssignment(assignment_id=assignment.id, submission_id=submission.id, reviewer_id=reviewer.id)
    db.add(ra)
    db.flush()

    # 全てのルーブリック基準に対するスコアを含む
    rubric_scores = [RubricScore(criterion_id=c.id, score=4) for c in rubric_criteria]
    payload = ReviewSubmit(comment="Nice job", rubric_scores=rubric_scores)

    # Call submit_review directly with mock BackgroundTasks
    background_tasks = BackgroundTasks()
    review = submit_review(ra.id, payload, background_tasks=background_tasks, db=db, current_user=reviewer)

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
