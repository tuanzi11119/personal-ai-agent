"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, MapPin, Pin, Search } from "lucide-react";
import { api, ApiError, type Job, type JobZone } from "@/lib/api";
import { EmptyState } from "@/components/empty-state";
import { Badge, Card, CardContent, ErrorBanner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { cn, formatShortDate } from "@/lib/utils";

const ZONES: { key: "all" | JobZone; label: string; href: string }[] = [
  { key: "all", label: "全部", href: "/dashboard/jobs" },
  { key: "cs", label: "计算机岗", href: "/dashboard/jobs/cs" },
  { key: "teaching", label: "教师岗", href: "/dashboard/jobs/teaching" },
];

const ZONE_LABEL: Record<string, string> = {
  cs: "计算机岗",
  teaching: "教师岗",
};

type SortKey = "default" | "deadline" | "updated";

function isPastDeadline(value: string | null): boolean {
  if (!value) return false;
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value < stamp;
}

function ZoneBadge({ zone }: { zone: string }) {
  if (zone === "cs") return <Badge variant="cs">计算机岗</Badge>;
  if (zone === "teaching") return <Badge variant="teaching">教师岗</Badge>;
  return <Badge variant="secondary">{ZONE_LABEL[zone] ?? zone}</Badge>;
}

export function JobListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-[12px]" />
      ))}
    </div>
  );
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
  const [sort, setSort] = React.useState<SortKey>("default");
  const [hideExpired, setHideExpired] = React.useState(false);

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

  const visible = React.useMemo(() => {
    const next = jobs.filter((job) => (hideExpired ? !isPastDeadline(job.deadline) : true));
    if (sort === "deadline") {
      next.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    } else if (sort === "updated") {
      next.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return next;
  }, [jobs, hideExpired, sort]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">实习岗位</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          面向东北师范大学同学。计算机岗与教师岗可以分开看，东师相关岗位会排在前面。当前是示例数据，就业网和公开招聘站还没有接入。
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          aria-label="岗位分区"
          value={zone}
          items={ZONES.map((item) => ({ value: item.key, label: item.label, href: zoneHref(item.href) }))}
        />
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
          <Button type="submit" variant="secondary" size="icon" aria-label="搜索">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Checkbox
          checked={nenuOnly}
          onCheckedChange={(checked) => pushParams({ nenu: checked ? "1" : null })}
          label="只看东师相关"
        />
        <Checkbox checked={hideExpired} onCheckedChange={setHideExpired} label="隐藏已截止" />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">排序</span>
          <Select
            aria-label="排序"
            className="w-36"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="default">综合排序</option>
            <option value="deadline">截止日期</option>
            <option value="updated">最近更新</option>
          </Select>
        </label>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      {loading ? (
        <JobListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="没有符合条件的岗位"
          description="换个分区或清掉筛选条件后再看一次。"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setHideExpired(false);
                setSort("default");
                pushParams({ q: null, nenu: null });
              }}
            >
              清除筛选
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">共 {total} 条</p>
          <ul className="grid gap-3">
            {visible.map((job) => (
              <li key={job.id}>
                <Link href={`/dashboard/jobs/${job.id}`} className="block">
                  <Card className={cn("transition-colors hover:border-foreground/20", job.is_nenu_related && "border-info/40")}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {job.is_nenu_related ? <Pin className="h-3.5 w-3.5 text-info" aria-hidden /> : null}
                            <h2 className="text-base font-medium leading-[1.25]">{job.title}</h2>
                          </div>
                          <p className="text-sm text-muted-foreground">{job.company}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <ZoneBadge zone={job.zone} />
                          {job.is_nenu_related ? <Badge variant="info">东师相关</Badge> : null}
                          {job.source === "seed" ? <Badge variant="outline">示例数据</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {job.location || "地点未注明"}
                        </span>
                        <span className={isPastDeadline(job.deadline) ? "text-destructive" : undefined}>
                          {job.deadline ? formatShortDate(job.deadline) : formatShortDate(job.created_at)}
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
