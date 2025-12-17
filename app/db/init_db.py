from app.db.base import Base
from app.db.session import engine


def init_db() -> None:
    # Ensure all models are registered before creating tables.
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
