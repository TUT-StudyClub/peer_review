from uuid import uuid4
from datetime import datetime

from app.schemas.review import ReviewReceived


def test_review_received_allows_missing_similarity_fields():
    r = ReviewReceived(
        id=uuid4(),
        reviewer_alias="Rev",
        comment="Nice work",
        created_at=datetime.utcnow(),
        rubric_scores=[],
        meta_review=None,
        ai_quality_score=None,
        ai_quality_reason=None,
    )

    assert r.similarity_score is None
    assert r.similar_review_id is None
    assert r.similarity_warning is None
    assert r.similarity_penalty_rate is None
