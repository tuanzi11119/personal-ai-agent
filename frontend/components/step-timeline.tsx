"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "running" | "success" | "failed";

export type TimelineStep = {
  id: string;
  title: string;
  subtitle?: string;
  status: StepStatus;
  durationMs?: number;
  tokens?: number;
  prompt?: string;
  output?: string;
};

function formatMs(value: number | undefined): string {
  if (value == null) return "…";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value}ms`;
}

const barClass: Record<StepStatus, string> = {
  pending: "bg-border",
  running: "bg-info",
  success: "bg-foreground/80",
  failed: "bg-destructive",
};

export function StepTimeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const total = steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>waterfall</span>
          <span>总耗时 {formatMs(total)}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn("h-full", barClass[step.status], step.status === "running" && "animate-pulse")}
              style={{ width: `${((step.durationMs ?? 0) / safeTotal) * 100}%` }}
              title={`${step.title} ${formatMs(step.durationMs)}`}
            />
          ))}
        </div>
      </div>
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const expandable = Boolean(step.prompt || step.output);
          const open = openId === step.id;
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < steps.length - 1 ? (
                <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-border" aria-hidden />
              ) : null}
              <StepNode status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] leading-[1.25]">{step.title}</p>
                    {step.subtitle ? <p className="text-xs text-muted-foreground">{step.subtitle}</p> : null}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatMs(step.durationMs)}
                    {step.tokens != null ? ` · ${step.tokens} tok` : ""}
                  </p>
                </div>
                {expandable ? (
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : step.id)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-info hover:underline"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                    {open ? "收起输入 / 输出" : "查看输入 / 输出"}
                  </button>
                ) : null}
                {open && step.prompt ? (
                  <div className="mt-2">
                    <CodeBlock title="prompt" code={step.prompt} />
                  </div>
                ) : null}
                {open && step.output ? (
                  <div className="mt-2">
                    <CodeBlock title="output" code={step.output} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepNode({ status }: { status: StepStatus }) {
  if (status === "success") {
    return (
      <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
        <X className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-info bg-background">
        <span className="h-2 w-2 animate-step-pulse rounded-full bg-info" />
      </span>
    );
  }
  return (
    <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background">
      <span className="h-1.5 w-1.5 rounded-full bg-border" />
    </span>
  );
}
