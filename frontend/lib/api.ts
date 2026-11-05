// Typed client for the FastAPI backend. All requests go to /api/* which the
// Next.js server rewrites to the backend, so cookies stay first-party.

export type User = {
  id: string;
  email: string;
  username: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Agent = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  avatar_url: string;
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  document_count: number;
  public_path: string;
};

export type AgentInput = {
  name: string;
  description?: string;
  system_prompt?: string;
  avatar_url?: string;
  is_public?: boolean;
};

export type PublicAgent = {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  slug: string;
  suggested_questions: string[];
};

export type DocumentItem = {
  id: string;
  agent_id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  status: "pending" | "processing" | "ready" | "error" | string;
  error_message: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

export type DocumentList = { items: DocumentItem[]; total: number };

export type Source = {
  document_id: string;
  filename: string;
  chunk_index: number;
  score: number;
  excerpt: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  sources: Source[];
  created_at: string;
};

export type ChatResponse = {
  conversation_id: string;
  message: Message;
  sources: Source[];
  mode: string;
  model: string | null;
  degraded: boolean;
  notice: string | null;
};

export type Conversation = {
  id: string;
  agent_id: string;
  channel: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
};

export type ConversationList = { items: Conversation[]; total: number };

export type LLMSettings = {
  has_custom_config: boolean;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  api_key_hint: string;
  has_api_key: boolean;
  embedding_base_url: string;
  embedding_model: string;
  embedding_dimension: number | null;
  embedding_api_key_hint: string;
  has_embedding_api_key: boolean;
  updated_at: string | null;
  platform_mode: string;
  platform_embedding_mode: string;
  configured_dimension: number;
};

export type LLMSettingsInput = {
  base_url?: string;
  api_key?: string | null;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  embedding_base_url?: string;
  embedding_api_key?: string | null;
  embedding_model?: string;
  embedding_dimension?: number | null;
};

export type TestConnectionResult = { ok: boolean; mode: string; model: string | null; detail: string };
export type HealthStatus = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// The backend returns stable machine-readable error codes plus English detail.
// The console is Chinese, so map the codes to user-facing Chinese copy here.
const ERROR_MESSAGES: Record<string, string> = {
  network_error: "网络错误：无法连接服务端，请确认后端已启动后重试。",
  unauthorized: "登录状态已失效，请重新登录。",
  invalid_credentials: "邮箱或密码不正确。",
  email_taken: "该邮箱已经被注册，请直接登录。",
  validation_error: "填写内容不符合要求，请检查后重试。",
  not_found: "内容不存在，或你没有访问权限。",
  forbidden: "你没有权限执行该操作。",
  conflict: "操作冲突，请刷新页面后重试。",
  duplicate_document: "这份文档已经上传过了，无需重复上传。",
  rate_limited: "请求过于频繁，请稍后再试。",
  llm_error: "模型服务调用失败，请到「模型设置」检查接口地址、模型名称和 API Key。",
  upstream_error: "模型服务暂时不可用，请稍后重试。",
  internal_error: "服务端开小差了，请稍后重试。",
  bad_request: "请求参数有误，请检查后重试。",
  http_error: "请求失败，请稍后重试。",
};

const CJK = /[\u4e00-\u9fff]/;

// `llm_error` covers every upstream failure; the English detail tells them apart, so map it to a
// short Chinese cause instead of always blaming the API key (e.g. DeepSeek's 402 = no balance).
const LLM_ERROR_CAUSES: Array<[RegExp, string]> = [
  [/401|403|rejected the API key/i, "密钥无效或无权访问该模型"],
  [/404|not found/i, "接口地址或模型名称不存在"],
  [/429|rate limit/i, "请求过于频繁"],
  [/402|balance|quota|insufficient|billing/i, "账户余额或额度不足"],
  [/timed out|timeout/i, "请求超时"],
  [/unreachable|ConnectError|InvalidURL/i, "无法连接该接口，请检查网络或代理"],
  [/empty answer|unexpected response format/i, "接口返回内容无法解析"],
  [/5\d\d|failing/i, "模型服务端故障"],
];

function llmErrorMessage(serverMessage: string): string {
  const cause = LLM_ERROR_CAUSES.find(([pattern]) => pattern.test(serverMessage))?.[1];
  if (cause) return `模型服务调用失败（${cause}），请到「模型设置」检查配置。`;
  return ERROR_MESSAGES.llm_error;
}

function localizeError(code: string, status: number, serverMessage: string): string {
  if (code === "llm_error") return llmErrorMessage(serverMessage);
  const known = ERROR_MESSAGES[code];
  if (known) return known;
  if (serverMessage && CJK.test(serverMessage)) return serverMessage;
  return `请求失败（HTTP ${status}）`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  } catch {
    throw new ApiError(ERROR_MESSAGES.network_error, 0, "network_error");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const body = payload as { error?: { message?: string; code?: string } } | null;
    const code = body?.error?.code ?? "http_error";
    const serverMessage = body?.error?.message ?? "";
    throw new ApiError(localizeError(code, response.status, serverMessage), response.status, code);
  }
  return payload as T;
}

function jsonBody(data: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(data) };
}

export const api = {
  me: () => request<User>("/api/auth/me"),
  register: (data: { username: string; email: string; password: string }) =>
    request<AuthResponse>("/api/auth/register", jsonBody(data)),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", jsonBody(data)),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  listAgents: () => request<Agent[]>("/api/agents"),
  createAgent: (data: AgentInput) => request<Agent>("/api/agents", jsonBody(data)),
  getAgent: (id: string) => request<Agent>(`/api/agents/${id}`),
  updateAgent: (id: string, data: Partial<AgentInput>) =>
    request<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAgent: (id: string) => request<void>(`/api/agents/${id}`, { method: "DELETE" }),

  listDocuments: (agentId: string) =>
    request<DocumentList>(`/api/agents/${agentId}/documents`),
  uploadDocument: (agentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentItem>(`/api/agents/${agentId}/documents`, { method: "POST", body: form });
  },
  deleteDocument: (agentId: string, documentId: string) =>
    request<void>(`/api/agents/${agentId}/documents/${documentId}`, { method: "DELETE" }),

  chat: (agentId: string, data: { message: string; conversation_id?: string | null; top_k?: number }) =>
    request<ChatResponse>(`/api/agents/${agentId}/chat`, jsonBody(data)),
  listConversations: (agentId: string) =>
    request<ConversationList>(`/api/agents/${agentId}/conversations`),
  getConversation: (agentId: string, conversationId: string) =>
    request<Conversation>(`/api/agents/${agentId}/conversations/${conversationId}`),

  publicAgent: (slug: string) => request<PublicAgent>(`/api/public/agents/${slug}`),
  publicChat: (slug: string, data: { message: string; conversation_id?: string | null; top_k?: number }) =>
    request<ChatResponse>(`/api/public/agents/${slug}/chat`, jsonBody(data)),
  publicConversation: (slug: string, conversationId: string) =>
    request<Conversation>(`/api/public/agents/${slug}/conversations/${conversationId}`),

  getSettings: () => request<LLMSettings>("/api/settings/llm"),
  saveSettings: (data: LLMSettingsInput) =>
    request<LLMSettings>("/api/settings/llm", { method: "PUT", body: JSON.stringify(data) }),
  testSettings: () => request<TestConnectionResult>("/api/settings/llm/test", { method: "POST" }),
  health: () => request<HealthStatus>("/api/health"),
};
