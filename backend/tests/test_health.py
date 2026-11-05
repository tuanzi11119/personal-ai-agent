"""Phase 1: health check and infrastructure wiring."""

from __future__ import annotations

from conftest import new_client


def test_health_reports_database_and_providers(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"]["ok"] is True
    assert body["database"]["vector_store"] == "sqlite-json+numpy"
    assert body["llm"]["mock_mode"] is True
    assert body["embedding"]["dimension"] == 384


def test_api_health_alias(client):
    assert client.get("/api/health").status_code == 200


def test_unknown_route_returns_structured_404(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert "error" in response.json()
