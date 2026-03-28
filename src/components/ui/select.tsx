import { cn } from "@/lib/utils/cn";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-[1.05rem] border border-semantic-border/75 bg-white/82 px-4 text-sm text-semantic-text shadow-[0_10px_24px_rgba(30,42,36,0.08)] outline-none transition focus:border-semantic-brand focus:ring-4 focus:ring-semantic-brand/15",
        className
      )}
      {...props}
    />
  );
}
