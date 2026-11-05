# Personal AI Agent Platform

中文说明见 [README.zh-CN.md](README.zh-CN.md)。

A multi-user platform where anyone can turn their resume, notes and projects into a
personal **AI digital twin** that other people can interview through a public link.

The MVP delivers a closed product loop: sign up → create an agent (persona + knowledge
base) → chat in the playground → publish a shareable `/a/<slug>` page → visitors talk to
the twin without an account.

> This is a **RAG + persona prompt** product. No fine-tuning, LoRA or distillation is
> involved (see "Not in scope").

---

## 1. Features

| Area | What works |
| --- | --- |
| Auth | Register / login / logout, bcrypt password hashing, HS256 JWT in an httpOnly cookie (`pai_token`) or `Authorization: Bearer`, `GET /api/auth/me` |
| Agents | Full CRUD, unique slug, public/private switch, persona `system_prompt`, avatar URL, suggested questions |
| Knowledge base | Upload PDF / TXT / Markdown (max 10 MB), parse → chunk (800 chars, 150 overlap) → embed → store, per-document status (`pending`/`processing`/`ready`/`error`), delete removes chunks + file, SHA-256 duplicate detection |
| RAG chat | Query embedding → scoped vector search (`agent_id` filter) → score cut-off → context window → platform guardrails + persona prompt → OpenAI-compatible chat completion → answer + cited sources, multi-turn history |
| Model config | Per-user OpenAI-compatible base URL / key / model / temperature / max tokens + a separate embedding config; keys encrypted with Fernet, never returned to the browser |
| Public sharing | `/a/<slug>` ChatGPT-style page, anonymous chatting, visitor cookie isolation, per-IP rate limit, truncated source excerpts, immediate revocation when unpublished |
| Ops | `/health` endpoint, unified error envelope, request logging with secret redaction, Alembic migration, Docker Compose |

## 2. Architecture

```
Browser
  │  (same-origin, cookies)
  ▼
Next.js 15 app router  ──rewrite /api/*──▶  FastAPI (uvicorn)
  │                                            │
  │                                            ├── services: rag / llm / embedding / document
  │                                            ├── repositories: chunk search, conversations
  │                                            ▼
  │                                     SQLAlchemy 2.0 ORM
  │                                            │
  │                              ┌─────────────┴──────────────┐
  │                              ▼                            ▼
  │                    PostgreSQL + pgvector            SQLite (dev fallback)
  │                    (cosine distance `<=>`)          (JSON vectors + numpy cosine)
  ▼
storage/uploads/<agent>/<document>  (PDF/TXT/MD originals)
```

The database layer is intentionally dialect-aware: production uses PostgreSQL with the
`vector` extension, while a local run without Docker falls back to SQLite where vectors are
stored as JSON and scored with numpy. Both paths always filter on `document_chunks.agent_id`,
so a knowledge base can never leak across agents or users.

**Stack**: Next.js 15 + React 19 + TypeScript + Tailwind CSS (shadcn-style components),
FastAPI + SQLAlchemy 2 + Pydantic v2, PostgreSQL 16 + pgvector, Alembic, Docker Compose.

**UI language**: the whole interface is Simplified Chinese (the landing page keeps the required
English tagline `Create Your Personal AI Twin` as small print). Backend errors keep a stable
English `error.code`; `frontend/lib/api.ts` translates them for display, so API clients still see
predictable machine-readable codes.

## 3. Quick start with Docker

```bash
cp .env.example .env          # REQUIRED: SECRET_KEY, POSTGRES_PASSWORD, PUBLIC_ORIGIN
docker compose up -d --build
```

* App (frontend + API through one origin): <http://localhost:3000>
* Health: <http://localhost:3000/api/health>

Compose starts PostgreSQL 16 + pgvector, runs `alembic upgrade head` and then uvicorn, and
serves the Next.js production build. Only the frontend is published; Next.js proxies `/api/*`
to the backend over the compose network, so the auth cookie stays first-party.

