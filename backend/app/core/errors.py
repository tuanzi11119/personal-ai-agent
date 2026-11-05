"""Unified application errors mapped to a stable JSON envelope."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.logging import get_logger, redact_secrets

logger = get_logger(__name__)


class AppError(Exception):
    status_code: int = 400
    code: str = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class AuthError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationAppError(AppError):
    status_code = 422
    code = "validation_error"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


class UpstreamError(AppError):
    status_code = 502
    code = "upstream_error"


def error_payload(code: str, message: str, request: Request | None = None) -> dict:
    payload = {"error": {"code": code, "message": message}}
    if request is not None:
        payload["error"]["path"] = request.url.path
    return payload


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error("app error: %s %s", exc.code, redact_secrets(exc.message))
    else:
        logger.info("app error: %s %s", exc.code, redact_secrets(exc.message))
    return JSONResponse(status_code=exc.status_code, content=error_payload(exc.code, exc.message, request))
