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
    "bg-[linear-gradient(130deg,rgb(var(--sb-primary)),rgb(var(--sb-primary-hover)))] text-white shadow-[0_12px_28px_rgba(24,89,62,0.3)] hover:brightness-105 hover:shadow-[0_16px_32px_rgba(24,89,62,0.28)] active:translate-y-px",
  secondary:
    "border border-semantic-border/80 bg-white/75 text-semantic-text shadow-[0_8px_24px_rgba(31,43,37,0.08)] hover:bg-semantic-surface2",
  ghost: "bg-transparent text-semantic-muted hover:bg-white/65 hover:text-semantic-text",
  danger: "bg-[linear-gradient(130deg,rgb(var(--danger)),rgb(158,43,43))] text-white hover:brightness-105 active:translate-y-px"
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-7 text-base"
};

export function buttonStyles({
  className,
  variant = "primary",
  size = "md",
  fullWidth
}: Pick<ButtonProps, "className" | "variant" | "size" | "fullWidth"> = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[1rem] text-sm font-semibold tracking-[0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
    "focus-visible:ring-semantic-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-semantic-surface disabled:border disabled:border-semantic-border disabled:bg-semantic-surface2 disabled:text-semantic-muted disabled:opacity-75 disabled:shadow-none",
    variantClass[variant],
    sizeClass[size],
    fullWidth && "w-full",
    className
  );
}

export function Button({ className, variant = "primary", size = "md", fullWidth, ...props }: ButtonProps) {
  return (
    <button
      className={buttonStyles({ className, variant, size, fullWidth })}
      {...props}
    />
  );
}
