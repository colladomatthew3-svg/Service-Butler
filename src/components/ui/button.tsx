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
  primary:
    "bg-semantic-brand text-white shadow-[0_14px_28px_rgba(136,188,66,0.28)] hover:bg-semantic-brandHover hover:shadow-[0_18px_34px_rgba(111,153,53,0.32)] active:translate-y-px",
  secondary:
    "bg-semantic-surface text-semantic-text ring-1 ring-inset ring-semantic-border hover:bg-semantic-surface2 hover:ring-semantic-brand/20",
  ghost: "bg-transparent text-semantic-muted hover:bg-semantic-surface2 hover:text-semantic-text",
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
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-[0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
        "focus-visible:ring-semantic-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-semantic-surface disabled:border disabled:border-semantic-border disabled:bg-semantic-surface2 disabled:text-semantic-muted disabled:opacity-75 disabled:shadow-none",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
}
