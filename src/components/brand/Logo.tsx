import { Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type LogoVariant = "full" | "mark" | "wordmark" | "lockup";

export function Logo({
  variant = "full",
  size = 40,
  className
}: {
  variant?: LogoVariant;
  size?: number;
  className?: string;
}) {
  const iconSize = Math.max(18, Math.round(size * 0.42));

  if (variant === "mark") {
    return (
      <span
        aria-label="Service Butler icon"
        className={cn("inline-flex items-center justify-center rounded-lg bg-brand-700 text-white", className)}
        style={{ width: size, height: size }}
      >
        <Target style={{ width: iconSize, height: iconSize }} strokeWidth={2.1} />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={cn("inline-flex items-center font-heading font-bold tracking-tight text-semantic-text", className)}
        style={{ fontSize: Math.max(18, Math.round(size * 0.48)) }}
      >
        Service Butler
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-lg bg-brand-700 text-white"
        style={{ width: size, height: size }}
      >
        <Target style={{ width: iconSize, height: iconSize }} strokeWidth={2.1} />
      </span>
      <span
        className="font-heading font-bold tracking-tight text-semantic-text"
        style={{ fontSize: Math.max(18, Math.round(size * 0.48)) }}
      >
        Service Butler
      </span>
    </span>
  );
}
