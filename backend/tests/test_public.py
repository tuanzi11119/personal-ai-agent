"""Module F: public sharing, publish toggle, visitor isolation, rate limit."""

from __future__ import annotations

from app.api import public as public_module
from conftest import create_agent, new_client, signup, upload_text

RESUME = "张三的简历\n\n技能：熟悉 Python、FastAPI 和 PostgreSQL。\n"


def _published_agent(client) -> dict:
    signup(client)
    agent = create_agent(client, name="Zhang San Twin", description="AI twin of Zhang San", is_public=True)
    assert upload_text(client, agent["id"], RESUME).status_code == 201
    return agent


def test_private_agent_is_not_reachable_publicly(client):
    signup(client)
    agent = create_agent(client, is_public=False)
    visitor = new_client()
    assert visitor.get(f"/api/public/agents/{agent['slug']}").status_code == 404
    assert visitor.post(f"/api/public/agents/{agent['slug']}/chat", json={"message": "hi"}).status_code == 404


def test_public_profile_hides_private_fields(client):
    agent = _published_agent(client)
    visitor = new_client()
    response = visitor.get(f"/api/public/agents/{agent['slug']}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Zhang San Twin"
    assert body["slug"] == agent["slug"]
    assert body["suggested_questions"]
    assert "system_prompt" not in body
    assert "user_id" not in body
    assert "document_count" not in body


def test_anonymous_visitor_can_chat(client):
    agent = _published_agent(client)
    visitor = new_client()
    response = visitor.post(f"/api/public/agents/{agent['slug']}/chat", json={"message": "张三熟悉什么技术？"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["conversation_id"]
    assert "Python" in body["message"]["content"]
    assert body["sources"]
    assert all(len(source["excerpt"]) <= 120 for source in body["sources"])
    assert "pai_visitor" in visitor.cookies


def test_visitors_cannot_read_each_other_conversations(client):
    agent = _published_agent(client)
    first = new_client()
    conversation_id = first.post(
        f"/api/public/agents/{agent['slug']}/chat", json={"message": "你好"}
    ).json()["conversation_id"]

    second = new_client()
    assert second.get(f"/api/public/agents/{agent['slug']}/conversations/{conversation_id}").status_code == 404
    hijack = second.post(
        f"/api/public/agents/{agent['slug']}/chat",
        json={"message": "继续", "conversation_id": conversation_id},
    )
    assert hijack.status_code == 404

    own = first.get(f"/api/public/agents/{agent['slug']}/conversations/{conversation_id}")
    assert own.status_code == 200
    assert len(own.json()["messages"]) == 2


def test_unpublishing_invalidates_link_immediately(client):
    agent = _published_agent(client)
    visitor = new_client()
    assert visitor.get(f"/api/public/agents/{agent['slug']}").status_code == 200
    client.patch(f"/api/agents/{agent['id']}", json={"is_public": False})
    assert visitor.get(f"/api/public/agents/{agent['slug']}").status_code == 404
    assert visitor.post(f"/api/public/agents/{agent['slug']}/chat", json={"message": "hi"}).status_code == 404


def test_public_chat_is_rate_limited(client, monkeypatch):
    agent = _published_agent(client)
    visitor = new_client()
    monkeypatch.setattr(public_module._public_limiter, "limit", 2)
    assert visitor.post(f"/api/public/agents/{agent['slug']}/chat", json={"message": "one"}).status_code == 200
    assert visitor.post(f"/api/public/agents/{agent['slug']}/chat", json={"message": "two"}).status_code == 200
    blocked = visitor.post(f"/api/public/agents/{agent['slug']}/chat", json={"message": "three"})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"


def test_unknown_slug_returns_404(client):
    visitor = new_client()
    assert visitor.get("/api/public/agents/does-not-exist").status_code == 404
