from fastapi import FastAPI

from app.api.router import api_router
from app.db.init_db import init_db


def create_app() -> FastAPI:
    app = FastAPI(title="pure-review", version="0.1.0")
    app.include_router(api_router)

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    return app


app = create_app()
