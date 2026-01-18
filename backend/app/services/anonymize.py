from __future__ import annotations

import hmac
from hashlib import sha256
from uuid import UUID

from app.core.config import settings


def alias_for_user(*, user_id: UUID, assignment_id: UUID, prefix: str) -> str:
    msg = f"{assignment_id}:{user_id}".encode()
    digest = hmac.new(settings.secret_key.encode("utf-8"), msg, sha256).hexdigest()[:8]
    return f"{prefix}_{digest}"
