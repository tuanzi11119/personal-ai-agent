"""Module B: agent CRUD and ownership isolation."""

from __future__ import annotations

from conftest import create_agent, new_client, signup


def test_agent_crud_flow(client):
    signup(client)
    agent = create_agent(client, name="Ada AI", description="Digital twin", is_public=False)
    assert agent["slug"]
    assert agent["public_path"] == "/a/" + agent["slug"]
    assert agent["document_count"] == 0

    listing = client.get("/api/agents")
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()] == [agent["id"]]

    detail = client.get(f"/api/agents/{agent['id']}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "Ada AI"

    patched = client.patch(
        f"/api/agents/{agent['id']}",
        json={"name": "Ada AI v2", "is_public": True, "system_prompt": "Be concise."},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Ada AI v2"
    assert patched.json()["is_public"] is True
    assert patched.json()["system_prompt"] == "Be concise."

    deleted = client.delete(f"/api/agents/{agent['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/agents/{agent['id']}").status_code == 404
    assert client.get("/api/agents").json() == []


def test_slugs_are_unique(client):
    signup(client)
    first = create_agent(client, name="Same Name")
    second = create_agent(client, name="Same Name")
    assert first["slug"] != second["slug"]


def test_invalid_avatar_is_rejected(client):
    signup(client)
    response = client.post("/api/agents", json={"name": "Bad Avatar", "avatar_url": "javascript:alert(1)"})
    assert response.status_code == 422


def test_other_user_cannot_touch_agent(client):
    signup(client, email="owner@example.com")
    agent = create_agent(client)

    attacker = new_client()
    signup(attacker, email="attacker@example.com")
    assert attacker.get(f"/api/agents/{agent['id']}").status_code == 404
    assert attacker.patch(f"/api/agents/{agent['id']}", json={"name": "Hacked"}).status_code == 404
    assert attacker.delete(f"/api/agents/{agent['id']}").status_code == 404
    assert attacker.get("/api/agents").json() == []


def test_agent_endpoints_require_auth(client):
    anonymous = new_client()
    assert anonymous.get("/api/agents").status_code == 401
    assert anonymous.post("/api/agents", json={"name": "Nope"}).status_code == 401
