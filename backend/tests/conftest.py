"""Shared pytest fixtures.

Environment variables are set *before* importing the app so the settings object
points at a throw-away SQLite database and the offline mock providers.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="pai-tests-"))
_TMP.mkdir(parents=True, exist_ok=True)

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": "sqlite:///" + (_TMP / "test.db").as_posix(),
        "STORAGE_DIR": str(_TMP / "storage"),
        "SECRET_KEY": "test-secret-key-0123456789abcdef0123456789abcdef",
        "LLM_PROVIDER": "mock",
        "EMBEDDING_PROVIDER": "mock",
        "EMBEDDING_DIMENSION": "384",
        "AUTH_RATE_LIMIT_PER_MINUTE": "10000",
        "PUBLIC_RATE_LIMIT_PER_MINUTE": "10000",
        "MIN_RETRIEVAL_SCORE": "0.05",
    }
)

from fastapi.testclient import TestClient  # noqa: E402

from app.api import auth as auth_module  # noqa: E402
from app.api import public as public_module  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.models import Base  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    auth_module._auth_limiter.reset()
    public_module._public_limiter.reset()
    with TestClient(app) as test_client:
        yield test_client


def new_client() -> TestClient:
    """A second, cookie-isolated client (another user or another visitor)."""
    return TestClient(app)


def signup(client: TestClient, email: str | None = None, username: str = "Ada Lovelace") -> dict:
    email = email or f"user-{uuid.uuid4().hex[:10]}@example.com"
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return response.json()["user"]


def create_agent(client: TestClient, **overrides) -> dict:
    payload = {
        "name": "Ada AI",
        "description": "The AI twin of Ada Lovelace.",
        "is_public": False,
    }
    payload.update(overrides)
    response = client.post("/api/agents", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def upload_text(client: TestClient, agent_id: str, text: str, filename: str = "resume.txt"):
    return client.post(
        f"/api/agents/{agent_id}/documents",
        files={"file": (filename, text.encode("utf-8"), "text/plain")},
    )
