"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  title,
  className,
}: {
  code: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-[12px] border border-[#262626] bg-[#0A0A0A] text-[#EDEDED]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[#262626] px-3 py-2">
        <span className="font-mono text-xs text-[#A3A3A3]">{title ?? "code"}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 font-mono text-xs text-[#A3A3A3] hover:bg-[#171717] hover:text-[#EDEDED]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
