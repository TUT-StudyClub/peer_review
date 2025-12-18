from fastapi import APIRouter

from app.schemas.debug import DebugValidateTitleDeadline

router = APIRouter()


@router.post("/validate")
def debug_validate(payload: DebugValidateTitleDeadline) -> dict:
    return {"ok": True}

