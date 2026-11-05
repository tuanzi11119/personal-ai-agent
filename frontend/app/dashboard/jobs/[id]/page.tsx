"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { api, ApiError, type Job } from "@/lib/api";
import { Badge, Card, CardContent, CardHeader, CardTitle, ErrorBanner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  seed: "内置示例",
  nenu_career: "东师就业网",
  public_board: "公开招聘站",
};

const ILLUSTRATED_LABEL: Record<string, string> = {
  nenu_career: "东师就业网（抓取未接入）",
  public_board: "公开招聘站（抓取未接入）",
};

function ZoneBadge({ zone }: { zone: string }) {
  if (zone === "cs") return <Badge variant="cs">计算机岗</Badge>;
  if (zone === "teaching") return <Badge variant="teaching">教师岗</Badge>;
  return <Badge variant="secondary">{zone}</Badge>;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    api
      .getJob(jobId)
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "加载岗位失败。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const backHref = job?.zone === "teaching" ? "/dashboard/jobs/teaching" : job?.zone === "cs" ? "/dashboard/jobs/cs" : "/dashboard/jobs";
  const illustrated = typeof job?.raw?.illustrated_source === "string" ? job.raw.illustrated_source : "";
  const externalUrl = job?.source_url?.startsWith("http") ? job.source_url : "";

  return (
    <div className="space-y-6">
      <Link href={backHref}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>
      </Link>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : job ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <ZoneBadge zone={job.zone} />
                {job.is_nenu_related ? <Badge variant="info">东师相关</Badge> : null}
                {job.source === "seed" ? <Badge variant="outline">示例数据</Badge> : null}
              </div>
              <h1 className="text-xl font-semibold">{job.title}</h1>
              <p className="text-muted-foreground">{job.company}</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>岗位说明</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-[1.7]">{job.description}</p>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle>岗位信息</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">地点</dt>
                    <dd className="mt-0.5 inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {job.location || "未注明"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">截止日期</dt>
                    <dd className="mt-0.5">{job.deadline ? formatShortDate(job.deadline) : "未公布"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">数据来源</dt>
                    <dd className="mt-0.5">{SOURCE_LABEL[job.source] ?? job.source}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">计划接入</dt>
                    <dd className="mt-0.5">{ILLUSTRATED_LABEL[illustrated] ?? "尚未指定"}</dd>
                  </div>
                </dl>
                {externalUrl ? (
                  <a
                    href={externalUrl}
                    className="mt-4 inline-block text-sm text-info hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开原文
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