> **Verified status**: the compose stack is live in production — **http://159.75.187.199**
> (Tencent Cloud Lighthouse, Ubuntu 20.04, PostgreSQL 16 + pgvector, `HTTP_PORT=80`). On the host,
> `docker compose up -d --build` ran `alembic upgrade head`, all three containers report healthy,
> an uploaded document reached `ready`, and chat answered from the pgvector-scored chunks.
> The build machine itself has no Docker, so local work still uses the SQLite path below.
>
> Keep in mind on that deployment: it is HTTP only (no domain/TLS yet) and the server ships with
> **mock** providers until a user saves their own key under 模型设置 — `api.deepseek.com` and
> `dashscope.aliyuncs.com` are reachable from the host, `api.openai.com` is not.
>
> Deployment notes worth knowing:
> * `BACKEND_URL` is a **build arg** (`frontend/Dockerfile`) — Next.js bakes `rewrites()` into
>   `.next/routes-manifest.json` at build time, so setting it only at container runtime does
>   nothing. This was measured locally.
> * The backend runs uvicorn with `--proxy-headers --forwarded-allow-ips='*'` so per-IP rate
>   limiting sees real visitor IPs behind nginx.
> * `COOKIE_SECURE=true` only works over HTTPS; on plain `http://IP:3000` it must stay `false`.
>
> Full Tencent Cloud walkthrough: [DEPLOY_TENCENT.md](DEPLOY_TENCENT.md).

## 4. Local development (no Docker) — the verified path

### 4.1 Backend

