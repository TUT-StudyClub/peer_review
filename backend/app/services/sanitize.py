from __future__ import annotations

import re
import textwrap
from pathlib import Path
from typing import Iterable

import pdfplumber
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _mask(_: str) -> str:
    return "[REDACTED]"


def _apply_patterns(text: str, patterns: Iterable[re.Pattern[str]]) -> str:
    result = text
    for pat in patterns:
        result = pat.sub(_mask, result)
    return result


def redact_personal_info(text: str) -> str:
    """
    Remove obvious personal identifiers (names, student IDs, emails) from text.

    This is a heuristic; it will not catch all cases.
    """
    patterns = [
        re.compile(r"(氏名|名前|Name)\s*[:：]\s*[^\n]+", re.IGNORECASE),
        re.compile(r"(学籍番号|Student\s*ID)\s*[:：]?\s*[A-Za-z0-9\-]{4,}", re.IGNORECASE),
        _EMAIL_RE,
    ]
    return _apply_patterns(text, patterns)


def sanitize_pdf_file(path: Path) -> tuple[str | None, bool]:
    """
    Extract text from PDF, redact personal info, and overwrite with a sanitized PDF.

    Returns (sanitized_text or None, modified_flag).
    """
    try:
        with pdfplumber.open(path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        return None, False

    if not text.strip():
        return None, False

    redacted = redact_personal_info(text)
    if redacted == text:
        return redacted, False

    # Write a simple text-only PDF with redacted content
    buf_path = path
    c = canvas.Canvas(str(buf_path), pagesize=A4)
    width, height = A4
    margin = 40
    max_width_chars = 100  # approximate for default font
    y = height - margin
    lines = []
    for paragraph in redacted.splitlines():
        if not paragraph.strip():
            lines.append("")
            continue
        lines.extend(textwrap.wrap(paragraph, width=max_width_chars) or [""])

    for line in lines:
        if y < margin:
            c.showPage()
            y = height - margin
        c.drawString(margin, y, line)
        y -= 14
    c.save()
    return redacted, True
