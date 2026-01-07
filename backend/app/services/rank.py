from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from app.core.config import USER_RANK_DEFINITIONS


@dataclass(frozen=True)
class UserRank:
    key: str
    title: str
    min_credits: int


@lru_cache(maxsize=1)
def _load_rank_definitions() -> tuple[UserRank, ...]:
    ranks: list[UserRank] = []
    for item in USER_RANK_DEFINITIONS:
        try:
            key = str(item["key"])
            title = str(item["title"])
            min_credits = int(item["min_credits"])
        except (KeyError, TypeError, ValueError):
            continue
        ranks.append(UserRank(key=key, title=title, min_credits=max(0, min_credits)))

    if not ranks:
        ranks = [UserRank(key="novice", title="Novice Reviewer", min_credits=0)]

    ranks.sort(key=lambda r: r.min_credits)
    return tuple(ranks)


def get_user_rank(credit_value: int | None) -> UserRank:
    safe_credits = int(credit_value or 0)
    safe_credits = max(safe_credits, 0)

    ranks = _load_rank_definitions()
    current = ranks[0]
    for rank in ranks:
        if safe_credits >= rank.min_credits:
            current = rank
    return current
