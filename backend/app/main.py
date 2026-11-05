"""FastAPI application entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import agents, auth, chat, documents, jobs, public, settings_api
from app.core.config import settings
from app.core.database import engine, get_dialect_name, session_scope
from app.core.errors import AppError, app_error_handler, error_payload
from app.core.logging import configure_logging, get_logger, redact_secrets
from app.models import Base
from app.services.job_sync import sync_job_sources

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    settings.uploads_path.mkdir(parents=True, exist_ok=True)
    if settings.is_sqlite:
        # Local/dev convenience: SQLite has no migration step in docker-less setups.
        # PostgreSQL deployments always use Alembic (alembic upgrade head).
        Base.metadata.create_all(engine)
        logger.info("SQLite schema ensured at %s", settings.resolved_database_url)
    with session_scope() as db:
        sync_job_sources(db)
    logger.info(
        "LLM provider=%s embedding provider=%s dimension=%s",
        settings.effective_llm_provider,
        settings.effective_embedding_provider,
        settings.embedding_dimension,
    )
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Create a personal AI twin backed by your own knowledge base.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)


_HTTP_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    429: "rate_limited",
}


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _HTTP_STATUS_CODES.get(exc.status_code, f"http_{exc.status_code}")
    detail = exc.detail if isinstance(exc.detail, str) and exc.detail else "Request failed."
    return JSONResponse(status_code=exc.status_code, content=error_payload(code, detail, request))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    location = ".".join(str(part) for part in first.get("loc", []) if part != "body")
    message = first.get("msg", "Invalid request payload.")
    detail = f"{location}: {message}" if location else message
    return JSONResponse(status_code=422, content=error_payload("validation_error", detail, request))


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error on %s: %s", request.url.path, redact_secrets(str(exc)))
    return JSONResponse(
        status_code=500,
        content=error_payload("internal_error", "Something went wrong. Please try again later.", request),
    )


@app.get("/health", tags=["system"])
def health() -> dict:
    database_ok = True
    database_error = ""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - health check must never raise
        database_ok = False
        database_error = redact_secrets(str(exc))[:200]

    return {
        "status": "ok" if database_ok else "degraded",
        "app": settings.app_name,
        "env": settings.app_env,
        "database": {
            "dialect": get_dialect_name(),
            "vector_store": "pgvector" if get_dialect_name() == "postgresql" else "sqlite-json+numpy",
            "ok": database_ok,
            "error": database_error,
        },
        "llm": {
            "provider": settings.effective_llm_provider,
            "model": None
            if settings.effective_llm_provider == "mock"
            else settings.platform_llm_model,
            "mock_mode": settings.effective_llm_provider == "mock",
        },
        "embedding": {
            "provider": settings.effective_embedding_provider,
            "dimension": settings.embedding_dimension,
            "model": None
            if settings.effective_embedding_provider == "mock"
            else settings.platform_embedding_model,
        },
    }


@app.get("/api/health", tags=["system"])
def api_health() -> dict:
    return health()


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(agents.router, prefix=settings.api_prefix)
app.include_router(documents.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(public.router, prefix=settings.api_prefix)
app.include_router(settings_api.router, prefix=settings.api_prefix)
app.include_router(jobs.router, prefix=settings.api_prefix)
