import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border bg-muted text-muted-foreground">
        <FileQuestion className="h-5 w-5" />
      </span>
      <h1 className="text-xl font-semibold">页面不存在</h1>
      <p className="max-w-md text-sm text-muted-foreground">你访问的页面可能已被删除，或者链接输入有误。</p>
      <Link href="/">
        <Button variant="secondary">返回首页</Button>
      </Link>
    </div>
  );
}
