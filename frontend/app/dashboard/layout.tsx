"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Briefcase, GitBranch, LayoutDashboard, LogOut, Settings, Blocks } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, ApiError, type User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";

const upcoming = [
  { label: "模板 bot", icon: Blocks },
  { label: "调用链", icon: GitBranch },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<User | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [hash, setHash] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  React.useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  async function logout() {
    try {
      await api.logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const overviewActive = pathname === "/dashboard" && hash !== "#agents";
  const twinsActive = pathname.startsWith("/dashboard/agents") || (pathname === "/dashboard" && hash === "#agents");
  const jobsActive = pathname.startsWith("/dashboard/jobs");
  const settingsActive = pathname.startsWith("/dashboard/settings");

  const nav = [
    { href: "/dashboard", label: "总览", icon: LayoutDashboard, active: overviewActive },
    { href: "/dashboard#agents", label: "分身", icon: Bot, active: twinsActive },
    { href: "/dashboard/jobs", label: "实习岗位", icon: Briefcase, active: jobsActive },
  ];

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> 正在进入控制台…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex h-14 items-center px-4">
          <Logo href="/dashboard" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="控制台">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              onClick={(event) => {
                if (item.href === "/dashboard#agents" && pathname === "/dashboard") {
                  event.preventDefault();
                  document.getElementById("agents")?.scrollIntoView({ behavior: "smooth" });
                  window.history.replaceState(null, "", "/dashboard#agents");
                  setHash("#agents");
                }
              }}
              className={cn(
                "relative flex h-9 items-center gap-2 rounded-[8px] px-3 text-sm",
                item.active ? "bg-sidebar-active text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.active ? <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-info" aria-hidden /> : null}
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <Separator className="my-2" />
          {upcoming.map((item) => (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex h-9 items-center justify-between rounded-[8px] px-3 text-sm text-muted-foreground/70"
            >
              <span className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              <span className="text-[11px]">即将上线</span>
            </div>
          ))}
          <Link
            href="/dashboard/settings"
            aria-current={settingsActive ? "page" : undefined}
            className={cn(
              "relative mt-1 flex h-9 items-center gap-2 rounded-[8px] px-3 text-sm",
              settingsActive ? "bg-sidebar-active text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {settingsActive ? <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-info" aria-hidden /> : null}
            <Settings className="h-4 w-4" />
            模型设置
          </Link>
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {initials(user?.username ?? "已登录")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.username ?? "已登录"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo href="/dashboard" />
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto md:hidden" aria-label="控制台">
            {nav.map((item) => (
              <Link key={item.label} href={item.href}>
                <Button variant={item.active ? "secondary" : "ghost"} size="sm" aria-current={item.active ? "page" : undefined}>
                  {item.label}
                </Button>
              </Link>
            ))}
            <Link href="/dashboard/settings">
              <Button variant={settingsActive ? "secondary" : "ghost"} size="sm" aria-current={settingsActive ? "page" : undefined}>
                设置
              </Button>
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
              退出
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
      </div>
    </div>
  );
}
