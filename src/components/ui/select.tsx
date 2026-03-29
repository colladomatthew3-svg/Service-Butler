import { cn } from "@/lib/utils/cn";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-[1.1rem] border border-semantic-border/70 bg-white/86 px-4 text-sm text-semantic-text shadow-[0_12px_28px_rgba(17,26,23,0.08)] outline-none transition focus:border-semantic-brand focus:bg-white focus:ring-4 focus:ring-semantic-brand/15",
        className
      )}
      {...props}
    />
  );
}
