"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ChatThread, type ChatThreadMessage } from "@/components/chat-thread";

const USER = "他做过哪些项目？";
const ASSISTANT =
  "根据知识库，他在 2023 年用 Python 与 FastAPI 搭建了一个简历解析服务，负责接口设计与检索链路。来源见下方引用。";

export function HomeDemo() {
  const [userText, setUserText] = React.useState("");
  const [botText, setBotText] = React.useState("");
  const [phase, setPhase] = React.useState<"user" | "bot" | "hold">("user");
  const reduced = React.useRef(false);

  React.useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setUserText(USER);
      setBotText(ASSISTANT);
      setPhase("hold");
    }
  }, []);

  React.useEffect(() => {
    if (reduced.current) return;
    let timer = 0;
    if (phase === "user") {
      if (userText.length < USER.length) {
        timer = window.setTimeout(() => setUserText(USER.slice(0, userText.length + 1)), 48);
      } else {
        timer = window.setTimeout(() => setPhase("bot"), 360);
      }
    } else if (phase === "bot") {
      if (botText.length < ASSISTANT.length) {
        timer = window.setTimeout(() => setBotText(ASSISTANT.slice(0, botText.length + 1)), 22);
      } else {
        timer = window.setTimeout(() => setPhase("hold"), 1800);
      }
    } else {
      timer = window.setTimeout(() => {
        setUserText("");
        setBotText("");
        setPhase("user");
      }, 1600);
    }
    return () => window.clearTimeout(timer);
  }, [phase, userText, botText]);

  const messages: ChatThreadMessage[] = [];
  if (userText) messages.push({ id: "user", role: "user", content: userText });
  if (phase !== "user" || botText) {
    messages.push({
      id: "bot",
      role: "assistant",
      content: botText,
      citations:
        phase === "hold"
          ? [
              { key: "resume", label: "简历.pdf #3", excerpt: "2023 年使用 Python 与 FastAPI 搭建简历解析服务。" },
              { key: "note", label: "项目笔记.md #1", excerpt: "负责接口设计与检索链路。" },
            ]
          : undefined,
    });
  }

  return (
    <div className="rounded-[12px] border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-[13px] font-medium">公开分身对话</p>
        <Badge variant="outline">示例</Badge>
      </div>
      <div className="min-h-[280px] px-4 py-4">
        <ChatThread
          messages={messages}
          botName="AI 分身"
          streaming={phase === "bot"}
          onStop={() => {
            setPhase("hold");
          }}
        />
      </div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">示例动画，不会请求模型。</p>
    </div>
  );
}
