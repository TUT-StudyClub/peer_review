from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.review import Review
from app.models.review import ReviewAssignment

if TYPE_CHECKING:
    pass


# =============================================================================
# 設定値
# =============================================================================
SIMILARITY_THRESHOLD = getattr(settings, "similarity_threshold", 0.5)
SIMILARITY_PENALTY_ENABLED = getattr(settings, "similarity_penalty_enabled", True)
NGRAM_N = getattr(settings, "similarity_ngram_n", 2)


# =============================================================================
# テキスト正規化
# =============================================================================


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u3000", " ")
    text = re.sub(r"[\n\r\t]+", " ", text)
    text = re.sub(r"[!-/:-@\[-`{-~]", " ", text)
    text = re.sub(r"[！-／：-＠［-｀｛-～、。・「」『』【】（）｛｝]", " ", text)
    text = re.sub(r"[\U00010000-\U0010ffff]", "", text)
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# =============================================================================
# トークン化（文字N-gram）
# =============================================================================


def tokenize(text: str, ngram_n: int = NGRAM_N) -> set[str]:
    normalized = normalize_text(text)
    normalized = normalized.replace(" ", "")
    if not normalized or len(normalized) < ngram_n:
        return {normalized} if normalized else set()
    tokens = set()
    for i in range(len(normalized) - ngram_n + 1):
        tokens.add(normalized[i : i + ngram_n])
    return tokens


# =============================================================================
# Jaccard係数
# =============================================================================


def jaccard_similarity(set_a: set[str], set_b: set[str]) -> float:
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    if len(union) == 0:
        return 0.0
    return len(intersection) / len(union)


# =============================================================================
# 結果データクラス
# =============================================================================


@dataclass
class SimilarityResult:
    is_similar: bool
    similarity: float
    similar_review_id: UUID | None
    penalty_rate: float
    warning_message: str | None

    def to_dict(self) -> dict:
        return {
            "is_similar": self.is_similar,
            "similarity": round(self.similarity, 3),
            "similar_review_id": str(self.similar_review_id) if self.similar_review_id else None,
            "penalty_rate": round(self.penalty_rate, 3),
            "warning_message": self.warning_message,
        }


# =============================================================================
# 類似検知本体
# =============================================================================


def check_similarity(
    db: Session,
    *,
    assignment_id: UUID,
    new_comment: str,
    threshold: float = SIMILARITY_THRESHOLD,
    penalty_enabled: bool = SIMILARITY_PENALTY_ENABLED,
) -> SimilarityResult:
    new_tokens = tokenize(new_comment)
    if not new_tokens:
        return SimilarityResult(False, 0.0, None, 0.0, None)

    past_reviews = (
        db.query(Review)
        .join(ReviewAssignment, ReviewAssignment.id == Review.review_assignment_id)
        .filter(ReviewAssignment.assignment_id == assignment_id)
        .all()
    )

    max_similarity = 0.0
    most_similar_review_id: UUID | None = None

    for review in past_reviews:
        past_tokens = tokenize(review.comment)
        if not past_tokens:
            continue
        similarity = jaccard_similarity(new_tokens, past_tokens)
        if similarity > max_similarity:
            max_similarity = similarity
            most_similar_review_id = review.id

    is_similar = max_similarity >= threshold
    penalty_rate = max_similarity if (is_similar and penalty_enabled) else 0.0
    warning_message = None
    if is_similar:
        warning_message = (
            f"類似度{max_similarity:.0%}のレビューが検知されました。オリジナルのレビューを心がけてください。"
        )

    return SimilarityResult(is_similar, max_similarity, most_similar_review_id, penalty_rate, warning_message)


def apply_similarity_penalty(base_score: float, penalty_rate: float) -> float:
    return max(0.0, base_score * (1 - penalty_rate))
