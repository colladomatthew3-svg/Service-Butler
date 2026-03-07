import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type LogoVariant = "full" | "mark" | "wordmark" | "lockup";

const FULL_LOGO_RATIO = 1700 / 340;
const MARK_RATIO = 581 / 492;

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
  const isFullLogo = variant === "full" || variant === "lockup" || variant === "wordmark";
  const width = Math.round(size * (isMark ? MARK_RATIO : FULL_LOGO_RATIO));

  if (isMark) {
    return (
      <Image
        src="/brand/logo-mark.svg"
        alt="Service Butler icon"
        width={width}
        height={size}
        className={cn("h-auto w-auto object-contain", className)}
        priority
      />
    );
  }

  if (isFullLogo) {
    return (
      <Image
        src="/brand/logo.svg"
        alt="Service Butler logo"
        width={width}
        height={size}
        className={cn("h-auto w-auto object-contain", className)}
        priority
      />
    );
  }

  return null;
}