```bash
cd backend
python -m venv .venv                 # Python 3.11+
.venv/Scripts/activate               # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env                 # set SECRET_KEY, leave LLM keys empty for mock mode
python scripts/init_db.py            # SQLite: create tables; PostgreSQL: alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 4.2 Frontend

```bash
cd frontend
pnpm install
pnpm dev                             # http://localhost:3000
```

`next.config.ts` proxies `/api/*` to `BACKEND_URL` (default `http://127.0.0.1:8000`), so the
browser only ever talks to one origin and the auth cookie stays first-party.

For a production-like run: `pnpm build && pnpm start`.

### 4.3 Database migrations (PostgreSQL)

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://pai:pai_password@localhost:5432/pai
alembic upgrade head
```

`0001_initial` creates the `vector` extension, all tables, indexes and the ivfflat cosine
index. On SQLite the app creates the schema on startup (dev convenience only).

## 5. Environment variables

All are optional; defaults run the app in mock mode on SQLite. Copy `.env.example` →
`backend/.env` (local) or `.env` (Docker Compose).

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | dev value | Signs JWTs and derives the API-key encryption key. **Change in production.** |
| `DATABASE_URL` | `sqlite:///./storage/app.db` | `postgresql+psycopg://user:pass@host:5432/db` for pgvector |
| `STORAGE_DIR` | `./storage` | Uploaded files |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated origins |
| `MAX_UPLOAD_MB` / `ALLOWED_EXTENSIONS` | `10` / `.pdf,.txt,.md,.markdown` | Upload limits |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `800` / `150` | Chunking |
| `DEFAULT_TOP_K` / `MAX_TOP_K` | `5` / `12` | Retrieval depth |
| `MIN_RETRIEVAL_SCORE` | `0.15` | Cosine cut-off for real embeddings |
| `MOCK_MIN_RETRIEVAL_SCORE` | `0.08` | Cut-off used by the offline mock embedder |
| `MAX_CONTEXT_CHARS` / `MAX_HISTORY_MESSAGES` | `6000` / `12` | Prompt budget |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | `20` | Per-IP limit on public chat |
| `LLM_PROVIDER` | `auto` | `auto` uses a real provider only when a platform key exists, else `mock` |
| `PLATFORM_LLM_BASE_URL` / `_API_KEY` / `_MODEL` | OpenAI defaults | Platform default chat model |
| `EMBEDDING_PROVIDER` | `auto` | Same semantics as `LLM_PROVIDER` |
| `PLATFORM_EMBEDDING_BASE_URL` / `_API_KEY` / `_MODEL` | OpenAI defaults | Platform default embedding model |
| `EMBEDDING_DIMENSION` | `384` | Must match the pgvector column; changing it requires re-indexing |

## 6. Mock mode vs. real models

Without API keys the platform runs in **mock mode** and says so explicitly:

* **Embeddings**: a deterministic hashed bag-of-ngrams vector (latin words + CJK uni/bi-grams,
  blake2b bucketing, L2 normalised). It is *lexical*, not semantic: paraphrases can miss.
* **LLM**: instead of generating text, the answer quotes the retrieved passages behind a Chinese
  banner (`【Mock 模式 · 尚未接入真实模型…】`). The API also returns `mode: "mock"` and a
  `notice`; the UI shows a banner as well.

Set `PLATFORM_LLM_API_KEY` / `PLATFORM_EMBEDDING_API_KEY` (or a user key in
`/dashboard/settings`) to switch to real calls. With real embeddings, re-upload documents so
the vectors come from the model that will be used for queries.

### Connecting a real OpenAI-compatible provider

Two ways, both use the same code path (`services/llm_service.py`, `services/embedding_service.py`):

1. **Per user, in the UI** — `/dashboard/settings` → 接口地址 `https://api.deepseek.com/v1`
   (or `https://api.openai.com/v1`, `https://dashscope.aliyuncs.com/compatible-mode/v1`, …),
   模型名称 `deepseek-chat`, API Key, then **测试连接**. The key is encrypted with Fernet before it
   touches the database and is never returned by the API (`api_key_hint` is masked).
2. **Platform-wide, via env** — `LLM_PROVIDER=openai_compatible`, `PLATFORM_LLM_BASE_URL`,
   `PLATFORM_LLM_API_KEY`, `PLATFORM_LLM_MODEL` (same for `PLATFORM_EMBEDDING_*`).

The endpoint must expose `POST {base_url}/chat/completions` and `POST {base_url}/embeddings`.
Embedding dimension must equal `EMBEDDING_DIMENSION` (default 384, e.g. `bge-small-zh-v1.5`);
if it does not, the request fails with an explicit dimension error instead of silently mixing
vectors — set `EMBEDDING_DIMENSION`, recreate the schema and re-upload the documents.

**Chat-only providers (e.g. DeepSeek) have no `/embeddings` endpoint.** Leave the whole
向量模型 card empty in that case: answers will be generated by the real model while ingestion and
retrieval keep using the built-in lexical embedder. Recall is then lexical, so the RAG service has
a small-knowledge-base safety net — when a **live** model is configured and no chunk clears the
score cut-off, but the agent's knowledge base holds at most `FALLBACK_CONTEXT_MAX_CHUNKS` (20)
chunks, the best-ranked chunks are handed to the model anyway with `degraded: true` and a Chinese
`notice`, and the model decides whether they actually answer the question. Mock mode keeps the
strict cut-off and the honest refusal (a mock answer cannot reason).

**Verifying the live path without a real key:** `backend/scripts/fake_openai_provider.py` is a
local OpenAI-compatible server (chat + 384-dim embeddings + a `fail401` model for error tests).
Start it on port 9099, then run `backend/scripts/verify_live_provider.py` — it registers a user,
points their settings at the fake server, uploads a document, chats and asserts: `mode="live"`,
answer comes from the HTTP provider, sources are returned, the key never appears in any response,
it is stored as Fernet ciphertext, and a 401 maps to `502 llm_error` with the key redacted.
Last run: **19/19 checks passed** (this is a plumbing test, not a real-model quality test).

## 7. API

All private endpoints require the `pai_token` cookie (or a Bearer token). Ownership is checked
server-side; another user's resources return **404**, never a leaked payload.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | `{username,email,password}` → 201 + cookie |
| POST | `/api/auth/login` | `{email,password}` |
| POST | `/api/auth/logout` | 204, clears cookie |
| GET | `/api/auth/me` | current user |
| GET/POST | `/api/agents` | list / create |
| GET/PATCH/DELETE | `/api/agents/{id}` | detail / update / delete |
| GET/POST | `/api/agents/{id}/documents` | list / multipart upload |
| DELETE | `/api/agents/{id}/documents/{document_id}` | removes file + chunks |
| POST | `/api/agents/{id}/chat` | `{message, conversation_id?, top_k?}` |
| GET | `/api/agents/{id}/conversations` | playground history |
| GET | `/api/agents/{id}/conversations/{cid}` | one conversation |
| GET | `/api/public/agents/{slug}` | public profile only (404 when private) |
| POST | `/api/public/agents/{slug}/chat` | anonymous chat, rate limited |
| GET | `/api/public/agents/{slug}/conversations/{cid}` | visitor's own conversation only |
| GET/PUT | `/api/settings/llm` | read/update model config (keys masked) |
| POST | `/api/settings/llm/test` | test connection |
| GET | `/health`, `/api/health` | DB + provider status |

Errors always look like `{"error": {"code": "...", "message": "...", "path": "..."}}`
(`validation_error`, `unauthorized`, `not_found`, `duplicate_document`, `rate_limited`,
`llm_error`, `internal_error`, ...). API keys are never echoed back, logged or included in
error messages.

### RAG pipeline

```
question ─▶ embed(query) ─▶ SELECT ... FROM document_chunks
                              WHERE agent_id = :agent
                              ORDER BY embedding <=> :query   (SQLite: numpy cosine)
                            ─▶ score cut-off ─▶ top-k
                             (nothing above the cut-off + live model + KB ≤ 20 chunks
                              ⇒ best-effort top-k, degraded: true, Chinese notice)
   ─▶ context blocks (<document filename=...>)  +  PLATFORM_GUARDRAILS  +  persona
   ─▶ OpenAI-compatible /chat/completions (or deterministic mock answer)
   ─▶ answer + sources[{document_id, filename, chunk_index, score, excerpt}]
```

Platform guardrails (no invented employers/skills, document text is data not instructions,
never reveal prompts/keys/other users' data, never claim to be the human) live in
`backend/app/services/rag_service.py` and are prepended to every prompt; the user persona is
explicitly marked as tone-only and cannot override them.

## 8. Tests

```bash
cd backend
.venv/Scripts/python.exe -m pytest -q        # 55 tests
cd ..
node scripts/e2e_check.mjs                   # needs both servers on :3000 and :8000
```

* `backend/tests/` — pytest + TestClient covering auth, agent CRUD and ownership, upload/parse/
  chunk/delete, RAG answers, refusal on unknown topics, prompt-injection inside a document,
  public/private access, visitor isolation, rate limiting, secret non-leakage, health.
* `scripts/e2e_check.mjs` — HTTP walkthrough through the Next.js proxy (real cookies, real
  multipart upload, public visitor sessions). Prints PASS/FAIL per check plus a summary.

Actual results from the last run are recorded in `AGENTS.md`.

## 9. Security notes

* Passwords: bcrypt (72-byte truncation handled), never returned by any endpoint.
* Sessions: HS256 JWT with `sub`/`exp`; httpOnly, SameSite=Lax cookie.
* User API keys: Fernet-encrypted with a key derived from `SECRET_KEY`; only `api_key_hint`
  (`sk-...abcd`) is ever sent to the browser; logs run through `redact_secrets`.
* Uploads: extension allow-list, 10 MB cap, filenames replaced by a UUID (no path traversal),
  empty-file rejection, per-agent directories.
* Public surface: only `is_public` agents resolve; excerpts truncated to 120 chars; visitor
  conversations bound to an httpOnly `pai_visitor` cookie and inaccessible to other visitors;
  per-IP rate limiting on public chat.
* Prompt injection: document text is wrapped as reference data and the system prompt declares
  it untrusted; a test asserts an injected "ignore previous instructions" document does not
  surface the platform prompt.

## 10. Not in scope (by design)

Fine-tuning, LoRA, distillation, multi-agent orchestration, workflow editors, custom inference
engines, GPU scheduling, Kubernetes, payments/subscriptions, distributed queues, long-term
memory systems, real-time voice/video avatars, automated interview scoring.

## 11. Known limitations

* Docker Compose and the pgvector branch were not executed here (no Docker/PostgreSQL on the
  build machine); they are implemented but unverified at runtime.
* Mock embeddings are lexical only — paraphrased questions can miss relevant chunks (measured:
  「他毕业于哪里」 scored 0.056 / -0.022 / -0.028 against the resume chunks, under the 0.08 mock
  cut-off, so it used to refuse even though the resume names the school). With a real chat model the
  `FALLBACK_CONTEXT_MAX_CHUNKS` safety net compensates for small knowledge bases; for real recall
  configure a real embedding provider.
* Mock LLM answers quote passages; they are not generated prose.
* Synchronous ingestion: a large PDF blocks the upload request (acceptable for MVP sizes).
* No email verification, password reset or refresh-token rotation yet.

## 12. Project layout

```
personal-ai-agent/
├── frontend/            Next.js app router UI (landing, auth, dashboard, public agent page)
│   ├── app/             routes: /, /login, /register, /dashboard, /dashboard/agents/*, /a/[slug]
│   ├── components/      agent-form, knowledge-panel, chat-panel, ui primitives
│   └── lib/             api client, helpers, default persona
├── backend/             FastAPI service
│   ├── app/api/         auth, agents, documents, chat, public, settings
│   ├── app/core/        config, database, security, crypto, vector, errors, rate limit
│   ├── app/models/      SQLAlchemy models
│   ├── app/schemas/     Pydantic request/response models
│   ├── app/services/    rag, llm, embedding, document, chunking, agent
│   ├── app/repositories/ chunk search, conversations
│   ├── migrations/      Alembic
│   └── tests/           pytest suite
├── scripts/e2e_check.mjs
├── storage/             uploads + local SQLite db
├── docker-compose.yml
├── .env.example
├── README.md
└── AGENTS.md
```
