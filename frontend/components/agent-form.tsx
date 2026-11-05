"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Agent } from "@/lib/api";
import { DEFAULT_PERSONA } from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorBanner, Spinner } from "@/components/ui/card";

type AgentFormProps = {
  agent?: Agent;
  mode: "create" | "edit";
  onSaved?: (agent: Agent) => void;
};

export function AgentForm({ agent, mode, onSaved }: AgentFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(agent?.name ?? "");
  const [description, setDescription] = React.useState(agent?.description ?? "");
  const [systemPrompt, setSystemPrompt] = React.useState(agent?.system_prompt ?? DEFAULT_PERSONA);
  const [avatarUrl, setAvatarUrl] = React.useState(agent?.avatar_url ?? "");
  const [isPublic, setIsPublic] = React.useState(agent?.is_public ?? false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        system_prompt: systemPrompt,
        avatar_url: avatarUrl.trim(),
        is_public: isPublic,
      };
      const savedAgent = mode === "create" ? await api.createAgent(payload) : await api.updateAgent(agent!.id, payload);
      setSaved(true);
      if (mode === "create") {
        router.push(`/dashboard/agents/${savedAgent.id}`);
      } else {
        onSaved?.(savedAgent);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存 Agent 失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本身份</CardTitle>
          <CardDescription>访客第一眼看到的名称、头像与简介。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Agent 名称</Label>
              <Input
                id="name"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="示例：张三 · AI 求职分身"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatar">头像 URL（可选）</Label>
              <Input
                id="avatar"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">简短简介</Label>
            <Textarea
              id="description"
              maxLength={1000}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="后端工程师，专注 Python、FastAPI 与数据平台。"
            />
          </div>
          <div className="rounded-[8px] border p-3">
            <Checkbox
              checked={isPublic}
              onCheckedChange={setIsPublic}
              label="公开访问"
              description="任何拿到链接的人都可以和这个 Agent 对话；私有 Agent 的公开接口会返回 404。"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">人设与边界</CardTitle>
          <CardDescription>
            平台级护栏始终优先执行；这段提示词无法覆盖数据隔离与安全规则。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="system_prompt"
            rows={14}
            maxLength={8000}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner /> : null}
          {mode === "create" ? "创建 Agent" : "保存修改"}
        </Button>
        {saved && mode === "edit" ? <span className="text-sm text-success">已保存</span> : null}
      </div>
    </form>
  );
}
