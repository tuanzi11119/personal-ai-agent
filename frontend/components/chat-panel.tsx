"use client";

import * as React from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import type { ChatResponse, Conversation, Message } from "@/lib/api";
import { ChatThread, type ChatThreadMessage } from "@/components/chat-thread";
import { ErrorBanner, Spinner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatPanelProps = {
  introTitle: string;
  introLines: string[];
  suggestedQuestions?: string[];
  disclaimer?: string;
  emptyHint?: string;
  autoFocus?: boolean;
  botName?: string;
  botAvatarUrl?: string | null;
  onSend: (message: string, conversationId: string | null, signal?: AbortSignal) => Promise<ChatResponse>;
  onLoadConversation?: (conversationId: string) => Promise<Conversation>;
  initialConversationId?: string | null;
};

type Turn = ChatThreadMessage & { mode?: string };

function toTurn(message: Message, mode?: string): Turn {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: (message.sources ?? []).map((source) => ({
      key: `${source.document_id}-${source.chunk_index}`,
      label: `${source.filename} #${source.chunk_index}`,
      excerpt: source.excerpt,
    })),
    mode,
  };
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function ChatPanel({
  introTitle,
  introLines,
  suggestedQuestions = [],
  disclaimer,
  emptyHint,
  autoFocus,
  botName = "AI 分身",
  botAvatarUrl,
  onSend,
  onLoadConversation,
  initialConversationId = null,
}: ChatPanelProps) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(initialConversationId);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [error, setError] = React.useState("");
  const [mode, setMode] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!initialConversationId || !onLoadConversation) return;
    let cancelled = false;
    setLoadingHistory(true);
    onLoadConversation(initialConversationId)
      .then((conversation) => {
        if (cancelled) return;
        setTurns(conversation.messages.map((message) => toTurn(message)));
        setConversationId(conversation.id);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载对话失败。");
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialConversationId, onLoadConversation]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, sending]);

  function stop() {
    abortRef.current?.abort();
  }

  async function submit(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    setError("");
    setSending(true);
    setInput("");
    const pendingId = `pending-${Date.now()}`;
    const controller = new AbortController();
    abortRef.current = controller;
    setTurns((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: question },
      { id: pendingId, role: "assistant", content: "" },
    ]);
    try {
      const response = await onSend(question, conversationId, controller.signal);
      setConversationId(response.conversation_id);
      setMode(response.mode);
      if (response.notice) setNotice(response.notice);
      setTurns((prev) => prev.map((turn) => (turn.id === pendingId ? toTurn(response.message, response.mode) : turn)));
    } catch (err) {
      setTurns((prev) => prev.filter((turn) => turn.id !== pendingId));
      if (!isAbort(err)) {
        setError(err instanceof Error ? err.message : "出了点问题，请稍后重试。");
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 && !loadingHistory ? (
          <div className="mx-auto mb-5 max-w-2xl rounded-[12px] border bg-muted/40 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-info" />
              {introTitle}
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {introLines.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            {emptyHint ? <p className="mt-3 text-xs text-muted-foreground">{emptyHint}</p> : null}
          </div>
        ) : null}

        {loadingHistory ? (
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Spinner /> 正在加载对话…
          </div>
        ) : null}

        <div className="mx-auto max-w-2xl">
          <ChatThread
            messages={turns}
            botName={botName}
            botAvatarUrl={botAvatarUrl}
            streaming={sending}
            onStop={stop}
          />
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background px-4 pt-3">
        {error ? (
          <div className="mx-auto mb-2 max-w-2xl">
            <ErrorBanner message={error} onDismiss={() => setError("")} />
          </div>
        ) : null}
        {notice ? <p className="mx-auto mb-2 max-w-2xl text-xs text-warning">{notice}</p> : null}
        {suggestedQuestions.length > 0 ? (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-1.5">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void submit(question)}
                disabled={sending}
                className="rounded-[6px] border bg-background px-2.5 py-1 text-xs leading-[1.7] text-foreground hover:bg-muted disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}
        <form
          className="mx-auto flex max-w-2xl items-end gap-2 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(input);
          }}
        >
          <Textarea
            value={input}
            autoFocus={autoFocus}
            rows={2}
            maxLength={4000}
            placeholder="输入你的问题，例如：他做过哪些项目？"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(input);
              }
            }}
            className="min-h-[52px] resize-none"
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="发送消息">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>
        <div className="mx-auto max-w-2xl pb-3 text-center text-xs text-muted-foreground">
          {disclaimer ?? "回答基于所有者上传的知识库生成。"}
          {mode === "mock" ? " · 当前为 Mock 模式（未接入真实模型）。" : null}
        </div>
      </div>
    </div>
  );
}
