"use client";

import * as React from "react";
import { CheckCircle2, KeyRound, Save, Server, Zap } from "lucide-react";
import { api, ApiError, type LLMSettings } from "@/lib/api";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorBanner, Spinner } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type FormState = {
  base_url: string;
  api_key: string;
  model_name: string;
  temperature: string;
  max_tokens: string;
  embedding_base_url: string;
  embedding_api_key: string;
  embedding_model: string;
  embedding_dimension: string;
};

const EMPTY: FormState = {
  base_url: "",
  api_key: "",
  model_name: "",
  temperature: "0.3",
  max_tokens: "800",
  embedding_base_url: "",
  embedding_api_key: "",
  embedding_model: "",
  embedding_dimension: "",
};

function toForm(settings: LLMSettings): FormState {
  return {
    base_url: settings.base_url ?? "",
    api_key: "",
    model_name: settings.model_name ?? "",
    temperature: String(settings.temperature ?? 0.3),
    max_tokens: String(settings.max_tokens ?? 800),
    embedding_base_url: settings.embedding_base_url ?? "",
    embedding_api_key: "",
    embedding_model: settings.embedding_model ?? "",
    embedding_dimension: settings.embedding_dimension ? String(settings.embedding_dimension) : "",
  };
}

function modeLabel(mode: string): string {
  if (mode === "mock") return "Mock 模式（未接入真实模型）";
  if (mode === "live" || mode === "real") return "真实模型";
  return mode;
}

const CJK = /[\u4e00-\u9fff]/;

// GET /settings/llm creates the row on first read. Dev Strict Mode runs the
// effect twice; sharing one in-flight request avoids a duplicate insert.
let settingsRequest: Promise<LLMSettings> | null = null;

function loadSettings(): Promise<LLMSettings> {
  if (!settingsRequest) {
    settingsRequest = api.getSettings().finally(() => {
      settingsRequest = null;
    });
  }
  return settingsRequest;
}

type LlmPreset = { label: string; base_url: string; model_name: string };

const LLM_PRESETS: LlmPreset[] = [
  { label: "DeepSeek V3", base_url: "https://api.deepseek.com/v1", model_name: "deepseek-chat" },
  { label: "DeepSeek R1", base_url: "https://api.deepseek.com/v1", model_name: "deepseek-reasoner" },
  { label: "OpenAI", base_url: "https://api.openai.com/v1", model_name: "gpt-4o-mini" },
  {
    label: "通义千问",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model_name: "qwen-plus",
  },
  { label: "本地 Ollama", base_url: "http://127.0.0.1:11434/v1", model_name: "llama3.1" },
];

