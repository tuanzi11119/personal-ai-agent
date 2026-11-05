"use client";

import * as React from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import type { ChatResponse, Conversation, Message } from "@/lib/api";
import { ErrorBanner, Spinner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ChatPanelProps = {
  introTitle: string;
  introLines: string[];
  suggestedQuestions?: string[];
  disclaimer?: string;
  emptyHint?: string;
  autoFocus?: boolean;
  onSend: (message: string, conversationId: string | null) => Promise<ChatResponse>;
  onLoadConversation?: (conversationId: string) => Promise<Conversation>;
  initialConversationId?: string | null;
};

type Turn = { key: string; role: string; content: string; sources: ChatResponse["sources"]; mode?: string };

function toTurn(message: Message, mode?: string): Turn {
  return {
    key: message.id,
    role: message.role,
    content: message.content,
    sources: message.sources ?? [],
    mode,
  };
}

export function ChatPanel({
  introTitle,
  introLines,
  suggestedQuestions = [],
  disclaimer,
  emptyHint,
  autoFocus,
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
  const [mode, setMode] = React.useState<string>("");
  const [notice, setNotice] = React.useState<string>("");
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!initialConversationId || !onLoadConversation) return;
    let cancelled = false;
    setLoadingHistory(true);
    onLoadConversation(initialConversationId)
      .then((conversation) => {
        if (cancelled) return;
        setTurns(conversation.messages.map((m) => toTurn(m)));
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

  async function submit(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    setError("");
    setSending(true);
    setInput("");
    setTurns((prev) => [...prev, { key: "local-" + Date.now(), role: "user", content: question, sources: [] }]);
    try {
      const response = await onSend(question, conversationId);
      setConversationId(response.conversation_id);
      setMode(response.mode);
      if (response.notice) setNotice(response.notice);
      setTurns((prev) => [...prev, toTurn(response.message, response.mode)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "出了点问题，请稍后重试。";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
        {turns.length === 0 && !loadingHistory ? (
          <div className="mx-auto max-w-2xl space-y-4 rounded-xl border bg-gradient-to-br from-accent/60 to-transparent p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              {introTitle}
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {introLines.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            {suggestedQuestions.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void submit(question)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
            {emptyHint ? <p className="text-xs text-muted-foreground">{emptyHint}</p> : null}
          </div>
        ) : null}

        {loadingHistory ? (
          <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
            <Spinner /> 正在加载对话…
          </div>
        ) : null}

        <div className="mx-auto max-w-2xl space-y-4">
          {turns.map((turn) => (
            <div key={turn.key} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-card-foreground",
                )}
              >
                <div className="whitespace-pre-wrap break-words">{turn.content}</div>
                {turn.sources.length > 0 ? (
                  <details className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      知识来源（{turn.sources.length}）
                    </summary>
                    <ul className="mt-1.5 space-y-1">
                      {turn.sources.map((source) => (
                        <li key={`${source.document_id}-${source.chunk_index}`}>
                          <span className="font-medium">{source.filename}</span>
                          <span className="ml-1 opacity-70">#{source.chunk_index}</span>
                          {source.excerpt ? <div className="mt-0.5 opacity-80">{source.excerpt}</div> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </div>
          ))}
          {sending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> 正在思考…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background/80 px-1 pt-3">
        {error ? <div className="mx-auto mb-2 max-w-2xl"><ErrorBanner message={error} onDismiss={() => setError("")} /></div> : null}
        {notice ? (
          <p className="mx-auto mb-2 max-w-2xl text-xs text-amber-600">{notice}</p>
        ) : null}
        <form
          className="mx-auto flex max-w-2xl items-end gap-2 pb-3"
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
        <div className="mx-auto max-w-2xl pb-3 text-center text-[11px] text-muted-foreground">
          {disclaimer ?? "回答基于所有者上传的知识库生成。"}
          {mode === "mock" ? " · 当前为 Mock 模式（未接入真实模型）。" : null}
        </div>
      </div>
    </div>
  );
}
