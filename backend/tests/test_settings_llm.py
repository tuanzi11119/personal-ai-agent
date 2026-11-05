"""Module E: per-user LLM config, key secrecy and failure handling."""

from __future__ import annotations

from app.core.database import SessionLocal
from app.models import UserLLMConfig
from conftest import create_agent, signup, upload_text

SECRET_KEY = "sk-test-super-secret-value-123456"


def test_default_settings_report_platform_mock_mode(client):
    signup(client)
    response = client.get("/api/settings/llm")
    assert response.status_code == 200
    body = response.json()
    assert body["has_custom_config"] is False
    assert body["has_api_key"] is False
    assert body["platform_mode"] == "mock"
    assert body["configured_dimension"] == 384
    assert body["api_key_hint"] == ""


def test_api_key_is_encrypted_and_never_returned(client):
    signup(client, email="keys@example.com")
    response = client.put(
        "/api/settings/llm",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": SECRET_KEY,
            "model_name": "gpt-4o-mini",
            "temperature": 0.2,
            "max_tokens": 500,
        },
    )
    assert response.status_code == 200, response.text
    assert SECRET_KEY not in response.text
    body = response.json()
    assert body["has_api_key"] is True
    assert body["has_custom_config"] is True
    assert body["api_key_hint"] == "sk-...56" or body["api_key_hint"].endswith("56")
    assert body["api_key_hint"] != SECRET_KEY

    with SessionLocal() as db:
        stored = db.query(UserLLMConfig).filter(UserLLMConfig.model_name == "gpt-4o-mini").one()
        assert stored.api_key_encrypted
        assert SECRET_KEY not in stored.api_key_encrypted

    listing = client.get("/api/settings/llm")
    assert SECRET_KEY not in listing.text


def test_invalid_provider_fails_clearly_without_leaking_key(client):
    signup(client, email="badkey@example.com")
    client.put(
        "/api/settings/llm",
        json={
            "base_url": "http://127.0.0.1:9/v1",
            "api_key": SECRET_KEY,
            "model_name": "gpt-4o-mini",
        },
    )
    agent = create_agent(client)
    response = client.post(f"/api/agents/{agent['id']}/chat", json={"message": "hello"})
    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "llm_error"
    assert SECRET_KEY not in response.text
    assert "unreachable" in body["error"]["message"].lower()


def test_key_can_be_cleared(client):
    signup(client)
    client.put(
        "/api/settings/llm",
        json={"base_url": "https://api.example.com/v1", "api_key": SECRET_KEY, "model_name": "m"},
    )
    cleared = client.put("/api/settings/llm", json={"api_key": ""})
    assert cleared.status_code == 200
    assert cleared.json()["has_api_key"] is False


def test_embedding_dimension_must_match_index(client):
    signup(client)
    agent = create_agent(client)
    client.put("/api/settings/llm", json={"embedding_model": "text-embedding-3-small", "embedding_dimension": 1536})
    document = upload_text(client, agent["id"], "熟悉 Python 和 FastAPI。").json()
    assert document["status"] == "error"
    assert "dimension" in document["error_message"].lower()


def test_settings_require_authentication(client):
    from conftest import new_client

    anonymous = new_client()
    assert anonymous.get("/api/settings/llm").status_code == 401
    assert anonymous.put("/api/settings/llm", json={}).status_code == 401
