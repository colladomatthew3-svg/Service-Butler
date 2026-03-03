import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type LogoVariant = "mark" | "wordmark" | "lockup";

export function Logo({
  variant = "lockup",
  size = 40,
  className
}: {
  variant?: LogoVariant;
  size?: number;
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/logo-mark.svg"
        alt="ServiceButler logo mark"
        width={size}
        height={size}
        className={cn("h-auto w-auto", className)}
      />
    );
  }

  if (variant === "wordmark") {
    const width = Math.round(size * 4.1);
    return (
      <Image
        src="/brand/logo.svg"
        alt="ServiceButler"
        width={width}
        height={size}
        className={cn("h-auto w-auto", className)}
      />
    );
  }

  const width = Math.round(size * 4.1);
  return (
    <Image
      src="/brand/logo.svg"
      alt="ServiceButler"
      width={width}
      height={size}
      className={cn("h-auto w-auto", className)}
    />
  );
}
