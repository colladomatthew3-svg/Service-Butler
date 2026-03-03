import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-semantic-brand text-white hover:bg-semantic-brandHover active:translate-y-px",
  secondary: "bg-semantic-surface text-semantic-text ring-1 ring-inset ring-semantic-border hover:bg-semantic-surface2",
  ghost: "bg-transparent text-semantic-muted hover:bg-semantic-surface2",
  danger: "bg-semantic-danger text-white hover:bg-danger-700 active:translate-y-px"
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base"
};

export function Button({ className, variant = "primary", size = "md", fullWidth, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
        "shadow-sm hover:shadow-md focus-visible:ring-semantic-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-semantic-surface disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-none",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
}
