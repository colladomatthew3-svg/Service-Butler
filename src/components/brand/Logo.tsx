import Image from "next/image";
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
  const isMark = variant === "mark";

  if (isMark) {
    return (
      <Image
        src="/brand/logo-mark.svg"
        alt="Service Butler logo mark"
        width={size}
        height={size}
        className={cn("h-auto w-auto object-contain", className)}
        priority
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src="/brand/logo-mark.svg"
        alt="Service Butler logo mark"
        width={size}
        height={size}
        className="h-auto w-auto shrink-0 object-contain"
        priority
      />
      <span className="flex flex-col leading-none">
        <span
          className="font-heading font-bold tracking-[-0.045em] text-semantic-text"
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          Service Butler
        </span>
        <span
          className="mt-1 font-sans font-semibold uppercase tracking-[0.22em] text-semantic-muted"
          style={{ fontSize: Math.max(10, Math.round(size * 0.18)) }}
        >
          AI Ops for Home Services
        </span>
      </span>
    </span>
  );
}
