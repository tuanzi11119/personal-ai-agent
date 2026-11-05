"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Briefcase, LayoutDashboard, LogOut, Settings, User as UserIcon } from "lucide-react";
import { api, ApiError, type User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<User | null>(null);
  const [checking, setChecking] = React.useState(true);

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

  async function logout() {
    try {
      await api.logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const navItems = [
    { href: "/dashboard", label: "我的 Agent", icon: LayoutDashboard },
    { href: "/dashboard/jobs", label: "实习岗位", icon: Briefcase },
    { href: "/dashboard/settings", label: "模型设置", icon: Settings },
  ];

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> 正在进入控制台…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </span>
              <span className="hidden sm:inline">个人 AI 分身</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} aria-label={item.label} title={item.label}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <UserIcon className="h-4 w-4" />
              {user?.username ?? "已登录"}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
      <footer className="border-t py-4">
        <div className="container text-xs text-muted-foreground">
          个人 AI 分身平台 · MVP · 所有回答都基于你上传的文档
        </div>
      </footer>
    </div>
  );
}
