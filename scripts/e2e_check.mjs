// End-to-end HTTP walkthrough of the deployed MVP.
// Usage: node scripts/e2e_check.mjs [baseUrl]
// Defaults to http://127.0.0.1:3000 (Next.js proxy -> FastAPI on :8000).
const BASE = process.argv[2] || "http://127.0.0.1:3000";

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => k + "=" + v).join("; ");
  }
  async request(path, { method = "GET", body, headers = {} } = {}) {
    const h = { ...headers };
    const cookie = this.cookieHeader();
    if (cookie) h.cookie = cookie;
    const res = await fetch(BASE + path, { method, body, headers: h, redirect: "manual" });
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === "" || /expires=Thu, 01 Jan 1970/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, text, json };
  }
  json(path, method, payload) {
    return this.request(path, {
      method,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      headers: payload === undefined ? {} : { "content-type": "application/json" },
    });
  }
}

const results = [];
function record(check, ok, detail) {
  results.push({ check, ok: !!ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + check + " :: " + detail);
}
const short = (v, n = 160) => String(v ?? "").replace(/\s+/g, " ").slice(0, n);

async function main() {
  const stamp = Date.now();
  const emailA = "e2e.a." + stamp + "@example.com";
  const emailB = "e2e.b." + stamp + "@example.com";
  const password = "correct-horse-battery-9";

  // 1. Landing page
  const anonSession = new Session("anon");
  const landing = await anonSession.request("/");
  record("landing_page",
    landing.status === 200 &&
      landing.text.includes("创建你的个人 AI 分身") &&
      landing.text.includes("Create Your Personal AI Twin"),
    "status=" + landing.status + " zh_title=" + landing.text.includes("创建你的个人 AI 分身"));

  // 2. Auth pages
  const loginPage = await anonSession.request("/login");
  const registerPage = await anonSession.request("/register");
  record("auth_pages",
    loginPage.status === 200 && registerPage.status === 200 &&
      loginPage.text.includes("登录") && registerPage.text.includes("注册"),
    "login=" + loginPage.status + " register=" + registerPage.status);

  // 3. Private API requires auth
  const anonAgents = await anonSession.request("/api/agents");
  record("private_api_requires_auth", anonAgents.status === 401, "status=" + anonAgents.status);

  // 4. Register user A
  const alice = new Session("alice");
  const regA = await alice.json("/api/auth/register", "POST", { username: "E2E Alice", email: emailA, password });
  record("register_user_a", regA.status === 201 && regA.json?.user?.email === emailA, "status=" + regA.status + " userId=" + regA.json?.user?.id);
  const meA = await alice.request("/api/auth/me");
  record("auth_me", meA.status === 200 && meA.json?.email === emailA, "status=" + meA.status);

  // 4b. Authenticated console pages render the Chinese shell
  const dashboardPage = await alice.request("/dashboard");
  const settingsPage = await alice.request("/dashboard/settings");
  record("dashboard_pages_zh",
    dashboardPage.status === 200 && settingsPage.status === 200 &&
      dashboardPage.text.includes("正在进入控制台") && settingsPage.text.includes("正在进入控制台"),
    "dashboard=" + dashboardPage.status + " settings=" + settingsPage.status);

  // 5. Create public agent
  const created = await alice.json("/api/agents", "POST", {
    name: "Zhang San AI Twin",
    description: "AI digital twin of Zhang San, a backend engineer.",
    system_prompt: "你是张三的 AI 数字分身。只根据知识库回答，不知道就说不知道。",
    is_public: true,
  });
  const agent = created.json;
  const agentId = agent?.id;
  const slug = agent?.slug;
  record("create_agent", created.status === 201 && agent?.is_public === true && agent?.public_path === "/a/" + slug, "status=" + created.status + " id=" + agentId + " slug=" + slug);

  // 6. Second user cannot touch agent A
  const bob = new Session("bob");
  const regB = await bob.json("/api/auth/register", "POST", { username: "E2E Bob", email: emailB, password });
  record("register_user_b", regB.status === 201, "status=" + regB.status);
  const crossRead = await bob.request("/api/agents/" + agentId);
  const crossDocs = await bob.request("/api/agents/" + agentId + "/documents");
  const crossChat = await bob.json("/api/agents/" + agentId + "/chat", "POST", { message: "hi" });
  record("cross_user_isolation", crossRead.status === 404 && crossDocs.status === 404 && crossChat.status === 404,
    "agent=" + crossRead.status + " docs=" + crossDocs.status + " chat=" + crossChat.status);

  // 7. Upload knowledge document
  const resumeText = [
    "张三的简历",
    "",
    "姓名：张三",
    "技能：熟悉 Python、FastAPI 和 PostgreSQL。",
    "经历：2021 年至 2023 年在一家电商公司担任后端工程师，负责订单系统。",
    "项目：主导了基于 FastAPI 的订单服务重构，把接口平均延迟降低了 40%。",
  ].join("\n");
  const form = new FormData();
  form.append("file", new Blob([resumeText], { type: "text/plain" }), "resume.txt");
  const upload = await alice.request("/api/agents/" + agentId + "/documents", { method: "POST", body: form });
  const doc = upload.json;
  record("upload_document", upload.status === 201 && doc?.status === "ready" && doc?.chunk_count >= 1,
    "status=" + upload.status + " doc_status=" + doc?.status + " chunks=" + doc?.chunk_count + " error=" + (doc?.error_message || ""));

  const docList = await alice.request("/api/agents/" + agentId + "/documents");
  record("list_documents", docList.status === 200 && docList.json?.total >= 1, "total=" + docList.json?.total);

  // 8. Scenario A: known fact
  const chatA = await alice.json("/api/agents/" + agentId + "/chat", "POST", { message: "张三熟悉什么技术？", top_k: 4 });
  if (chatA.status !== 200) console.log("chat debug:", chatA.status, short(chatA.text, 400));
  const answerA = String(chatA.json?.message?.content ?? "");
  const sourcesA = chatA.json?.sources || [];
  record("scenario_a_known_fact", chatA.status === 200 && /python/i.test(answerA) && sourcesA.length >= 1,
    "mode=" + chatA.json?.mode + " sources=" + sourcesA.length + " answer=" + short(answerA));
  const playgroundConversation = chatA.json?.conversation_id;

  // 9. Scenario B: unknown fact must not be fabricated
  const chatB = await alice.json("/api/agents/" + agentId + "/chat", "POST", { message: "张三是否有五年字节跳动工作经验？", conversation_id: playgroundConversation });
  const answerB = String(chatB.json?.message?.content ?? "");
  record("scenario_b_unknown_fact", chatB.status === 200 && !answerB.includes("字节跳动") && chatB.json?.conversation_id === playgroundConversation,
    "conversation_reused=" + (chatB.json?.conversation_id === playgroundConversation) + " answer=" + short(answerB));

  // 9b. Scenario B (strict): an agent with an empty knowledge base must refuse instead of inventing.
  const emptyAgentRes = await alice.json("/api/agents", "POST", {
    name: "Empty KB Agent",
    description: "Agent used to verify the no-knowledge fallback.",
    is_public: false,
  });
  const emptyAgentId = emptyAgentRes.json?.id;
  const emptyChat = await alice.json("/api/agents/" + emptyAgentId + "/chat", "POST", { message: "张三是否有五年字节跳动工作经验？" });
  const emptyAnswer = String(emptyChat.json?.message?.content ?? "");
  record("scenario_b_no_knowledge_refusal",
    emptyChat.status === 200 && /没有找到|could not find/i.test(emptyAnswer) && (emptyChat.json?.sources || []).length === 0,
    "sources=" + (emptyChat.json?.sources || []).length + " answer=" + short(emptyAnswer));
  await alice.request("/api/agents/" + emptyAgentId, { method: "DELETE" });

  // 10. Public profile + anonymous chat
  const visitor1 = new Session("visitor1");
  const profile = await visitor1.request("/api/public/agents/" + slug);
  const fields = profile.json ? Object.keys(profile.json) : [];
  record("public_profile", profile.status === 200 && profile.json?.slug === slug,
    "status=" + profile.status + " fields=" + fields.join(","));
  record("public_profile_no_private_fields", !fields.includes("system_prompt") && !fields.includes("user_id") && !fields.includes("document_count"),
    "fields=" + fields.join(","));

  const publicChat = await visitor1.json("/api/public/agents/" + slug + "/chat", "POST", { message: "他熟悉什么技术栈？" });
  const publicSources = publicChat.json?.sources || [];
  record("scenario_public_chat", publicChat.status === 200 && publicSources.length >= 1 && /python/i.test(String(publicChat.json?.message?.content ?? "")),
    "status=" + publicChat.status + " sources=" + publicSources.length + " excerpt_len=" + (publicSources[0]?.excerpt || "").length);
  record("public_excerpt_truncated", publicSources.every((s) => (s.excerpt || "").length <= 120), "max_excerpt=" + Math.max(0, ...publicSources.map((s) => (s.excerpt || "").length)));

  // 11. Scenario G: visitor isolation
  const visitor2 = new Session("visitor2");
  const visitor2Chat = await visitor2.json("/api/public/agents/" + slug + "/chat", "POST", { message: "他的项目经历是什么？" });
  const steal = await visitor2.request("/api/public/agents/" + slug + "/conversations/" + publicChat.json?.conversation_id);
  record("scenario_g_visitor_isolation", visitor2Chat.status === 200 && steal.status === 404, "other_visitor_status=" + steal.status);
  const ownHistory = await visitor1.request("/api/public/agents/" + slug + "/conversations/" + publicChat.json?.conversation_id);
  record("visitor_own_history", ownHistory.status === 200 && (ownHistory.json?.messages || []).length >= 2, "messages=" + (ownHistory.json?.messages || []).length);
  const ownerConversationLeak = await visitor1.request("/api/public/agents/" + slug + "/conversations/" + playgroundConversation);
  record("public_cannot_read_owner_conversation", ownerConversationLeak.status === 404, "status=" + ownerConversationLeak.status);

  // 12. Scenario D: unpublish disables the public link immediately
  const unpublish = await alice.json("/api/agents/" + agentId, "PATCH", { is_public: false });
  const publicAfterUnpublish = await visitor1.request("/api/public/agents/" + slug);
  const publicChatAfterUnpublish = await visitor1.json("/api/public/agents/" + slug + "/chat", "POST", { message: "hi" });
  record("scenario_d_unpublish_blocks_public", unpublish.status === 200 && publicAfterUnpublish.status === 404 && publicChatAfterUnpublish.status === 404,
    "profile=" + publicAfterUnpublish.status + " chat=" + publicChatAfterUnpublish.status);
  await alice.json("/api/agents/" + agentId, "PATCH", { is_public: true });

  // 13. Scenario E: deleting a document removes its chunks
  const deleted = await alice.request("/api/agents/" + agentId + "/documents/" + doc?.id, { method: "DELETE" });
  const afterDelete = await alice.request("/api/agents/" + agentId);
  const chatAfterDelete = await alice.json("/api/agents/" + agentId + "/chat", "POST", { message: "张三熟悉什么技术？" });
  record("scenario_e_delete_cleans_chunks", deleted.status === 204 && afterDelete.json?.document_count === 0 && (chatAfterDelete.json?.sources || []).length === 0,
    "delete=" + deleted.status + " docs=" + afterDelete.json?.document_count + " sources_after=" + (chatAfterDelete.json?.sources || []).length);

  // 14. Public page HTML
  const publicPage = await anonSession.request("/a/" + slug);
  record("public_page_html",
    publicPage.status === 200 && publicPage.text.includes("正在加载 Agent"),
    "status=" + publicPage.status + " bytes=" + publicPage.text.length + " zh_loading=" + publicPage.text.includes("正在加载 Agent"));

  // 15. Scenario F: broken model config surfaces an error without leaking the key
  const saved = await alice.json("/api/settings/llm", "PUT", {
    base_url: "http://127.0.0.1:9/v1",
    api_key: "sk-e2e-secret-should-never-return",
    model_name: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 500,
  });
  const settingsRead = await alice.request("/api/settings/llm");
  const failingChat = await alice.json("/api/agents/" + agentId + "/chat", "POST", { message: "hello" });
  const bodyText = JSON.stringify(failingChat.json || {});
  const keyLeaked = JSON.stringify(saved.json || {}).includes("sk-e2e-secret") || settingsRead.text.includes("sk-e2e-secret") || bodyText.includes("sk-e2e-secret");
  record("scenario_f_bad_key_errors_without_leak", !keyLeaked && failingChat.status === 502,
    "status=" + failingChat.status + " key_leaked=" + keyLeaked + " body=" + short(bodyText, 200));
  await alice.json("/api/settings/llm", "PUT", { base_url: "", model_name: "" });

  // 16. Logout
  const logout = await alice.request("/api/auth/logout", { method: "POST" });
  const meAfterLogout = await alice.request("/api/auth/me");
  record("logout", logout.status === 204 && meAfterLogout.status === 401, "logout=" + logout.status + " me_after=" + meAfterLogout.status);

  const failed = results.filter((r) => !r.ok);
  console.log("\nSUMMARY passed=" + (results.length - failed.length) + " failed=" + failed.length + " total=" + results.length);
  if (failed.length) {
    console.log(JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exitCode = 1;
});
