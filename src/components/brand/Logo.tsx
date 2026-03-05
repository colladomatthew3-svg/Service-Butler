"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
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
  const [broken, setBroken] = useState(false);
  const normalized = variant === "wordmark" || variant === "lockup" ? "full" : variant;
  const isMark = normalized === "mark";

  const source = useMemo(() => (isMark ? "/brand/logo-mark.png" : "/logo-temp.png"), [isMark]);
  const safeHeight = Math.min(size, 48);
  const width = isMark ? safeHeight : Math.round(safeHeight * 4.2);

  if (broken) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg bg-semantic-surface2 px-3 py-1.5 text-sm font-semibold text-semantic-text",
          className
        )}
      >
        ServiceButler
      </span>
    );
  }

  return (
      <Image
        src={source}
        alt={isMark ? "Service Butler logo mark" : "Service Butler logo"}
        width={width}
        height={safeHeight}
        className={cn("h-auto w-auto max-h-12 max-w-none object-contain p-1", className)}
        onError={() => setBroken(true)}
        priority={!isMark}
      />
  );
}
