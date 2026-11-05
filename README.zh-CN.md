# Personal AI Agent Platform

English: [README.md](README.md)

一个多用户平台：任何人都可以把简历、笔记和项目变成个人 **AI 数字分身**，其他人通过公开链接即可向它提问。

MVP 形成闭环：注册 → 创建智能体（人设 + 知识库）→ 在对话测试中聊天 → 发布可分享的 `/a/<slug>` 页面 → 访客无需账号即可与分身交谈。

> 这是一个 **RAG + 人设提示词** 产品。不涉及微调、LoRA 或蒸馏（见「不在范围内」）。

---

## 1. 功能

| 范围 | 已实现 |
| --- | --- |
| 认证 | 注册 / 登录 / 退出，bcrypt 密码哈希，HS256 JWT 放在 httpOnly cookie（`pai_token`）或 `Authorization: Bearer` 中，`GET /api/auth/me` |
| 智能体 | 完整 CRUD，唯一 slug，公开/私有开关，人设 `system_prompt`，头像 URL，推荐问题 |
| 知识库 | 上传 PDF / TXT / Markdown（最大 10 MB），解析 → 分块（800 个字符，重叠 150）→ 向量化 → 存储，每份文档有状态（`pending`/`processing`/`ready`/`error`），删除时同时移除分块和文件，SHA-256 重复检测 |
| RAG 对话 | 查询向量化 → 限定范围的向量检索（`agent_id` 过滤）→ 分数阈值 → 上下文窗口 → 平台护栏 + 人设提示词 → OpenAI 兼容的对话补全 → 回答 + 引用来源，多轮历史 |
| 模型配置 | 按用户配置 OpenAI 兼容的 base URL / key / model / temperature / max tokens，以及单独的向量配置；密钥用 Fernet 加密，绝不返回给浏览器 |
| 公开分享 | `/a/<slug>` 类 ChatGPT 页面，匿名对话，访客 cookie 隔离，按 IP 限流，来源摘录截断，取消发布后立即失效 |
| 运维 | `/health` 端点，统一错误信封，请求日志脱敏，Alembic 迁移，Docker Compose |

## 2. 架构

```
浏览器
  │  （同源，cookie）
  ▼
Next.js 15 app router  ──rewrite /api/*──▶  FastAPI (uvicorn)
  │                                            │
  │                                            ├── services: rag / llm / embedding / document
  │                                            ├── repositories: 分块检索、会话
  │                                            ▼
  │                                     SQLAlchemy 2.0 ORM
  │                                            │
  │                              ┌─────────────┴──────────────┐
  │                              ▼                            ▼
  │                    PostgreSQL + pgvector            SQLite（开发回退）
  │                    （余弦距离 `<=>`）                （JSON 向量 + numpy 余弦）
  ▼
storage/uploads/<agent>/<document>  （PDF/TXT/MD 原文件）
```

数据层刻意区分方言：生产环境使用带 `vector` 扩展的 PostgreSQL；不使用 Docker 的本地运行回退到 SQLite，向量以 JSON 存储并用 numpy 计算余弦相似度。两条路径都会过滤 `document_chunks.agent_id`，因此知识库不会在智能体或用户之间泄露。

**技术栈**：Next.js 15 + React 19 + TypeScript + Tailwind CSS（shadcn 风格组件），FastAPI + SQLAlchemy 2 + Pydantic v2，PostgreSQL 16 + pgvector，Alembic，Docker Compose。

**界面语言**：整个界面为简体中文（落地页保留规定的英文标语 `Create Your Personal AI Twin` 作为小字）。后端错误保持稳定的英文 `error.code`；`frontend/lib/api.ts` 将其翻译后展示，因此 API 客户端仍能看到可预测的机器可读错误码。

## 3. 使用 Docker 快速开始

```bash
cp .env.example .env          # 必填：SECRET_KEY、POSTGRES_PASSWORD、PUBLIC_ORIGIN
docker compose up -d --build
```

