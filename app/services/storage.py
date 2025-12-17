from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.models.submission import SubmissionFileType


def ensure_storage_dir() -> Path:
    base = Path(settings.storage_dir)
    base.mkdir(parents=True, exist_ok=True)
    return base


def detect_file_type(upload: UploadFile) -> SubmissionFileType | None:
    filename = (upload.filename or "").lower()
    content_type = (upload.content_type or "").lower()

    if filename.endswith(".pdf") or content_type == "application/pdf":
        return SubmissionFileType.pdf
    if filename.endswith(".md") or "markdown" in content_type:
        return SubmissionFileType.markdown

    return None


def save_upload_file(
    *,
    upload: UploadFile,
    assignment_id,
    submission_id,
    file_type: SubmissionFileType,
) -> Path:
    base = ensure_storage_dir()
    assignment_dir = base / str(assignment_id)
    assignment_dir.mkdir(parents=True, exist_ok=True)

    extension = "pdf" if file_type == SubmissionFileType.pdf else "md"
    dest = assignment_dir / f"{submission_id}.{extension}"

    with dest.open("wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)

    return dest

