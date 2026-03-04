import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "brand";

const variantClass: Record<BadgeVariant, string> = {
  default: "bg-semantic-surface2 text-semantic-muted ring-1 ring-inset ring-semantic-border/90",
  success: "bg-success-100 text-success-700 ring-1 ring-inset ring-success-500/20",
  warning: "bg-warning-100 text-warning-700 ring-1 ring-inset ring-warning-500/20",
  danger: "bg-danger-100 text-danger-700 ring-1 ring-inset ring-danger-500/20",
  brand: "bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-500/25"
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase whitespace-nowrap",
        variantClass[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
