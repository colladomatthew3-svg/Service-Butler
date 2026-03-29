import { cn } from "@/lib/utils/cn";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-semantic-border bg-white px-3 text-sm text-semantic-text outline-none transition placeholder:text-semantic-muted focus:border-semantic-brand focus:bg-white focus:ring-2 focus:ring-semantic-brand/12",
        className
      )}
      {...props}
    />
  );
}