export default function ModelSettingsPage() {
  const [settings, setSettings] = React.useState<LLMSettings | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState<"success" | "warning">("success");

  const load = React.useCallback(async () => {
    try {
      const data = await loadSettings();
      setSettings(data);
      setForm(toForm(data));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载模型设置失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = {
        base_url: form.base_url.trim(),
        model_name: form.model_name.trim(),
        temperature: Number(form.temperature) || 0,
        max_tokens: Number(form.max_tokens) || 800,
        embedding_base_url: form.embedding_base_url.trim(),
        embedding_model: form.embedding_model.trim(),
        embedding_dimension: form.embedding_dimension ? Number(form.embedding_dimension) : null,
        api_key: form.api_key.trim() ? form.api_key.trim() : null,
        embedding_api_key: form.embedding_api_key.trim() ? form.embedding_api_key.trim() : null,
      };
      const saved = await api.saveSettings(payload);
      setSettings(saved);
      setForm(toForm(saved));
      setMessageTone("success");
      setMessage("设置已保存，之后的新对话会使用这套配置。");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存模型设置失败。");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setError("");
    setMessage("");
    setTesting(true);
    try {
      const result = await api.testSettings();
      if (result.ok) {
        const detail = `连接成功（${modeLabel(result.mode)}${result.model ? " · " + result.model : ""}）`;
        setMessageTone("success");
        setMessage(detail);
      } else {
        setMessageTone("warning");
        setMessage(result.detail && CJK.test(result.detail) ? result.detail : "连接失败：请检查接口地址、模型名称与 API Key 是否正确。");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "连接测试失败。");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">模型设置</h1>
        <p className="text-sm text-muted-foreground">
          接入任意 OpenAI 兼容的对话与向量接口，或继续使用平台默认配置。
        </p>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}
      {message ? (
        <div
          className={
            messageTone === "warning"
              ? "flex items-center gap-2 rounded-[8px] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning"
              : "flex items-center gap-2 rounded-[8px] border border-success/30 bg-success-soft px-3 py-2 text-sm text-success"
          }
        >
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      {loading || !settings ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <span className="sr-only">正在加载设置…</span>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">平台状态</CardTitle>
              <CardDescription>
                上面两枚「平台默认」徽章是未配置个人密钥时的兜底配置；下面这枚是当前实际生效的配置。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <Badge variant={settings.platform_mode === "mock" ? "secondary" : "success"}>
                平台默认对话：{modeLabel(settings.platform_mode)}
              </Badge>
              <Badge variant={settings.platform_embedding_mode === "mock" ? "secondary" : "success"}>
                平台默认向量：{modeLabel(settings.platform_embedding_mode)}
              </Badge>
              {settings.has_custom_config ? (
                <Badge variant="success">当前生效：个人对话模型 · {settings.model_name}</Badge>
              ) : (
                <Badge variant="secondary">当前生效：平台默认（{modeLabel(settings.platform_mode)}）</Badge>
              )}
              {settings.has_embedding_api_key && settings.embedding_model ? (
                <Badge variant="success">当前生效：个人向量模型 · {settings.embedding_model}</Badge>
              ) : null}
              <Badge variant="outline">向量维度：{settings.configured_dimension} 维</Badge>
              {settings.has_api_key ? (
                <Badge variant="outline">
                  <KeyRound className="mr-1 h-3 w-3" /> 个人密钥 {settings.api_key_hint}
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          <form onSubmit={save} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <Server className="mr-1 inline h-4 w-4" />
                  对话模型
                </CardTitle>
                <CardDescription>任意 OpenAI 兼容的 /chat/completions 接口。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>快捷填充</Label>
                  <div className="flex flex-wrap gap-2">
                    {LLM_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            base_url: preset.base_url,
                            model_name: preset.model_name,
                          }))
                        }
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    点一下即可填好接口地址和模型名称，再填上你的 API Key 保存即可。
                  </p>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="base_url">接口地址（Base URL）</Label>
                  <Input
                    id="base_url"
                    value={form.base_url}
                    onChange={(event) => update("base_url", event.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model_name">模型名称</Label>
                  <Input
                    id="model_name"
                    value={form.model_name}
                    onChange={(event) => update("model_name", event.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    autoComplete="off"
                    value={form.api_key}
                    onChange={(event) => update("api_key", event.target.value)}
                    placeholder={settings.has_api_key ? "已保存密钥，留空表示不修改" : "sk-…"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="temperature">温度（temperature）</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature}
                    onChange={(event) => update("temperature", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_tokens">最大 Token 数</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    min="64"
                    max="4096"
                    value={form.max_tokens}
                    onChange={(event) => update("max_tokens", event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">向量模型</CardTitle>
                <CardDescription>
                  向量维度必须与知识库建立索引时的维度一致（{settings.configured_dimension} 维）。
                  修改维度后需要重新上传文档。若服务商不提供向量接口（例如 DeepSeek），这一整张卡留空即可，
                  检索会继续使用平台默认向量。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="embedding_base_url">向量接口地址</Label>
                  <Input
                    id="embedding_base_url"
                    value={form.embedding_base_url}
                    onChange={(event) => update("embedding_base_url", event.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="embedding_model">向量模型名称</Label>
                  <Input
                    id="embedding_model"
                    value={form.embedding_model}
                    onChange={(event) => update("embedding_model", event.target.value)}
                    placeholder="text-embedding-3-small"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="embedding_dimension">向量维度</Label>
                  <Input
                    id="embedding_dimension"
                    type="number"
                    min="64"
                    max="3072"
                    value={form.embedding_dimension}
                    onChange={(event) => update("embedding_dimension", event.target.value)}
                    placeholder={String(settings.configured_dimension)}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="embedding_api_key">向量 API Key</Label>
                  <Input
                    id="embedding_api_key"
                    type="password"
                    autoComplete="off"
                    value={form.embedding_api_key}
                    onChange={(event) => update("embedding_api_key", event.target.value)}
                    placeholder={settings.has_embedding_api_key ? "已保存密钥，留空表示不修改" : "sk-…"}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : <Save className="h-4 w-4" />}
                保存设置
              </Button>
              <Button variant="outline" onClick={() => void testConnection()} disabled={testing}>
                {testing ? <Spinner /> : <Zap className="h-4 w-4" />}
                测试连接
              </Button>
              <span className="text-xs text-muted-foreground">
                密钥在服务端加密保存，永远不会返回浏览器。
              </span>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
