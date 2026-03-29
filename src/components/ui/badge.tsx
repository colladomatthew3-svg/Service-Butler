import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "brand";

const variantClass: Record<BadgeVariant, string> = {
  default: "border border-semantic-border bg-semantic-surface2 text-semantic-muted",
  success: "border border-success-500/20 bg-success-100/90 text-success-700",
  warning: "border border-warning-500/22 bg-warning-100/95 text-warning-700",
  danger: "border border-danger-500/22 bg-danger-100/95 text-danger-700",
  brand: "border border-brand-500/20 bg-brand-100/92 text-brand-700"
};

export function Badge({
  className,
  children,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
        variantClass[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
