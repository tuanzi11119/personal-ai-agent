"""Module C: knowledge base upload, listing, status and vector cleanup."""

from __future__ import annotations

from pathlib import Path

from app.core.database import SessionLocal
from app.models import Document, DocumentChunk
from conftest import create_agent, new_client, signup, upload_text

RESUME = (
    "张三的简历\n\n"
    "技能：熟悉 Python、FastAPI 和 PostgreSQL，了解 Redis 与 Docker。\n"
    "项目：2023 年负责简历解析服务，把 PDF 简历转成结构化 JSON。\n"
    "教育：2019 年毕业于浙江大学计算机专业。\n"
)


def test_txt_upload_is_parsed_and_indexed(client):
    signup(client)
    agent = create_agent(client)
    response = upload_text(client, agent["id"], RESUME)
    assert response.status_code == 201, response.text
    document = response.json()
    assert document["status"] == "ready"
    assert document["chunk_count"] >= 1
    assert document["error_message"] == ""
    assert "file_path" not in document, "storage paths must not leak to clients"
    with SessionLocal() as db:
        stored = db.get(Document, document["id"])
        assert stored is not None and Path(stored.file_path).exists()

    listing = client.get(f"/api/agents/{agent['id']}/documents")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1


def test_markdown_upload_works(client):
    signup(client)
    agent = create_agent(client)
    response = upload_text(client, agent["id"], "# 简历\n\n熟悉 TypeScript 和 React。", "resume.md")
    assert response.status_code == 201
    assert response.json()["file_type"] == "markdown"
    assert response.json()["status"] == "ready"


def test_unsupported_and_empty_files_are_rejected(client):
    signup(client)
    agent = create_agent(client)
    bad_type = upload_text(client, agent["id"], "binary", "malware.exe")
    assert bad_type.status_code == 422
    assert bad_type.json()["error"]["code"] == "validation_error"

    empty = upload_text(client, agent["id"], "", "empty.txt")
    assert empty.status_code == 422


def test_duplicate_upload_is_rejected(client):
    signup(client)
    agent = create_agent(client)
    assert upload_text(client, agent["id"], RESUME).status_code == 201
    duplicate = upload_text(client, agent["id"], RESUME)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_document"


def test_delete_document_removes_chunks_and_file(client):
    signup(client)
    agent = create_agent(client)
    document = upload_text(client, agent["id"], RESUME).json()
    with SessionLocal() as db:
        stored = db.get(Document, document["id"])
        file_path = Path(stored.file_path)
        assert file_path.exists()
        assert db.query(DocumentChunk).filter(DocumentChunk.document_id == document["id"]).count() > 0

    deleted = client.delete(f"/api/agents/{agent['id']}/documents/{document['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/agents/{agent['id']}/documents").json()["total"] == 0
    with SessionLocal() as db:
        assert db.query(DocumentChunk).filter(DocumentChunk.document_id == document["id"]).count() == 0
        assert db.query(Document).filter(Document.id == document["id"]).count() == 0
    assert not file_path.exists()


def test_other_user_cannot_touch_documents(client):
    signup(client, email="docowner@example.com")
    agent = create_agent(client)
    document = upload_text(client, agent["id"], RESUME).json()

    attacker = new_client()
    signup(attacker, email="docattacker@example.com")
    assert attacker.get(f"/api/agents/{agent['id']}/documents").status_code == 404
    assert upload_text(attacker, agent["id"], "intrusion").status_code == 404
    assert attacker.delete(f"/api/agents/{agent['id']}/documents/{document['id']}").status_code == 404


def test_dimension_mismatch_marks_document_as_error(client):
    signup(client)
    agent = create_agent(client)
    client.put(
        "/api/settings/llm",
        json={"embedding_model": "text-embedding-3-small", "embedding_dimension": 768},
    )
    response = upload_text(client, agent["id"], RESUME)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "error"
    assert "dimension" in body["error_message"].lower()
    assert body["chunk_count"] == 0
