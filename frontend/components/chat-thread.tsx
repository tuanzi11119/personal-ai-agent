"use client";

import * as React from "react";
import { Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";

export type ChatCitation = {
  key: string;
  label: string;
  excerpt?: string;
};

export type ChatThreadMessage = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  citations?: ChatCitation[];
};

export function ChatThread({
  messages,
  botName,
  botAvatarUrl,
  streaming = false,
  onStop,
  className,
}: {
  messages: ChatThreadMessage[];
  botName: string;
  botAvatarUrl?: string | null;
  streaming?: boolean;
  onStop?: () => void;
  className?: string;
}) {
  const [openCitation, setOpenCitation] = React.useState<string | null>(null);

  return (
    <div className={cn("space-y-5", className)}>
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isLast = index === messages.length - 1;
        const showCaret = streaming && isLast && !isUser;
        if (isUser) {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-[12px] bg-muted px-3 py-2 text-sm leading-[1.7] text-foreground">
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
              </div>
            </div>
          );
        }
        return (
          <div key={message.id} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-[11px] font-medium">
              {botAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(botName)
              )}
            </span>
            <div className="min-w-0 max-w-[85%] flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[13px] font-medium leading-[1.25]">{botName}</span>
                <Badge variant="secondary">bot</Badge>
              </div>
              <div className="rounded-[12px] border bg-card px-3 py-2 text-sm leading-[1.7]">
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                  {showCaret ? (
                    <span className="ml-0.5 inline-block animate-caret-blink text-info" aria-hidden>
                      ▍
                    </span>
                  ) : null}
                </div>
              </div>
              {message.citations && message.citations.length > 0 ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {message.citations.map((citation) => {
                      const active = openCitation === `${message.id}:${citation.key}`;
                      return (
                        <button
                          key={citation.key}
                          type="button"
                          onClick={() =>
                            setOpenCitation(active ? null : `${message.id}:${citation.key}`)
                          }
                          className={cn(
                            "rounded-[6px] border px-2 py-0.5 text-xs leading-[1.7] text-info hover:bg-info-soft",
                            active && "bg-info-soft",
                          )}
                        >
                          {citation.label}
                        </button>
                      );
                    })}
                  </div>
                  {message.citations.map((citation) =>
                    openCitation === `${message.id}:${citation.key}` && citation.excerpt ? (
                      <p key={`${citation.key}-excerpt`} className="rounded-[8px] bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                        {citation.excerpt}
                      </p>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {streaming && onStop ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={onStop}>
            <Square className="h-3 w-3 fill-current" />
            停止生成
          </Button>
        </div>
      ) : null}
    </div>
  );
}
