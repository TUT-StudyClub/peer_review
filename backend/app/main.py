import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alembic import command
from alembic.config import Config
from app.api.router import api_router
from app.core.config import settings
from app.db.init_db import init_db

# ロギング設定
logging.basicConfig(level=logging.INFO, format="%(levelname)s:  %(message)s")
logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """起動時にAlembicマイグレーションを自動実行

    注意事項:
    - 本番環境でDDL権限がない場合は RUN_MIGRATIONS_ON_STARTUP=false を設定
    - 複数ワーカーで起動する場合は手動マイグレーション推奨
    - alembic.iniは __file__ からの相対パスで解決
    """
    if not settings.run_migrations_on_startup:
        logger.info("Automatic migrations disabled (RUN_MIGRATIONS_ON_STARTUP=false)")
        return

    try:
        # alembic.iniのパスを絶対パスで解決
        # backend/app/main.py -> backend/alembic.ini
        from pathlib import Path

        backend_dir = Path(__file__).parent.parent
        alembic_ini_path = backend_dir / "alembic.ini"

        if not alembic_ini_path.exists():
            logger.warning(f"alembic.ini not found at {alembic_ini_path}, skipping migrations")
            return

        alembic_cfg = Config(str(alembic_ini_path))
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Failed to run migrations: {e}")
        raise


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    init_db()
    logger.info("Application startup complete")
    yield
    logger.info("Application shutdown")


def create_app() -> FastAPI:
    app = FastAPI(title="pure-review", version="0.1.0", lifespan=lifespan)
    app.include_router(api_router)

    origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
    origin_regex = (settings.cors_allow_origin_regex or "").strip() or None
    if origins or origin_regex:
        app.add_middleware(
            CORSMiddleware,  # type: ignore[arg-type]
            allow_origins=origins or [],
            allow_origin_regex=origin_regex,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    return app


app = create_app()
