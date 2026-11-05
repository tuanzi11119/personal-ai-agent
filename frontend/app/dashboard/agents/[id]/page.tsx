"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Copy, ExternalLink, MessagesSquare, Settings2, Trash2 } from "lucide-react";
import { api, ApiError, type Agent } from "@/lib/api";
import { AgentForm } from "@/components/agent-form";
import { ChatPanel } from "@/components/chat-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorBanner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";

type TabKey = "overview" | "knowledge" | "playground";

const PLAYGROUND_SUGGESTIONS = [
  "这位候选人最擅长的技术是什么？",
  "请介绍一下他最近做的一个项目。",
  "他用过哪些数据库和框架？",
];

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const [agent, setAgent] = React.useState<Agent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "knowledge" || requested === "playground" || requested === "overview") {
      setTab(requested);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const data = await api.getAgent(agentId);
      setAgent(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载 Agent 失败。");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function copyLink() {
    if (!agent) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${agent.public_path}`);
      toast({ title: "链接已复制", description: agent.public_path, tone: "success" });
    } catch {
      setError("复制失败，请手动选择下方链接复制。");
    }
  }

  async function removeAgent() {
    if (!agent) return;
    try {
      await api.deleteAgent(agent.id);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除 Agent 失败。");
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || "没有找到这个 Agent。"} />
        <Link href="/dashboard#agents">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            返回分身列表
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-medium">
            {agent.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agent.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(agent.name)
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{agent.name}</h1>
              <Badge variant={agent.is_public ? "success" : "secondary"}>{agent.is_public ? "公开" : "私有"}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {agent.document_count} 份文档 · /a/{agent.slug}
            </p>
          </div>
        </div>
        <Link href="/dashboard#agents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            全部分身
          </Button>
        </Link>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <Tabs
        aria-label="分身"
        stretch
        value={tab}
        onChange={(value) => setTab(value as TabKey)}
        items={[
          { value: "overview", label: "概览", icon: Settings2 },
          { value: "knowledge", label: "知识库", icon: BookOpen },
          { value: "playground", label: "对话测试", icon: MessagesSquare },
        ]}
      />

      {tab === "overview" ? (
        <div className="space-y-4">
          <AgentForm
            mode="edit"
            agent={agent}
            onSaved={(updated) => {
              setAgent(updated);
              void load();
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle>公开链接</CardTitle>
              <CardDescription>
                {agent.is_public
                  ? "任何拿到这条链接的人，无需注册即可与你的分身对话。"
                  : "这个 Agent 目前是私有的：在开启公开访问之前，公开链接会返回 404。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <code className="rounded-[6px] bg-muted px-2 py-1 font-mono text-xs">{agent.public_path}</code>
              <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
                <Copy className="h-3.5 w-3.5" />
                复制链接
              </Button>
              {agent.is_public ? (
                <a href={agent.public_path} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开公开页面
                  </Button>
                </a>
              ) : null}
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">危险操作</CardTitle>
              <CardDescription>删除 Agent 会同时删除它的文档、向量分块与全部对话记录。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                删除 Agent
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "knowledge" ? <KnowledgePanel agentId={agent.id} /> : null}

      {tab === "playground" ? (
        <Card className="flex h-[70vh] min-h-0 flex-col overflow-hidden">
          <ChatPanel
            botName={agent.name}
            botAvatarUrl={agent.avatar_url}
            introTitle={`你好，我是 ${agent.name} 的 AI 助手。`}
            introLines={["这位候选人的项目经历", "他的技术能力与技术栈", "他在过往项目中承担的职责"]}
            suggestedQuestions={PLAYGROUND_SUGGESTIONS}
            disclaimer="对话测试模式 · 回答仅基于这个 Agent 自己的知识库。"
            onSend={(message, conversationId, signal) =>
              api.chat(agent.id, { message, conversation_id: conversationId }, { signal })
            }
            onLoadConversation={(conversationId) => api.getConversation(agent.id, conversationId)}
          />
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title={`删除「${agent.name}」？`}
        description="所有文档与对话记录都会被删除。"
        confirmLabel="删除"
        destructive
        onConfirm={() => void removeAgent()}
        onOpenChange={setConfirmDelete}
      />
    </div>
  );
}
