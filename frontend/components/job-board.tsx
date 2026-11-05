"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Pin, Search } from "lucide-react";
import { api, ApiError, type Job, type JobZone } from "@/lib/api";
import { Badge, Card, CardContent, ErrorBanner, Spinner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ZONES: { key: "all" | JobZone; label: string; href: string }[] = [
  { key: "all", label: "全部", href: "/dashboard/jobs" },
  { key: "cs", label: "计算机岗", href: "/dashboard/jobs/cs" },
  { key: "teaching", label: "教师岗", href: "/dashboard/jobs/teaching" },
];

const ZONE_LABEL: Record<string, string> = {
  cs: "计算机岗",
  teaching: "教师岗",
};

function formatDeadline(value: string | null): string {
  if (!value) return "截止日期未公布";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function isPastDeadline(value: string | null): boolean {
  if (!value) return false;
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value < stamp;
}

export function JobBoard({ zone }: { zone: "all" | JobZone }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const nenuOnly = searchParams.get("nenu") === "1";
  const [draft, setDraft] = React.useState(q);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setDraft(q);
  }, [q]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .listJobs({
        zone: zone === "all" ? undefined : zone,
        q: q || undefined,
        nenu: nenuOnly || undefined,
      })
      .then((data) => {
        if (cancelled) return;
        setJobs(data.items);
        setTotal(data.total);
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
  }, [zone, q, nenuOnly]);

  function pushParams(next: { q?: string | null; nenu?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if ("q" in next) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if ("nenu" in next) {
      if (next.nenu) params.set("nenu", next.nenu);
      else params.delete("nenu");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function zoneHref(href: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nenuOnly) params.set("nenu", "1");
    const qs = params.toString();
    return qs ? `${href}?${qs}` : href;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">实习岗位</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          面向东北师范大学同学。计算机岗与教师岗可以分开看，东师相关岗位会排在前面。当前是示例数据，就业网和公开招聘站还没有接入。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {ZONES.map((item) => {
            const active = item.key === zone;
            return (
              <Link key={item.key} href={zoneHref(item.href)}>
                <Button variant={active ? "secondary" : "outline"} size="sm" aria-current={active ? "page" : undefined}>
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>
        <form
          className="flex w-full gap-2 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            pushParams({ q: draft.trim() || null });
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="搜索职位、单位或地点"
            aria-label="搜索岗位"
          />
          <Button type="submit" variant="outline" aria-label="搜索">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={nenuOnly}
          onChange={(event) => pushParams({ nenu: event.target.checked ? "1" : null })}
        />
        只看东师相关
      </label>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> 正在加载岗位…
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">没有符合条件的岗位。</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">共 {total} 条</p>
          <ul className="grid gap-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link href={`/dashboard/jobs/${job.id}`} className="block">
                  <Card className={cn("transition-colors hover:border-primary/40", job.is_nenu_related && "border-primary/30")}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {job.is_nenu_related ? <Pin className="h-4 w-4 text-primary" aria-hidden /> : null}
                            <h2 className="text-base font-semibold">{job.title}</h2>
                          </div>
                          <p className="text-sm text-muted-foreground">{job.company}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{ZONE_LABEL[job.zone] ?? job.zone}</Badge>
                          {job.is_nenu_related ? <Badge variant="success">东师相关</Badge> : null}
                          {job.source === "seed" ? <Badge variant="outline">示例数据</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {job.location || "地点未注明"}
                        </span>
                        <span className={isPastDeadline(job.deadline) ? "text-destructive" : undefined}>
                          {formatDeadline(job.deadline)}
                          {isPastDeadline(job.deadline) ? " · 已截止" : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
