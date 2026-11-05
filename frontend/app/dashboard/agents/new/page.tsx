"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentForm } from "@/components/agent-form";
import { Button } from "@/components/ui/button";

export default function NewAgentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            返回 Agent 列表
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">创建新的 Agent</h1>
        <p className="text-sm text-muted-foreground">
          先给分身一个身份和人设，创建完成后就可以上传它的知识库资料。
        </p>
      </div>
      <AgentForm mode="create" />
    </div>
  );
}
