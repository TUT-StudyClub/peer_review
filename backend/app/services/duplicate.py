from __future__ import annotations

import hashlib
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.review import Review
from app.models.review import ReviewAssignment
from app.services.similarity import normalize_text


@dataclass
class DuplicateCheckResult:
    normalized_hash: str | None
    is_duplicate: bool
    duplicate_review_id: UUID | None
    penalty_rate: float
    warning_message: str | None


def _penalty_rate() -> float:
    try:
        rate = float(getattr(settings, "duplicate_penalty_rate", 0.0))
    except Exception:
        return 0.0
    return max(0.0, min(1.0, rate))


def canonicalize_comment(text: str) -> str:
    """レビュー本文を正規化（空白/改行/記号などを除去）して重複判定用の文字列を返す"""
    normalized = normalize_text(text or "")
    # 空白差分でハッシュ値が変わらないように空白を除去
    return normalized.replace(" ", "")


def hash_comment(text: str) -> str | None:
    canonical = canonicalize_comment(text)
    if not canonical:
        return None
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _ensure_hash(review: Review) -> str | None:
    """古いレビューにハッシュが無い場合はその場で計算して埋める"""
    if review.normalized_comment_hash:
        return review.normalized_comment_hash
    calculated = hash_comment(review.comment or "")
    review.normalized_comment_hash = calculated
    return calculated


def detect_duplicate_review(
    db: Session, *, reviewer_id: UUID, assignment_id: UUID, normalized_hash: str | None
) -> DuplicateCheckResult:
    if not normalized_hash:
        return DuplicateCheckResult(None, False, None, 0.0, None)

    existing = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(
            ReviewAssignment.assignment_id == assignment_id,
            ReviewAssignment.reviewer_id == reviewer_id,
            Review.normalized_comment_hash == normalized_hash,
        )
        .order_by(Review.created_at.asc())
        .first()
    )

    if existing is None:
        # 過去レビューにハッシュが無い場合でも検知できるように補完する
        candidates = (
            db.query(Review)
            .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
            .filter(
                ReviewAssignment.assignment_id == assignment_id,
                ReviewAssignment.reviewer_id == reviewer_id,
                Review.normalized_comment_hash.is_(None),
            )
            .order_by(Review.created_at.asc())
            .all()
        )
        for cand in candidates:
            if _ensure_hash(cand) == normalized_hash:
                existing = cand
                break

    if existing is None:
        return DuplicateCheckResult(normalized_hash, False, None, 0.0, None)

    warning = (
        "同一課題であなたが以前に送信したレビューと本文が一致します。"
        "コピペではなく具体的なフィードバックを書いてください。"
    )
    return DuplicateCheckResult(
        normalized_hash,
        True,
        existing.id,
        _penalty_rate(),
        warning,
    )
