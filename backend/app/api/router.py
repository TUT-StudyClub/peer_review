from fastapi import APIRouter

from app.api.routes import admin
from app.api.routes import assignments
from app.api.routes import auth
from app.api.routes import courses
from app.api.routes import grades
from app.api.routes import health
from app.api.routes import reviews
from app.api.routes import submissions
from app.api.routes import ta
from app.api.routes import users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
api_router.include_router(reviews.router, tags=["reviews"])
api_router.include_router(ta.router, tags=["ta"])
api_router.include_router(grades.router, tags=["grades"])
