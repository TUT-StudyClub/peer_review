from __future__ import annotations

from dataclasses import dataclass
import logging
import os
from pathlib import Path
import tempfile
from typing import Iterable

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from starlette.background import BackgroundTask

from app.core.config import settings
from app.models.submission import SubmissionFileType

logger = logging.getLogger(__name__)


@dataclass
class StoredUpload:
    storage_path: str
    local_path: Path
    cleanup_path: Path | None = None

    def cleanup(self) -> None:
        if not self.cleanup_path:
            return
        try:
            self.cleanup_path.unlink()
        except FileNotFoundError:
            return
        except OSError:
            logger.warning("Failed to cleanup temp file: %s", self.cleanup_path, exc_info=True)


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
) -> StoredUpload:
    extension = "pdf" if file_type == SubmissionFileType.pdf else "md"
    if _is_s3_backend():
        bucket = _require_s3_bucket()
        key = _build_s3_key(assignment_id=assignment_id, submission_id=submission_id, extension=extension)
        temp_path = _create_temp_path(suffix=f".{extension}")
        _write_upload_to_path(upload, temp_path)
        try:
            _upload_file_to_s3(local_path=temp_path, bucket=bucket, key=key)
        except Exception as exc:
            logger.error("S3 upload failed for %s", key, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to upload file") from exc
        storage_path = f"s3://{bucket}/{key}"
        return StoredUpload(storage_path=storage_path, local_path=temp_path, cleanup_path=temp_path)

    base = ensure_storage_dir()
    assignment_dir = base / str(assignment_id)
    assignment_dir.mkdir(parents=True, exist_ok=True)
    dest = assignment_dir / f"{submission_id}.{extension}"
    _write_upload_to_path(upload, dest)
    return StoredUpload(storage_path=str(dest), local_path=dest)


def build_download_response(*, storage_path: str, filename: str, media_type: str):
    if storage_path.startswith("s3://"):
        bucket, key = _parse_s3_uri(storage_path)
        return _stream_s3_object(bucket=bucket, key=key, filename=filename, media_type=media_type)

    path = Path(storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(storage_path, filename=filename, media_type=media_type)


def _is_s3_backend() -> bool:
    return settings.storage_backend.lower() == "s3" or bool(settings.s3_bucket)


def _require_s3_bucket() -> str:
    if not settings.s3_bucket:
        raise HTTPException(status_code=500, detail="S3_BUCKET is required for s3 storage")
    return settings.s3_bucket


def _build_s3_key(*, assignment_id, submission_id, extension: str) -> str:
    prefix = settings.s3_key_prefix.strip("/")
    parts = [p for p in [prefix, str(assignment_id)] if p]
    base = "/".join(parts)
    return f"{base}/{submission_id}.{extension}" if base else f"{submission_id}.{extension}"


def _write_upload_to_path(upload: UploadFile, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)


def _create_temp_path(*, suffix: str) -> Path:
    fd, name = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    return Path(name)


def _get_s3_client():
    config = None
    if settings.s3_use_path_style:
        config = Config(s3={"addressing_style": "path"})
    session = boto3.session.Session(region_name=settings.s3_region or None)
    return session.client("s3", endpoint_url=settings.s3_endpoint_url or None, config=config)


def _upload_file_to_s3(*, local_path: Path, bucket: str, key: str) -> None:
    client = _get_s3_client()
    client.upload_file(str(local_path), bucket, key)


def _parse_s3_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("s3://"):
        raise HTTPException(status_code=500, detail="Invalid storage path")
    rest = uri[5:]
    bucket, _, key = rest.partition("/")
    if not bucket or not key:
        raise HTTPException(status_code=500, detail="Invalid S3 storage path")
    return bucket, key


def _stream_s3_object(*, bucket: str, key: str, filename: str, media_type: str):
    client = _get_s3_client()
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in {"NoSuchKey", "404"}:
            raise HTTPException(status_code=404, detail="File not found") from exc
        raise HTTPException(status_code=500, detail="Failed to download file") from exc

    body = obj["Body"]

    def iter_body() -> Iterable[bytes]:
        while True:
            chunk = body.read(1024 * 1024)
            if not chunk:
                break
            yield chunk

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        iter_body(),
        media_type=media_type,
        headers=headers,
        background=BackgroundTask(body.close),
    )
