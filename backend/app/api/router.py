from fastapi import APIRouter

from app.api.routes import assignments, auth, grades, health, reviews, submissions, users
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
api_router.include_router(reviews.router, tags=["reviews"])
api_router.include_router(grades.router, tags=["grades"])

if settings.app_env == "dev":
    from app.api.routes import debug

    api_router.include_router(debug.router, prefix="/debug", tags=["debug"])
