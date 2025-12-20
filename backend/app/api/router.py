from fastapi import APIRouter

from app.api.routes import assignments, auth, courses, grades, health, reviews, submissions, ta, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
api_router.include_router(reviews.router, tags=["reviews"])
api_router.include_router(ta.router, tags=["ta"])
api_router.include_router(grades.router, tags=["grades"])
