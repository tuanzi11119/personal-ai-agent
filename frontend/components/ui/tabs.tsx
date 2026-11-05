import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  value: string;
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type TabsProps = {
  value: string;
  items: TabItem[];
  onChange?: (value: string) => void;
  stretch?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Tabs({ value, items, onChange, stretch, className, "aria-label": ariaLabel }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-[8px] border bg-muted p-0.5",
        stretch && "flex w-full",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const classes = cn(
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          stretch && "flex-1",
          active
            ? "bg-background font-medium text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]"
            : "text-muted-foreground hover:text-foreground",
        );
        const icon = item.icon ? <item.icon className="h-4 w-4" /> : null;
        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={classes}
            >
              {icon}
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={classes}
            onClick={() => onChange?.(item.value)}
          >
            {icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
