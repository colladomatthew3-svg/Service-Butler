import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.6rem] border border-semantic-border/55 bg-[linear-gradient(160deg,rgba(255,255,255,0.78),rgba(247,248,244,0.55))] shadow-[0_26px_70px_rgba(28,41,34,0.1)] backdrop-blur-md sm:rounded-[1.8rem]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-14 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.6),transparent)]",
        "after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:h-24 after:w-24 after:rounded-full after:bg-brand-100/35 after:blur-2xl",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <header className={cn("border-b border-semantic-border/45 px-4 py-4 sm:px-7 sm:py-5", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-5 sm:px-7 sm:py-7", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <footer className={cn("border-t border-semantic-border/45 px-4 py-4 sm:px-7 sm:py-5", className)} {...props} />;
}