* 应用（前端与 API 走同一个源）：<http://localhost:3000>
* 健康检查：<http://localhost:3000/api/health>

Compose 会启动 PostgreSQL 16 + pgvector，先执行 `alembic upgrade head` 再启动 uvicorn，并提供 Next.js 生产构建。只对外发布前端；Next.js 通过 compose 网络把 `/api/*` 代理到后端，因此登录 cookie 保持第一方。

> **已验证状态**：compose 栈已在生产环境运行 — **http://159.75.187.199**
> （腾讯云轻量应用服务器 Lighthouse，Ubuntu 20.04，PostgreSQL 16 + pgvector，`HTTP_PORT=80`）。在该主机上，
> `docker compose up -d --build` 执行了 `alembic upgrade head`，三个容器均报告健康，
> 上传的文档达到 `ready`，对话回答来自 pgvector 打分后的分块。
> 构建机本身没有 Docker，因此本地开发仍使用下面的 SQLite 路径。
>
> 该部署需要注意：目前仅为 HTTP（尚无域名 / TLS），并且在用户于「模型设置」中保存自己的密钥之前，服务器使用 **mock** 提供商 — 主机可以访问 `api.deepseek.com` 和 `dashscope.aliyuncs.com`，不能访问 `api.openai.com`。
>
> 值得知道的部署说明：
> * `BACKEND_URL` 是 **构建参数**（`frontend/Dockerfile`）— Next.js 在构建时把 `rewrites()` 写进 `.next/routes-manifest.json`，只在容器运行时设置它不会生效。这一点已在本地测过。
> * 后端以 `--proxy-headers --forwarded-allow-ips='*'` 运行 uvicorn，这样在 nginx 后面按 IP 限流时能看到真实访客 IP。
> * `COOKIE_SECURE=true` 只在 HTTPS 下有效；在纯 `http://IP:3000` 上必须保持 `false`。
>
> 腾讯云完整步骤见 [DEPLOY_TENCENT.md](DEPLOY_TENCENT.md)。

## 4. 本地开发（不用 Docker）— 已验证路径

### 4.1 后端

