import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
};

export function Checkbox({
  checked,
  onCheckedChange,
  id,
  disabled,
  label,
  description,
  className,
}: CheckboxProps) {
  const autoId = React.useId();
  const boxId = id ?? autoId;
  return (
    <label
      htmlFor={boxId}
      className={cn(
        "inline-flex items-start gap-2.5 text-sm",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0">
        <input
          id={boxId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-[4px] border border-input bg-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
            checked && "border-info bg-info text-info-foreground",
          )}
        >
          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      </span>
      {label || description ? (
        <span>
          {label ? <span className="font-medium text-foreground">{label}</span> : null}
          {description ? <span className="mt-0.5 block text-muted-foreground">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
