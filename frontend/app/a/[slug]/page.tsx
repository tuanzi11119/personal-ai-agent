"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, ShieldCheck } from "lucide-react";
import { api, ApiError, type PublicAgent } from "@/lib/api";
import { ChatPanel } from "@/components/chat-panel";
import { Badge, Spinner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";

export default function PublicAgentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [agent, setAgent] = React.useState<PublicAgent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | null>(null);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-semibold">Agent 不可用</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <Link href="/">
          <Button variant="outline">返回首页</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4">
      <header className="flex flex-col items-center gap-3 border-b py-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-accent text-xl font-semibold text-primary shadow-sm">
          {agent.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" />
          ) : (
            initials(agent.name)
          )}
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="rounded-full">个人 AI 分身</Badge>
            <Badge variant="outline" className="rounded-full">AI 数字分身</Badge>
          </div>
        </div>
        {agent.description ? (
          <p className="max-w-xl text-sm text-muted-foreground">{agent.description}</p>
        ) : null}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          我是这位候选人的 AI 助手，并非候选人本人。
        </p>
      </header>

      <ChatPanel
        introTitle="你好，我是这位候选人的 AI 助手。"
        introLines={[
          "他的项目经历",
          "他的技术能力与技术栈",
          "他在项目中承担的职责",
        ]}
        suggestedQuestions={agent.suggested_questions}
        disclaimer="回答基于这位候选人上传的知识库生成；对话只保存在当前浏览器会话中。"
        emptyHint="在下方输入你的问题，或从上面的推荐问题开始。"
        onSend={(message, currentConversationId) =>
          api.publicChat(slug, { message, conversation_id: currentConversationId })
        }
        onLoadConversation={(id) => api.publicConversation(slug, id)}
        initialConversationId={conversationId}
      />

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        由 个人 AI 分身平台 驱动 ·{" "}
        <Link href="/" className="underline hover:text-foreground">
          创建你自己的分身
        </Link>
      </footer>
    </div>
  );
}
