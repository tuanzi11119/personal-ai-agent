"""Minimal structured logging with secret redaction."""

from __future__ import annotations

import logging
import re

from app.core.config import settings

_SECRET_PATTERNS = [
    re.compile(r"(sk-[A-Za-z0-9_\-]{8,})"),
    re.compile(r"(?i)(api[_-]?key[\"']?\s*[:=]\s*)([^\s\"',}]+)"),
    re.compile(r"(?i)(authorization\s*[:=]\s*bearer\s+)([^\s\"',}]+)"),
]


def redact_secrets(text: str) -> str:
    """Remove anything that looks like an API key from log/output text."""
    if not text:
        return text
    redacted = text
    for pattern in _SECRET_PATTERNS:
        if pattern.groups >= 2:
            redacted = pattern.sub(lambda m: m.group(1) + "***REDACTED***", redacted)
        else:
            redacted = pattern.sub("***REDACTED***", redacted)
    return redacted


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
