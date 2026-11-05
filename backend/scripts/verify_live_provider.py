"""Verify the live (non-mock) LLM + embedding provider path end to end.

Prereqs: backend running on :8000, fake provider running on :9099
    .venv/Scripts/python.exe scripts/fake_openai_provider.py
Run:    .venv/Scripts/python.exe scripts/verify_live_provider.py
"""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path

import httpx

BACKEND = "http://127.0.0.1:8000"
FAKE = "http://127.0.0.1:9099"
FAKE_KEY = "sk-test-0123456789abcdef"
results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> None:
    results.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + ((" | " + detail) if detail else ""))


def main() -> int:
    client = httpx.Client(base_url=BACKEND, timeout=60.0, trust_env=False)

    # 0. backend ready
    for _ in range(40):
        try:
            if client.get("/health").status_code == 200:
                break
        except httpx.HTTPError:
            time.sleep(0.5)
    else:
        check(False, "backend_health", "http://127.0.0.1:8000/health unreachable")
        return summarize()

    # 1. register
    email = f"live-{uuid.uuid4().hex[:10]}@example.com"
    r = client.post("/api/auth/register", json={"username": "live tester", "email": email, "password": "Passw0rd!123"})
    check(r.status_code == 201, "register", f"status={r.status_code}")
    token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    # 2. configure the fake provider as the user's chat + embedding provider
    payload = {
        "base_url": f"{FAKE}/v1",
        "api_key": FAKE_KEY,
        "model_name": "fake-gpt-4o",
        "temperature": 0.2,
        "max_tokens": 300,
        "embedding_base_url": f"{FAKE}/v1",
        "embedding_api_key": FAKE_KEY,
        "embedding_model": "fake-embed-384",
        "embedding_dimension": 384,
    }
    r = client.put("/api/settings/llm", json=payload, headers=auth)
    body = r.json()
    check(r.status_code == 200, "settings_put", f"status={r.status_code}")
    check(FAKE_KEY not in r.text, "settings_put_hides_key", "full key absent from response")
    check(body.get("has_api_key") is True and body.get("api_key_hint", "") != FAKE_KEY, "settings_key_masked", f"hint={body.get('api_key_hint')!r}")
    check(body.get("has_custom_config") is True, "settings_has_custom_config", str(body.get("has_custom_config")))

    r = client.get("/api/settings/llm", headers=auth)
    check(r.status_code == 200 and FAKE_KEY not in r.text, "settings_get_hides_key", f"status={r.status_code}")

    # 3. connectivity probe goes through the real HTTP client
    r = client.post("/api/settings/llm/test", headers=auth)
    t = r.json()
    check(r.status_code == 200 and t.get("ok") is True and t.get("mode") == "live", "llm_test_live", f"{r.status_code} {t}")
    check(FAKE_KEY not in r.text, "llm_test_hides_key", "")

    # 4. agent + knowledge base (embeddings now come from the fake HTTP endpoint)
    r = client.post("/api/agents", json={"name": "Live provider agent", "description": "d", "system_prompt": "你是候选人的 AI 助手。", "is_public": True}, headers=auth)
    check(r.status_code == 201, "agent_create", f"status={r.status_code}")
    agent = r.json()
    agent_id = agent["id"]

    text = "张三熟悉 Python、FastAPI 和 PostgreSQL。2021 年加入 Acme 公司，负责后端服务。\n"
    files = {"file": ("resume.txt", text.encode("utf-8"), "text/plain")}
    r = client.post(f"/api/agents/{agent_id}/documents", files=files, headers=auth)
    doc = r.json() if r.status_code < 500 else {}
    check(r.status_code in (200, 201) and doc.get("status") == "ready", "document_ingested_with_http_embeddings", f"{r.status_code} status={doc.get('status')} chunks={doc.get('chunk_count')} err={doc.get('error_message')}")

    # 5. chat uses the live provider and returns sources
    r = client.post(f"/api/agents/{agent_id}/chat", json={"message": "张三熟悉什么技术？", "top_k": 4}, headers=auth)
    body = r.json() if r.status_code == 200 else {}
    msg = body.get("message", {}).get("content", "")
    check(r.status_code == 200 and body.get("mode") == "live", "chat_mode_live", f"status={r.status_code} mode={body.get('mode')}")
    check("[LIVE-PROVIDER:fake-gpt-4o]" in msg, "chat_answer_from_fake_provider", msg[:90])
    check(len(body.get("sources", [])) > 0, "chat_returns_sources", f"n={len(body.get('sources', []))}")
    check(FAKE_KEY not in r.text, "chat_hides_key", "")

    # 6. bad key/endpoint -> mapped 502, no secret leakage
    bad = dict(payload)
    bad["model_name"] = "fake-fail401"
    client.put("/api/settings/llm", json=bad, headers=auth)
    r = client.post("/api/settings/llm/test", headers=auth)
    err = r.json().get("error", {}) if r.headers.get("content-type", "").startswith("application/json") else {}
    check(r.status_code == 502 and err.get("code") == "llm_error", "llm_test_maps_401_to_502", f"status={r.status_code} code={err.get('code')} msg={err.get('message')}")
    check("sk-test-leaked-0000" not in r.text and FAKE_KEY not in r.text, "llm_error_redacts_key", err.get("message", "")[:80])

    # restore a working config for the chat check below (not needed further, but keep state clean)
    client.put("/api/settings/llm", json=payload, headers=auth)

    # 7. stored key is Fernet ciphertext, not plaintext
    db_path = Path(__file__).resolve().parent.parent / "storage" / "app.db"
    cipher = None
    if db_path.exists():
        con = sqlite3.connect(db_path)
        row = con.execute(
            "select c.api_key_encrypted from user_llm_configs c join users u on u.id = c.user_id where u.email = ?",
            (email,),
        ).fetchone()
        con.close()
        cipher = row[0] if row else None
    check(cipher is not None and cipher != FAKE_KEY and cipher.startswith("gAAAA"), "api_key_encrypted_at_rest", (cipher or "")[:18] + "...")

    # 8. the fake provider was really called over HTTP
    stats = httpx.get(f"{FAKE}/stats", timeout=10.0, trust_env=False).json()
    check(stats["chat"] >= 3, "fake_provider_chat_calls", json.dumps(stats))
    check(stats["embed"] >= 2, "fake_provider_embedding_calls", json.dumps(stats))

    return summarize()


def summarize() -> int:
    passed = sum(1 for ok, _, _ in results if ok)
    print(f"SUMMARY passed={passed} failed={len(results) - passed} total={len(results)}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
