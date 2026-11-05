import * as React from "react";
import { cn } from "@/lib/utils";

const styles = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-muted text-foreground",
  outline: "border-border bg-background text-foreground",
  destructive: "border-transparent bg-destructive-soft text-destructive",
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning",
  info: "border-transparent bg-info-soft text-info",
  cs: "border-transparent bg-zone-cs-soft text-zone-cs",
  teaching: "border-transparent bg-zone-teaching-soft text-zone-teaching",
} as const;

export type BadgeVariant = keyof typeof styles;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-medium leading-[1.7]",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
