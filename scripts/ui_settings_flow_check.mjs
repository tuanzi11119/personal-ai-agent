
const BASE = "http://127.0.0.1:3000";
const FAKE = "http://127.0.0.1:9099/v1";
const KEY = "sk-ui-test-9f8e7d6c5b4a";
const out = [];
const check = (ok, name, detail = "") => { out.push([ok, name]); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " | " + detail : "")); };
let cookie = "";
const email = "ui-" + Math.random().toString(16).slice(2, 10) + "@example.com";

async function call(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, text };
}

const reg = await call("/api/auth/register", { method: "POST", body: JSON.stringify({ username: "UI Tester", email, password: "Passw0rd!123" }) });
check(reg.status === 201 && cookie.startsWith("pai_token="), "register_through_next_proxy", "status=" + reg.status);

const put = await call("/api/settings/llm", { method: "PUT", body: JSON.stringify({
  base_url: FAKE, api_key: KEY, model_name: "fake-gpt-4o", temperature: 0.2, max_tokens: 400,
  embedding_base_url: FAKE, embedding_api_key: KEY, embedding_model: "fake-embed-384", embedding_dimension: 384,
})});
check(put.status === 200, "save_settings_through_proxy", "status=" + put.status);
check(!put.text.includes(KEY) && put.body.api_key_hint && put.body.api_key_hint !== KEY, "key_masked_in_save_response", "hint=" + JSON.stringify(put.body.api_key_hint));

const test = await call("/api/settings/llm/test", { method: "POST" });
check(test.status === 200 && test.body.mode === "live", "test_connection_live", JSON.stringify(test.body).slice(0, 90));
check(!test.text.includes(KEY), "test_response_hides_key");

const page = await call("/dashboard/settings", { headers: { accept: "text/html" } });
check(page.status === 200, "settings_page_html_200", "len=" + String(page.body).length);

const agent = await call("/api/agents", { method: "POST", body: JSON.stringify({ name: "UI flow agent", description: "d", system_prompt: "你是候选人的 AI 助手。", is_public: true }) });
check(agent.status === 201, "create_agent", "status=" + agent.status);
const agentId = agent.body.id;

const fd = new FormData();
fd.append("file", new Blob(["张三熟悉 Python、FastAPI 和 PostgreSQL。"], { type: "text/plain" }), "resume.txt");
const upRes = await fetch(BASE + "/api/agents/" + agentId + "/documents", { method: "POST", headers: { cookie }, body: fd });
const upBody = await upRes.json();
check(upRes.status === 201 && upBody.status === "ready", "upload_doc_ready", "chunks=" + upBody.chunk_count);

const chat = await call("/api/agents/" + agentId + "/chat", { method: "POST", body: JSON.stringify({ message: "张三熟悉什么技术？" }) });
const answer = chat.body?.message?.content || "";
check(chat.status === 200 && chat.body.mode === "live", "chat_live_mode", "mode=" + chat.body?.mode);
check(answer.includes("[LIVE-PROVIDER:fake-gpt-4o]"), "answer_from_configured_api", answer.slice(0, 60));
check((chat.body.sources || []).length > 0, "sources_returned", "n=" + (chat.body.sources || []).length);
check(!chat.text.includes(KEY), "chat_hides_key");

const passed = out.filter(([ok]) => ok).length;
console.log("SUMMARY passed=" + passed + " failed=" + (out.length - passed) + " total=" + out.length);
