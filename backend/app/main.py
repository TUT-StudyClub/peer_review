from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.init_db import init_db


def create_app() -> FastAPI:
    app = FastAPI(title="pure-review", version="0.1.0")
    app.include_router(api_router, prefix="/api")

    origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
    origin_regex = (settings.cors_allow_origin_regex or "").strip() or None
    if origins or origin_regex:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins or [],
            allow_origin_regex=origin_regex,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    return app


app = create_app()
