"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, ShieldCheck } from "lucide-react";
import { api, ApiError, type PublicAgent } from "@/lib/api";
import { ChatPanel } from "@/components/chat-panel";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";
import { initials } from "@/lib/utils";

export default function PublicAgentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [agent, setAgent] = React.useState<PublicAgent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    api
      .publicAgent(slug)
      .then((data) => {
        if (!cancelled) setAgent(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "这个 Agent 暂时不可用：可能未开启公开访问，或已被删除。"
              : err instanceof Error
                ? err.message
                : "加载这个 Agent 失败。",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> 正在加载 Agent…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border bg-muted text-muted-foreground">
          <Bot className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold">Agent 不可用</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <Link href="/">
          <Button variant="secondary">返回首页</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden text-sm text-info hover:underline sm:inline">
            创建你自己的分身
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-4">
        <section className="shrink-0 rounded-[12px] border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-medium">
              {agent.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(agent.name)
              )}
            </span>
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-lg font-semibold">{agent.name}</h1>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">个人 AI 分身</Badge>
                <Badge variant="outline">AI 数字分身</Badge>
              </div>
              {agent.description ? <p className="text-sm text-muted-foreground">{agent.description}</p> : null}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                我是这位候选人的 AI 助手，并非候选人本人。
              </p>
            </div>
          </div>
        </section>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border bg-card">
          <ChatPanel
            botName={agent.name}
            botAvatarUrl={agent.avatar_url}
            introTitle="你好，我是这位候选人的 AI 助手。"
            introLines={["他的项目经历", "他的技术能力与技术栈", "他在项目中承担的职责"]}
            suggestedQuestions={agent.suggested_questions}
            disclaimer="回答基于这位候选人上传的知识库生成；对话只保存在当前浏览器会话中。"
            emptyHint="在下方输入你的问题，或点选推荐问题。"
            onSend={(message, currentConversationId, signal) =>
              api.publicChat(slug, { message, conversation_id: currentConversationId }, { signal })
            }
            onLoadConversation={(id) => api.publicConversation(slug, id)}
            initialConversationId={null}
          />
        </section>
      </div>
    </div>
  );
}
