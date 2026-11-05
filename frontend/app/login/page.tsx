"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorBanner, Spinner } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login({ email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[400px] space-y-6">
        <Logo href="/" className="justify-center" />
        <Card>
          <CardHeader>
            <CardTitle>欢迎回来</CardTitle>
            <CardDescription>登录后即可管理你的 Agent 与知识库。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner /> : null}
                {loading ? "正在登录…" : "登录"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link href="/register" className="font-medium text-info hover:underline">
                立即注册
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
