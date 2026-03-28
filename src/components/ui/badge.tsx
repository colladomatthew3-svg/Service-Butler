import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "brand";

const variantClass: Record<BadgeVariant, string> = {
  default: "bg-white/70 text-semantic-muted ring-1 ring-inset ring-semantic-border/75",
  success: "bg-success-100/90 text-success-700 ring-1 ring-inset ring-success-500/20",
  warning: "bg-warning-100/95 text-warning-700 ring-1 ring-inset ring-warning-500/25",
  danger: "bg-danger-100/95 text-danger-700 ring-1 ring-inset ring-danger-500/25",
  brand: "bg-brand-100/95 text-brand-700 ring-1 ring-inset ring-brand-500/30"
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
        "inline-flex items-center rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] whitespace-nowrap",
        variantClass[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
