# AGENTS.md — project state for follow-up coding agents

Last updated: 2026-11-02 (MVP complete and **deployed to Tencent Cloud: http://159.75.187.199**, see §13).

## 1. Project goal

Personal AI Agent Platform MVP: a multi-user product where a user signs up, creates one or more
**personal AI twins** (name, description, avatar, persona prompt, knowledge base), tests them in a
playground, publishes them at `/a/<slug>`, and lets anonymous visitors interview the twin through
RAG over the user's own documents.

Explicit non-goals for v1: fine-tuning, LoRA, distillation, multi-agent collaboration, workflow
editor, custom inference engine, GPU scheduling, Kubernetes, payments, subscriptions, distributed
queues, complex memory, real-time voice/video, automated interview scoring.

## 2. Current architecture

* **Frontend** `frontend/` — Next.js 15 (app router), React 19, TypeScript, Tailwind CSS with
  shadcn-style primitives (no shadcn CLI, hand-written components in `components/ui`).
  `next.config.ts` rewrites `/api/:path*` to `BACKEND_URL` (default `http://127.0.0.1:8000`) so the
  auth cookie stays first-party.
  **UI copy is Simplified Chinese** (the landing page keeps the required English tagline as small
  print); `frontend/lib/api.ts:localizeError` maps the backend's stable `error.code` values to
  Chinese messages, and the RAG fallback/mock answers are Chinese too.
* **Backend** `backend/` — FastAPI + Pydantic v2 + SQLAlchemy 2.0, JWT httpOnly cookie auth,
  bcrypt passwords, Fernet-encrypted user API keys, synchronous document ingestion, RAG service.
* **Database** — dual dialect: PostgreSQL 16 + pgvector (production, via Alembic) or SQLite
  (local dev, schema auto-created on startup). `app/core/vector.py:VectorType` maps an embedding
  column to `vector(n)` on PostgreSQL and JSON text elsewhere.
* **Retrieval** — `app/repositories/chunk_repository.py` always filters `document_chunks.agent_id`;
  PostgreSQL uses `embedding <=> CAST(:q AS vector)`, other dialects load JSON vectors and rank
  with numpy cosine.
* **Providers** — OpenAI-compatible Chat Completions and Embeddings; `LLM_PROVIDER=auto` falls
  back to deterministic mock implementations when no platform key is configured.
* **Deployment** — `docker-compose.yml` (PostgreSQL 16/pgvector + backend + frontend; only the
  frontend port is published, `${HTTP_PORT:-3000}` → 3000) and `DEPLOY_TENCENT.md` for Tencent
  Cloud Lighthouse. Live instance: http://159.75.187.199 (`HTTP_PORT=80`) — §13. `frontend/Dockerfile` takes
  `BACKEND_URL` as a **build arg**: Next.js compiles `rewrites()` into `.next/routes-manifest.json`
  at build time (verified locally — a runtime `BACKEND_URL` is ignored), so the compose build arg
  `http://backend:8000` is what makes `/api/*` proxy correctly inside the network.

## 3. Implemented

* Auth: register / login / logout / me, rate limited, JWT cookie + Bearer support.
* Agents: create / list / get / patch / delete, unique opaque slug, public toggle, document count,
  public path, suggested questions.
* Knowledge base: PDF/TXT/MD upload, size + extension + empty-file validation, SHA-256 duplicate
  rejection, text extraction (PDF via pypdf; multi-encoding decode), chunking with overlap,
  embedding, storage under `STORAGE_DIR/uploads/<agent_id>/<uuid>`, per-document status
  (`pending`/`processing`/`ready`/`error` + `error_message`), delete removes chunks and file.
* RAG chat: embedding → agent-scoped vector search → score cut-off → context assembly → platform
  guardrails + persona + history → LLM call (or mock answer) → persisted messages + sources.
  When a **live** model answers and nothing clears the cut-off, a knowledge base of at most
  `FALLBACK_CONTEXT_MAX_CHUNKS` (20) chunks is passed best-effort instead of refusing blindly
  (`degraded=true` + Chinese `notice`); mock mode keeps the strict cut-off and the honest refusal.
  This is what fixes "resume says 研究生院校：东北师范大学, visitor asks 他毕业于哪里".
* Settings: GET/PUT `/api/settings/llm`, test connection; user chat + embedding config; keys
  stored encrypted, only masked hints returned.
* Public: `GET/POST /api/public/agents/{slug}…`, visitor cookie isolation, per-IP rate limiting,
  120-char excerpt truncation, instant 404 after unpublishing.
* Ops: `/health`, unified error envelope, Alembic initial migration, Docker Compose + Dockerfiles.
* Frontend pages (all Simplified Chinese): landing, login, register, dashboard (agent cards +
  stats), create agent, agent detail with 概览 / 知识库 / 对话测试 tabs, model settings, public
  `/a/[slug]` chat, plus a Chinese 404 page.
* Model settings UX: the header nav is always visible (it used to be `hidden md:flex`, which hid
  「模型设置」 on scaled/HiDPI viewports); the page has 快捷填充 preset buttons (DeepSeek V3 / R1,
  OpenAI, 通义千问, local Ollama), a 「当前生效」 badge so a saved personal model is not confused with
  the platform-default Mock badge, and `frontend/lib/api.ts:llmErrorMessage` turns the upstream
  status (401/402/404/429/5xx/timeout/unreachable) into a specific Chinese cause.

## 4. Not implemented (known gaps)

* Local dev box has no Docker/PostgreSQL (production on Tencent Cloud does — §13). Domain + HTTPS,
  automated DB backups and a background ingestion worker are still missing.
* Ingestion is synchronous — no background worker/queue.
* No email verification, password reset, refresh-token rotation, or account deletion.
* No conversation export, no analytics, no admin panel.
* No pagination on document/message lists (MVP sizes only).
* Mock embeddings are lexical (hashed n-grams), so paraphrases can miss; mock answers quote
  passages instead of generating prose.

## 5. Directory structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                 app factory, exception handlers, /health, router wiring
│   │   ├── api/                    auth, agents, documents, chat, public, settings_api, deps
│   │   ├── core/                   config, database, security, crypto, vector, errors, logging,
│   │   │                           rate_limit, http (httpx client factory)
│   │   ├── models/                 user, agent, document, chunk, conversation, message, llm_config
│   │   ├── schemas/                auth, agent, document, chat, llm_settings
│   │   ├── services/               rag_service, llm_service, embedding_service,
│   │   │                           document_service, chunking, agent_service
│   │   ├── repositories/           chunk_repository, conversation_repository
│   │   └── utils/                  message_mapper
│   ├── migrations/                 Alembic env + versions/0001_initial.py
│   ├── scripts/init_db.py          create schema (SQLite) or alembic upgrade head
│   ├── tests/                      48 pytest tests + conftest
│   ├── requirements.txt, pytest.ini, alembic.ini, Dockerfile
├── frontend/
│   ├── app/                        /, /login, /register, /dashboard, /dashboard/agents/*,
│   │                               /dashboard/settings, /a/[slug]
│   ├── components/                 agent-form, knowledge-panel, chat-panel, ui/{button,card,input}
│   ├── lib/                        api.ts (typed client), utils.ts, persona.ts
│   └── next.config.ts, tailwind.config.ts, package.json, pnpm-lock.yaml, Dockerfile
├── scripts/e2e_check.mjs           HTTP end-to-end walkthrough
├── deploy/
│   ├── nginx/pai.conf              reverse-proxy site (TLS via certbot)
│   └── tencent/setup-docker.sh     Docker install using Tencent Cloud mirrors
├── storage/                        uploads + SQLite db (gitignored)
├── docker-compose.yml, .env.example, README.md, AGENTS.md, DEPLOY_TENCENT.md
```

## 6. Key entry points

| Concern | File |
| --- | --- |
| App wiring, error handlers, health | `backend/app/main.py` |
| Settings (all env vars) | `backend/app/core/config.py` |
| Auth dependency + ownership checks | `backend/app/api/deps.py` |
| Chat endpoint (private) | `backend/app/api/chat.py` |
| Public endpoints + rate limit + visitor cookie | `backend/app/api/public.py` |
| RAG pipeline + guardrails | `backend/app/services/rag_service.py` |
| Embedding providers / mock embedder | `backend/app/services/embedding_service.py` |
| LLM provider + error mapping | `backend/app/services/llm_service.py` |
| Ingestion (parse/chunk/embed/store) | `backend/app/services/document_service.py` |
| Vector search | `backend/app/repositories/chunk_repository.py` |
| DB models | `backend/app/models/*.py` |
| Migration | `backend/migrations/versions/0001_initial.py` |
| Local OpenAI-compatible server (no key needed) | `backend/scripts/fake_openai_provider.py` |
| Live-provider end-to-end check | `backend/scripts/verify_live_provider.py` |
| Settings flow through the Next.js proxy (browser path) | `scripts/ui_settings_flow_check.mjs` |
| Typed API client | `frontend/lib/api.ts` |
| Chat UI (playground + public) | `frontend/components/chat-panel.tsx` |
| Agent editor | `frontend/components/agent-form.tsx` |
| Knowledge base UI | `frontend/components/knowledge-panel.tsx` |

## 7. Database model

`users`(id, email UNIQUE, password_hash, username, created_at, updated_at)
`agents`(id, user_id → users, name, description, system_prompt, avatar_url, slug UNIQUE,
is_public, created_at, updated_at)
`documents`(id, agent_id → agents, filename, file_type, file_path, status, error_message,
content_hash, chunk_count, created_at)
`document_chunks`(id, document_id → documents, agent_id → agents, content, embedding,
chunk_index) — both FKs on purpose: retrieval filters `agent_id` directly.
`conversations`(id, agent_id → agents, user_id → users NULL, visitor_id NULL, channel
(playground|public), title, created_at, updated_at)
`messages`(id, conversation_id → conversations, role, content, sources JSON, created_at)
`user_llm_configs`(id, user_id UNIQUE → users, base_url, api_key_encrypted, model_name,
temperature, max_tokens, embedding_base_url, embedding_api_key_encrypted, embedding_model,
embedding_dimension, created_at, updated_at)

All relationships use UUID string primary keys, `ondelete=CASCADE` where a child cannot outlive
its parent, and indexes on the ownership/filter columns (`agents.user_id`, `documents.agent_id`,
`document_chunks.agent_id`, `conversations.agent_id`, `messages.conversation_id`).

## 8. API surface

Prefix `/api`. Private routes require the auth cookie/Bearer token and return 404 for resources
owned by somebody else.

* `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` (204),
  `GET /api/auth/me`
* `GET|POST /api/agents`, `GET|PATCH|DELETE /api/agents/{id}`
* `GET|POST /api/agents/{id}/documents`, `DELETE /api/agents/{id}/documents/{document_id}`
* `POST /api/agents/{id}/chat` — body `{message, conversation_id?, top_k?}`,
  response `{conversation_id, message:{...}, sources:[...], mode, model, degraded, notice}`
* `GET /api/agents/{id}/conversations`, `GET /api/agents/{id}/conversations/{cid}`
* `GET /api/public/agents/{slug}`, `POST /api/public/agents/{slug}/chat`,
  `GET /api/public/agents/{slug}/conversations/{cid}`
* `GET|PUT /api/settings/llm`, `POST /api/settings/llm/test`
* `GET /health`, `GET /api/health`

Errors: `{"error": {"code", "message", "path"}}`.

## 9. Environment variables

See `.env.example` (authoritative, commented) and `backend/.env.example`. Summary:
`SECRET_KEY`, `DATABASE_URL` (default `sqlite:///./storage/app.db`), `CORS_ORIGINS`, `STORAGE_DIR`,
upload/chunk/retrieval limits (`MAX_UPLOAD_MB`, `ALLOWED_EXTENSIONS`, `CHUNK_SIZE`,
`CHUNK_OVERLAP`, `DEFAULT_TOP_K`, `MAX_TOP_K`, `MIN_RETRIEVAL_SCORE`, `MOCK_MIN_RETRIEVAL_SCORE`,
`MAX_CONTEXT_CHARS`, `MAX_HISTORY_MESSAGES`, `MAX_USER_MESSAGE_CHARS`, `MAX_ANSWER_TOKENS`,
`FALLBACK_CONTEXT_MAX_CHUNKS`),
rate limits (`PUBLIC_RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_MINUTE`), provider settings
(`LLM_PROVIDER`, `PLATFORM_LLM_*`, `EMBEDDING_PROVIDER`, `PLATFORM_EMBEDDING_*`,
`EMBEDDING_DIMENSION`), timeouts (`LLM_TIMEOUT_SECONDS`, `EMBEDDING_TIMEOUT_SECONDS`).

Frontend only reads `BACKEND_URL` at build/start time (Next.js rewrite target).

## 10. Known issues / gotchas

1. **Docker Compose + pgvector are now verified in production** (Tencent Cloud Lighthouse,
   `docker compose up -d --build`; Alembic `0001_initial` ran on PostgreSQL 16 + pgvector 0.7 and a
   real chat request retrieved the uploaded chunk, i.e. `chunk_repository.search_chunks`'s
   `<=>` path works). The **local dev box still has no Docker/PostgreSQL** — local runs use SQLite,
   so any new SQL must keep working on both dialects. Deployment details: §13.
2. **http:// proxy env on this machine** — `HTTP(S)_PROXY=http://127.0.0.1:8890` with a
   `NO_PROXY` list containing the bracketed `[::1]`, which httpx rejects with
   `InvalidURL: Invalid port: ':1]'`. `app/core/http.py:new_client` now drops bracketed
   NO_PROXY entries and then creates a normal env-aware client, so the proxy is used for public
   hosts and bypassed for `127.0.0.1`/`localhost`. After the fix: api.openai.com, api.deepseek.com
   and dashscope all answer 401 (reachable, key needed) through `new_client`. Always send outbound
   LLM/embedding traffic through `new_client`, never a bare `httpx.Client`.
3. **FastAPI 204 routes** must not declare a return annotation or `response_model` — both
   `-> None` and `-> Response` trigger `AssertionError: Status code 204 must not have a response
   body`. Use `response_class=Response` and return `Response(status_code=204)` (see logout and
   document delete).
4. **Mock embeddings are lexical only.** `mock_embed` weights CJK bigrams/latin words 1.0 and CJK
   unigrams 0.3; mock mode uses `MOCK_MIN_RETRIEVAL_SCORE` (0.08) instead of the real 0.15.
   A question that mentions the candidate by name can still retrieve their chunks even when the
   topic is unrelated — only a real model can judge relevance. Measured example: query
   `他毕业于哪里` against the 3 resume chunks scored 0.0558 / -0.022 / -0.028, i.e. all below the
   cut-off, which used to produce a false "资料中没有相关信息" even though the resume contained the
   answer. With a live chat model the small-KB fallback above now hands the whole resume to the
   model, and DeepSeek answered correctly (see §12).
5. **pnpm reports `ERR_PNPM_IGNORED_BUILDS: sharp@0.33.5`** on every `pnpm run` (exit code of the
   pre-run install is 1, the script itself still runs and returns 0). `onlyBuiltDependencies` in
   `pnpm-workspace.yaml` is not honoured by pnpm 11 here. Harmless for now.
6. **Windows dev shell** is PowerShell 5.1 — `Invoke-RestMethod -Form/-SkipHttpErrorCheck` are
   unavailable, which is why the E2E walkthrough is a Node script.
7. Changing `EMBEDDING_DIMENSION` invalidates stored vectors: re-index (delete + re-upload
   documents) or queries will legitimately fail with a dimension error.
8. **Backend error messages stay English** (stable `error.code` + human message); the pitch is
   localized in the client only. Never translate messages server-side without updating the pytest
   assertions that match them.
9. **Chat-only providers (DeepSeek!) expose no `/embeddings` endpoint.** With `deepseek-chat`
   configured and the embedding card left empty, ingestion and retrieval keep using the mock
   lexical embedder. Answers are generated by the real model, but recall is lexical: the small-KB
   fallback in `rag_service.answer_question` is what keeps normal resume questions working.
   Configure a real OpenAI-compatible embedding provider whose dimension equals
   `EMBEDDING_DIMENSION` (384 by default) for semantic retrieval; changing the dimension requires
   re-uploading every document.

## 11. Next steps

1. ~~Run `docker compose up --build` on a Docker-capable machine~~ **done**: deployed on Tencent
   Cloud (see §13). Remaining deploy work: domain + HTTPS (then `COOKIE_SECURE=true`), nightly
   `pg_dump` backups, and moving ingestion to a background worker so uploads don't block a request.
2. Replace synchronous ingestion with a small background worker (FastAPI BackgroundTasks or
   RQ/Celery) and expose progress in the UI.
3. Add pagination + search for documents and conversations.
4. Add refresh-token rotation, email verification, password reset.
5. Consider hybrid retrieval (BM25 + vector) and a reranking pass to improve recall on real
   embeddings; make `min_retrieval_score` provider-aware (it already has a mock override).
6. Add rate limiting for authenticated chat and per-agent daily token budgets.

## 12. Last test run (2026-11-02, this machine; re-run after the UI was switched to Chinese)

Backend unit/integration tests:

```
cd backend
.venv/Scripts/python.exe -m pytest -q
# 48 passed (exit 0)
```

Per file: `test_auth.py` 6, `test_agents.py` 5, `test_documents.py` 7, `test_rag.py` 13,
`test_public.py` 8, `test_settings_llm.py` 6, `test_health.py` 3.

Retrieval-fallback regression tests (`test_rag.py`): `test_paraphrased_question_still_uses_the_knowledge_base`
(live config monkeypatched, asserts the resume text reaches the prompt + `degraded` + notice),
`test_fallback_respects_top_k`, `test_mock_mode_keeps_the_strict_cutoff`.

Frontend build:

```
cd frontend
pnpm run typecheck   # exit 0
pnpm run build       # success, 9 routes (/, /_not-found, /a/[slug], /dashboard,
                     # /dashboard/agents/[id], /dashboard/agents/new, /dashboard/settings,
                     # /login, /register)
pnpm run start       # serving on http://localhost:3000
```

End-to-end HTTP walkthrough through the Next.js proxy
(`uvicorn app.main:app --port 8000` + `next start -p 3000`, mock providers):

```
node scripts/e2e_check.mjs
# SUMMARY passed=26 failed=0 total=26
```

The walkthrough now also asserts the Chinese copy: the landing page contains 「创建你的个人 AI 分身」
and the English tagline, `/login` and `/register` contain 「登录」「注册」, the authenticated
`/dashboard` and `/dashboard/settings` shells contain 「正在进入控制台」, the public page HTML
contains 「正在加载 Agent」, and scenario B matches the Chinese refusal text 「没有找到」.

Covered checks: landing/auth pages render, private API 401 without a session, register +
`/api/auth/me`, Chinese dashboard shells, agent creation with public path, cross-user isolation
(agent/documents/chat all
404), TXT upload processed to `ready` with 1 chunk, scenario A (resume question answered from the
knowledge base), scenario B (empty knowledge base refuses with the fallback text), public profile
exposes only public fields, anonymous public chat with truncated excerpts, scenario G (second
visitor cannot read the first visitor's conversation), public visitor cannot read the owner's
playground conversation, scenario D (unpublish → both public endpoints 404 immediately), scenario
E (document delete → 0 documents and 0 sources afterwards), public page HTML 200, scenario F
(invalid model config → 502 `llm_error` with no API key in the response), logout → 204 then 401.

Live-provider wiring (no real API key on this machine, so a local OpenAI-compatible stub was
used — this proves the HTTP plumbing, not model quality):

```
cd backend
.venv/Scripts/python.exe scripts/fake_openai_provider.py 9099    # background
.venv/Scripts/python.exe scripts/verify_live_provider.py
# SUMMARY passed=19 failed=0 total=19
```

Browser-path check — same flow but through the frontend origin `http://127.0.0.1:3000`
(Next.js rewrite + first-party `pai_token` cookie), so it matches what the 模型设置 page does:

```
node scripts/ui_settings_flow_check.mjs
# SUMMARY passed=12 failed=0 total=12
```

Provider reachability with the app's own client (`app/core/http.py:new_client`, env proxy +
sanitized NO_PROXY) — every endpoint answers 401 without a key, i.e. DNS/TLS/route work:
`api.openai.com` 401, `api.deepseek.com` 401, `dashscope.aliyuncs.com/compatible-mode` 401.

It asserts: user settings → `mode="live"`, `/api/settings/llm/test` OK, document ingestion with
embeddings from `POST /v1/embeddings`, chat answer produced by `POST /v1/chat/completions`
(`[LIVE-PROVIDER:…]` marker) with sources, the raw key absent from every response and stored as
Fernet ciphertext (`gAAAA…`), and a 401 from the provider surfacing as `502 llm_error` with the
fake key redacted from the message.

Real DeepSeek answer (one live call with the owner's stored key, 2026-11-02, question 他毕业于哪里):
`mode=live model=deepseek-flash degraded=true`, 3 resume sources, answer
「朱薪宇目前是东北师范大学的硕士在读生，本科毕业于辽宁工程技术大学，专业为电子信息工程（排名前5%）」
— i.e. DeepSeek + the small-KB fallback answers the very question that used to return
"资料中没有相关信息".

Production (Tencent Cloud) run, 2026-11-02: see §13 — PostgreSQL + pgvector healthy, Alembic
migrated, document processed to `ready` with 1 chunk, chat answered from the knowledge base, public
profile/chat/page all 200.

Not verified anywhere: OpenAI/DashScope live calls (only DeepSeek was exercised, and not from the
production host yet), and no browser-based click-through (UI verified by HTTP + build only).

## 13. Deployed instance (Tencent Cloud, live)

| Item | Value |
| --- | --- |
| Public URL | http://159.75.187.199 (port 80 -> frontend container :3000) |
| Host | Tencent Cloud Lighthouse, Ubuntu 20.04 LTS, 2 vCPU / 1.9 GiB RAM / 40 GB disk (+2 GB swap) |
| Code | `/opt/personal-ai-agent` on the host (tar upload); `.env` lives there, never committed |
| Runtime | Docker 28.1.1 + Compose v2.35.1 with Chinese mirrors (`mirror.ccs.tencentyun.com`, `mirrors.cloud.tencent.com/pypi/simple`, `registry.npmmirror.com`) |
| Services | `db` (pgvector/pgvector:pg16), `backend` (alembic upgrade + uvicorn `--proxy-headers`), `frontend` (next start); all `restart: unless-stopped` + healthchecks; only :80 published |
| DB | PostgreSQL 16 + pgvector; `/api/health` reports `"dialect":"postgresql","vector_store":"pgvector"` |
| Providers | still `mock` (no platform key on the server) - a user must save their own key in the model settings page |
| Env | `APP_ENV=production`, `DEBUG=false`, `PUBLIC_ORIGIN=http://159.75.187.199`, `HTTP_PORT=80`, `COOKIE_SECURE=false` (flip to true after HTTPS) |

Verification performed against the live URL (2026-11-02): `/api/health` 200 with the pgvector dialect;
landing/login/register/dashboard/settings pages 200; register -> create agent -> upload TXT ->
`status=ready, chunk_count=1` -> chat answer quoted the uploaded text (`mode=mock`); public
`GET /api/public/agents/{slug}`, anonymous `POST .../chat` and the `/a/<slug>` HTML (len 7169) all
returned 200. `docker compose ps` shows 3/3 healthy; memory about 500 MB used of 1970 MB; disk
8.7/40 GB.

Network notes from the server: `api.deepseek.com` 401 and `dashscope.aliyuncs.com` 401 (reachable,
a key is needed); `api.openai.com` is unreachable from this host (mainland egress), so on this
deployment users should configure DeepSeek / Qwen / another domestic OpenAI-compatible endpoint.

Operational commands on the host:

```bash
cd /opt/personal-ai-agent
sudo docker compose ps
sudo docker compose logs -f backend
sudo docker compose up -d --build          # after uploading new code
sudo docker compose exec -T db psql -U pai -d pai -c "select filename,status,chunk_count from documents;"
```

Known constraints of this deployment: HTTP only (no domain/TLS yet); a single 1.9 GiB node, so
synchronous PDF parsing of very large files is slow; no automated backup of the `pgdata` and
`storage` volumes yet.