```bash
cd backend
python -m venv .venv                 # Python 3.11+
.venv/Scripts/activate               # Windows；macOS/Linux 用 source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # 设置 SECRET_KEY，mock 模式请把 LLM 密钥留空
python scripts/init_db.py            # SQLite：建表；PostgreSQL：alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 4.2 前端

```bash
cd frontend
pnpm install
pnpm dev                             # http://localhost:3000
```

`next.config.ts` 把 `/api/*` 代理到 `BACKEND_URL`（默认 `http://127.0.0.1:8000`），因此浏览器只与一个源通信，登录 cookie 保持第一方。

接近生产的运行方式：`pnpm build && pnpm start`。

### 4.3 数据库迁移（PostgreSQL）

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://pai:pai_password@localhost:5432/pai
alembic upgrade head
```

`0001_initial` 会创建 `vector` 扩展、全部表、索引以及 ivfflat 余弦索引。在 SQLite 上，应用在启动时建表（仅便于开发）。

## 5. 环境变量

全部可选；默认值会以 mock 模式在 SQLite 上运行。本地把 `.env.example` 复制为 `backend/.env`，Docker Compose 则复制为项目根目录的 `.env`。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `SECRET_KEY` | 开发默认值 | 签发 JWT，并派生 API 密钥的加密密钥。**生产环境必须更换。** |
| `DATABASE_URL` | `sqlite:///./storage/app.db` | pgvector 使用 `postgresql+psycopg://user:pass@host:5432/db` |
| `STORAGE_DIR` | `./storage` | 上传文件 |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | 逗号分隔的来源 |
| `MAX_UPLOAD_MB` / `ALLOWED_EXTENSIONS` | `10` / `.pdf,.txt,.md,.markdown` | 上传限制 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `800` / `150` | 分块 |
| `DEFAULT_TOP_K` / `MAX_TOP_K` | `5` / `12` | 检索深度 |
| `MIN_RETRIEVAL_SCORE` | `0.15` | 真实向量的余弦阈值 |
| `MOCK_MIN_RETRIEVAL_SCORE` | `0.08` | 离线 mock 向量器使用的阈值 |
| `MAX_CONTEXT_CHARS` / `MAX_HISTORY_MESSAGES` | `6000` / `12` | 提示词预算 |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | `20` | 公开对话的每 IP 限额 |
| `LLM_PROVIDER` | `auto` | 仅当存在平台密钥时 `auto` 才使用真实提供商，否则为 `mock` |
| `PLATFORM_LLM_BASE_URL` / `_API_KEY` / `_MODEL` | OpenAI 默认值 | 平台默认对话模型 |
| `EMBEDDING_PROVIDER` | `auto` | 语义与 `LLM_PROVIDER` 相同 |
| `PLATFORM_EMBEDDING_BASE_URL` / `_API_KEY` / `_MODEL` | OpenAI 默认值 | 平台默认向量模型 |
| `EMBEDDING_DIMENSION` | `384` | 必须与 pgvector 列一致；更改后需要重建索引 |

## 6. Mock 模式与真实模型

没有 API 密钥时，平台以 **mock 模式** 运行，并会明确说明：

* **向量**：确定性的哈希 n-gram 词袋向量（拉丁词 + 中日韩单字/双字，blake2b 分桶，L2 归一化）。它是*词面*匹配，不是语义匹配：换一种说法可能会漏掉。
* **LLM**：不生成文本，而是在中文横幅（`【Mock 模式 · 尚未接入真实模型…】`）后面引用检索到的段落。API 同时返回 `mode: "mock"` 和 `notice`；界面也会显示横幅。

设置 `PLATFORM_LLM_API_KEY` / `PLATFORM_EMBEDDING_API_KEY`（或在 `/dashboard/settings` 中填写用户密钥）即可切换到真实调用。使用真实向量后，请重新上传文档，使向量来自查询时将使用的模型。

### 接入真实的 OpenAI 兼容提供商

两种方式走同一条代码路径（`services/llm_service.py`、`services/embedding_service.py`）：

1. **按用户，在界面中** — `/dashboard/settings` → 接口地址 `https://api.deepseek.com/v1`
   （或 `https://api.openai.com/v1`、`https://dashscope.aliyuncs.com/compatible-mode/v1` 等），
   模型名称 `deepseek-chat`，填写 API Key，然后点 **测试连接**。密钥在写入数据库前用 Fernet 加密，API 永不返回原文（`api_key_hint` 已脱敏）。
2. **全平台，通过环境变量** — `LLM_PROVIDER=openai_compatible`、`PLATFORM_LLM_BASE_URL`、
   `PLATFORM_LLM_API_KEY`、`PLATFORM_LLM_MODEL`（`PLATFORM_EMBEDDING_*` 同理）。

端点必须提供 `POST {base_url}/chat/completions` 和 `POST {base_url}/embeddings`。
向量维度必须等于 `EMBEDDING_DIMENSION`（默认 384，例如 `bge-small-zh-v1.5`）；
若不一致，请求会以明确的维度错误失败，而不会悄悄混用向量 — 请设置 `EMBEDDING_DIMENSION`，重建表结构并重新上传文档。

**仅对话的提供商（例如 DeepSeek）没有 `/embeddings` 端点。** 这种情况请把整个「向量模型」卡片留空：回答由真实模型生成，入库和检索仍使用内置的词面向量器。此时召回是词面的，因此 RAG 服务对小型知识库有一层兜底 — 当已配置 **live** 模型、没有分块超过分数阈值，但该智能体的知识库最多只有 `FALLBACK_CONTEXT_MAX_CHUNKS`（20）个分块时，仍会把得分最高的分块交给模型，并带上 `degraded: true` 和中文 `notice`，由模型判断它们是否真的回答了问题。Mock 模式保持严格阈值和如实拒绝（mock 回答无法推理）。

**不用真实密钥验证 live 路径：** `backend/scripts/fake_openai_provider.py` 是本地的 OpenAI 兼容服务（对话 + 384 维向量 + 用于错误测试的 `fail401` 模型）。
在 9099 端口启动它，再运行 `backend/scripts/verify_live_provider.py` — 它会注册用户，把设置指向这个假服务，上传文档，发起对话并断言：`mode="live"`，回答来自 HTTP 提供商，返回了来源，任何响应中都不出现密钥，密钥以 Fernet 密文存储，401 映射为 `502 llm_error` 且密钥已脱敏。
上次运行：**19/19 项检查通过**（这是通路测试，不是真实模型质量测试）。

## 7. API

所有私有端点需要 `pai_token` cookie（或 Bearer token）。所有权在服务端检查；他人的资源返回 **404**，不会泄露内容。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | `{username,email,password}` → 201 + cookie |
| POST | `/api/auth/login` | `{email,password}` |
| POST | `/api/auth/logout` | 204，清除 cookie |
| GET | `/api/auth/me` | 当前用户 |
| GET/POST | `/api/agents` | 列表 / 创建 |
| GET/PATCH/DELETE | `/api/agents/{id}` | 详情 / 更新 / 删除 |
| GET/POST | `/api/agents/{id}/documents` | 列表 / multipart 上传 |
| DELETE | `/api/agents/{id}/documents/{document_id}` | 删除文件和分块 |
| POST | `/api/agents/{id}/chat` | `{message, conversation_id?, top_k?}` |
| GET | `/api/agents/{id}/conversations` | 对话测试的历史 |
| GET | `/api/agents/{id}/conversations/{cid}` | 单次会话 |
| GET | `/api/public/agents/{slug}` | 仅公开资料（私有时 404） |
| POST | `/api/public/agents/{slug}/chat` | 匿名对话，有限流 |
| GET | `/api/public/agents/{slug}/conversations/{cid}` | 仅访客自己的会话 |
| GET/PUT | `/api/settings/llm` | 读取/更新模型配置（密钥已脱敏） |
| POST | `/api/settings/llm/test` | 测试连接 |
| GET | `/health`、`/api/health` | 数据库 + 提供商状态 |

错误始终形如 `{"error": {"code": "...", "message": "...", "path": "..."}}`
（`validation_error`、`unauthorized`、`not_found`、`duplicate_document`、`rate_limited`、
`llm_error`、`internal_error` 等）。API 密钥不会被回显、写入日志或放进错误信息。

### RAG 流水线

```
问题 ─▶ embed(query) ─▶ SELECT ... FROM document_chunks
                              WHERE agent_id = :agent
                              ORDER BY embedding <=> :query   （SQLite：numpy 余弦）
                            ─▶ 分数阈值 ─▶ top-k
                             （没有超过阈值 + live 模型 + 知识库 ≤ 20 个分块
                              ⇒ 尽力而为的 top-k，degraded: true，中文 notice）
   ─▶ 上下文块（<document filename=...>）  +  PLATFORM_GUARDRAILS  +  人设
   ─▶ OpenAI 兼容的 /chat/completions（或确定性的 mock 回答）
   ─▶ 回答 + sources[{document_id, filename, chunk_index, score, excerpt}]
```

平台护栏（不编造雇主/技能，文档文本是数据而不是指令，绝不泄露提示词/密钥/其他用户的数据，绝不声称自己是本人）位于 `backend/app/services/rag_service.py`，并被加在每条提示词前面；用户人设被明确标为只影响语气，不能覆盖护栏。

## 8. 测试

```bash
cd backend
.venv/Scripts/python.exe -m pytest -q        # 48 tests
cd ..
node scripts/e2e_check.mjs                   # 需要 :3000 和 :8000 上的两个服务都在运行
```

* `backend/tests/` — pytest + TestClient，覆盖认证、智能体 CRUD 与所有权、上传/解析/分块/删除、RAG 回答、未知话题拒绝、文档内的提示词注入、公开/私有访问、访客隔离、限流、密钥不泄露、健康检查。
* `scripts/e2e_check.mjs` — 经 Next.js 代理的 HTTP 走查（真实 cookie、真实 multipart 上传、公开访客会话）。每项检查打印 PASS/FAIL，并给出汇总。

最近一次运行的实际结果记录在 `AGENTS.md`。

## 9. 安全说明

* 密码：bcrypt（已处理 72 字节截断），任何端点都不会返回密码。
* 会话：带 `sub`/`exp` 的 HS256 JWT；httpOnly、SameSite=Lax cookie。
* 用户 API 密钥：用从 `SECRET_KEY` 派生的密钥做 Fernet 加密；发给浏览器的只有 `api_key_hint`（`sk-...abcd`）；日志经过 `redact_secrets`。
* 上传：扩展名白名单，10 MB 上限，文件名替换为 UUID（无路径穿越），拒绝空文件，按智能体分目录。
* 公开面：只有 `is_public` 的智能体可解析；摘录截断为 120 个字符；访客会话绑定 httpOnly 的 `pai_visitor` cookie，其他访客无法访问；公开对话按 IP 限流。
* 提示词注入：文档文本被包裹为参考数据，系统提示词声明其不可信；有测试断言，注入了 “ignore previous instructions” 的文档不会把平台提示词暴露出来。

## 10. 不在范围内（设计如此）

微调、LoRA、蒸馏、多智能体编排、工作流编辑器、自定义推理引擎、GPU 调度、Kubernetes、支付/订阅、分布式队列、长期记忆系统、实时语音/视频形象、自动面试评分。

## 11. 已知限制

* 这里没有执行过 Docker Compose 和 pgvector 分支（构建机上没有 Docker/PostgreSQL）；它们已实现，但运行时未验证。
* Mock 向量只做词面匹配 — 换说法的问题可能错过相关分块（实测：「他毕业于哪里」相对简历分块的得分为 0.056 / -0.022 / -0.028，低于 0.08 的 mock 阈值，因此以前即使简历写了学校也会拒绝回答）。配置了真实对话模型后，`FALLBACK_CONTEXT_MAX_CHUNKS` 兜底可以弥补小型知识库；要获得真正的召回，请配置真实的向量提供商。
* Mock LLM 的回答是引用段落，不是生成的散文。
* 同步入库：较大的 PDF 会阻塞上传请求（对 MVP 体量可以接受）。
* 尚无邮箱验证、密码重置或 refresh token 轮换。

## 12. 项目结构

```
personal-ai-agent/
├── frontend/            Next.js app router 界面（落地页、认证、控制台、公开智能体页）
│   ├── app/             路由：/, /login, /register, /dashboard, /dashboard/agents/*, /a/[slug]
│   ├── components/      agent-form、knowledge-panel、chat-panel、ui 基础组件
│   └── lib/             API 客户端、辅助函数、默认人设
├── backend/             FastAPI 服务
│   ├── app/api/         auth、agents、documents、chat、public、settings
│   ├── app/core/        config、database、security、crypto、vector、errors、rate limit
│   ├── app/models/      SQLAlchemy 模型
│   ├── app/schemas/     Pydantic 请求/响应模型
│   ├── app/services/    rag、llm、embedding、document、chunking、agent
│   ├── app/repositories/ 分块检索、会话
│   ├── migrations/      Alembic
│   └── tests/           pytest 套件
├── scripts/e2e_check.mjs
├── storage/             上传文件 + 本地 SQLite 数据库
├── docker-compose.yml
├── .env.example
├── README.md
└── AGENTS.md
```
