"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Copy, ExternalLink, MessagesSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError, type Agent } from "@/lib/api";
import { Badge, Card, CardContent, CardFooter, CardHeader, CardTitle, ErrorBanner, Spinner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, initials } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const data = await api.listAgents();
      setAgents(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载 Agent 列表失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function remove(agent: Agent) {
    if (!window.confirm(`确定删除「${agent.name}」吗？它的文档与聊天记录会一并删除。`)) return;
    try {
      await api.deleteAgent(agent.id);
      setAgents((prev) => prev.filter((item) => item.id !== agent.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除 Agent 失败。");
    }
  }

  async function share(agent: Agent) {
    if (!agent.is_public) {
      setError("这个 Agent 目前是私有的。请先在 Agent 设置里开启公开访问，再分享链接。");
      return;
    }
    const url = `${window.location.origin}${agent.public_path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(agent.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError(`请手动复制这个链接：${url}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">我的 Agent</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "加载中…" : `工作区共有 ${agents.length} 个 Agent`}
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button>
            <Plus className="h-4 w-4" />
            创建 Agent
          </Button>
        </Link>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> 正在加载 Agent…
        </div>
      ) : null}

      {!loading && agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
              <Bot className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="text-lg font-medium">还没有任何 Agent</p>
              <p className="text-sm text-muted-foreground">
                创建你的第一个个人 AI 分身，上传简历，然后把链接分享出去。
              </p>
            </div>
            <Link href="/dashboard/agents/new">
              <Button>
                <Plus className="h-4 w-4" />
                创建第一个 Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="flex flex-col">
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-primary">
                {agent.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" />
                ) : (
                  initials(agent.name)
                )}
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base">{agent.name}</CardTitle>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">/a/{agent.slug}</p>
              </div>
              <Badge variant={agent.is_public ? "success" : "secondary"}>
                {agent.is_public ? "公开" : "私有"}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="line-clamp-3 min-h-[3rem] text-sm text-muted-foreground">
                {agent.description || "还没有填写简介。"}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{agent.document_count} 份文档</span>
                <span>·</span>
                <span>更新于 {formatDate(agent.updated_at)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex-wrap gap-2 border-t pt-4">
              <Link href={`/dashboard/agents/${agent.id}`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
              </Link>
              <Link href={`/dashboard/agents/${agent.id}?tab=playground`}>
                <Button variant="outline" size="sm">
                  <MessagesSquare className="h-3.5 w-3.5" />
                  对话
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => void share(agent)}>
                {copiedId === agent.id ? <Copy className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                {copiedId === agent.id ? "已复制" : "分享"}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(agent)}>
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
