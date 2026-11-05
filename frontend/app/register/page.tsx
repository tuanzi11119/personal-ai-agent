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

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("密码至少需要 8 位字符。");
      return;
    }
    setLoading(true);
    try {
      await api.register({ username, email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "注册失败，请稍后重试。");
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
            <CardTitle>创建账号</CardTitle>
            <CardDescription>一分钟内开始搭建你的个人 AI 分身。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}
              <div className="space-y-1.5">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="比如：张三"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
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
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位字符"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner /> : null}
                {loading ? "正在创建…" : "注册"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              已有账号？{" "}
              <Link href="/login" className="font-medium text-info hover:underline">
                直接登录
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
