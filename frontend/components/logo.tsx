import Link from "next/link";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 text-sm font-medium text-foreground", className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
        <Bot className="h-3.5 w-3.5" />
      </span>
      个人 AI 分身
    </Link>
  );
}
