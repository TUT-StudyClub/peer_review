import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.review import Review, ReviewAssignment
from app.services.similarity import check_similarity


def make_in_memory_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_check_similarity_detects_copy():
    db = make_in_memory_session()

    assignment_id = uuid.uuid4()
    ra_id = uuid.uuid4()

    # insert a past review
    ra = ReviewAssignment(id=ra_id, assignment_id=assignment_id, submission_id=uuid.uuid4(), reviewer_id=uuid.uuid4())
    db.add(ra)
    db.flush()

    r = Review(review_assignment_id=ra_id, comment="この論文は手法の説明が丁寧でわかりやすい")
    db.add(r)
    db.commit()

    # check similarity with a very similar comment
    res = check_similarity(db, assignment_id=assignment_id, new_comment="この論文は手法の説明が丁寧でわかりやすい")
    assert res.similarity > 0.9
    assert res.is_similar is True


def test_check_similarity_no_past_reviews():
    db = make_in_memory_session()
    assignment_id = uuid.uuid4()

    res = check_similarity(db, assignment_id=assignment_id, new_comment="独立したコメントです")
    assert res.similarity == 0.0
    assert res.is_similar is False
