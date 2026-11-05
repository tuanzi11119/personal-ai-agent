"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Copy, ExternalLink, FileText, MessagesSquare, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { api, ApiError, type Agent } from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge, Card, CardContent, CardFooter, CardHeader, CardTitle, ErrorBanner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate, initials } from "@/lib/utils";

export default function DashboardPage() {
  const { toast } = useToast();
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [jobTotal, setJobTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<Agent | null>(null);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const data = await api.listAgents();
      setAgents(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载 Agent 列表失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    api
      .listJobs()
      .then((data) => setJobTotal(data.total))
      .catch(() => setJobTotal(null));
  }, [load]);

  async function remove() {
    if (!pendingDelete) return;
    try {
      await api.deleteAgent(pendingDelete.id);
      setAgents((prev) => prev.filter((item) => item.id !== pendingDelete.id));
      toast({ title: "已删除分身", tone: "success" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除 Agent 失败。");
    } finally {
      setPendingDelete(null);
    }
  }

  async function share(agent: Agent) {
    if (!agent.is_public) {
      setError("这个 Agent 目前是私有的。请先在 Agent 设置里开启公开访问，再分享链接。");
      return;
    }
    const url = `${window.location.origin}${agent.public_path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "链接已复制", description: agent.public_path, tone: "success" });
    } catch {
      setError(`请手动复制这个链接：${url}`);
    }
  }

  const publicCount = agents.filter((agent) => agent.is_public).length;
  const documentCount = agents.reduce((sum, agent) => sum + agent.document_count, 0);
  const stats = [
    { label: "分身", value: loading ? "—" : String(agents.length), hint: "工作区里的数字分身" },
    { label: "公开", value: loading ? "—" : String(publicCount), hint: "可分享给面试官" },
    { label: "文档", value: loading ? "—" : String(documentCount), hint: "已纳入知识库" },
    { label: "岗位", value: jobTotal == null ? "—" : String(jobTotal), hint: "实习岗位条目" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">总览</h1>
          <p className="text-sm text-muted-foreground">分身、知识库和实习岗位都从这里进入。</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button>
            <Plus className="h-4 w-4" />
            创建分身
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-normal text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold leading-[1.25]">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <section id="agents" className="scroll-mt-20 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">分身</h2>
          <span className="text-xs text-muted-foreground">{loading ? "加载中…" : `${agents.length} 个`}</span>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-[12px]" />
            ))}
          </div>
        ) : null}

        {!loading && agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="还没有任何分身"
            description="创建你的第一个个人 AI 分身，上传简历，然后把链接分享出去。"
            action={
              <Link href="/dashboard/agents/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  创建第一个分身
                </Button>
              </Link>
            }
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id} className="flex flex-col">
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-medium">
                  {agent.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={agent.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(agent.name)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate">{agent.name}</CardTitle>
                  <p className="truncate font-mono text-xs text-muted-foreground">/a/{agent.slug}</p>
                </div>
                <Badge variant={agent.is_public ? "success" : "secondary"}>{agent.is_public ? "公开" : "私有"}</Badge>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <p className="line-clamp-2 min-h-[3rem] text-sm text-muted-foreground">
                  {agent.description || "还没有填写简介。"}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {agent.document_count} 份文档
                  </span>
                  <span>更新于 {formatDate(agent.updated_at)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-wrap gap-2 border-t pt-4">
                <Link href={`/dashboard/agents/${agent.id}`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                </Link>
                <Link href={`/dashboard/agents/${agent.id}?tab=playground`}>
                  <Button variant="secondary" size="sm">
                    <MessagesSquare className="h-3.5 w-3.5" />
                    对话
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => void share(agent)}>
                  {agent.is_public ? <Share2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  分享
                </Button>
                {agent.is_public ? (
                  <a href={agent.public_path} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" />
                      打开
                    </Button>
                  </a>
                ) : null}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setPendingDelete(agent)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={pendingDelete != null}
        title={pendingDelete ? `删除「${pendingDelete.name}」？` : "删除分身"}
        description="它的文档与聊天记录会一并删除。"
        confirmLabel="删除"
        destructive
        onConfirm={() => void remove()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </div>
  );
}
