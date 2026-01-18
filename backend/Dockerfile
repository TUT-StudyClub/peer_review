FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml uv.lock /app/
RUN pip install --no-cache-dir -U pip uv && uv sync --python 3.12 --frozen

COPY app /app/app
COPY alembic /app/alembic
COPY alembic.ini /app/

CMD ["/bin/sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
