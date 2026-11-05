import Link from "next/link";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-semibold">页面不存在</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        你访问的页面可能已被删除，或者链接输入有误。
      </p>
      <Link href="/">
        <Button variant="outline">返回首页</Button>
      </Link>
    </div>
  );
}
