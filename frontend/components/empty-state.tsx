import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[12px] border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-medium leading-[1.25]">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
