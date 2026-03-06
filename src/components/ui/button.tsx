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
    "bg-semantic-brand text-white shadow-sm hover:bg-semantic-brandHover active:translate-y-px",
  secondary:
    "border border-semantic-border bg-semantic-surface text-semantic-text shadow-sm hover:bg-semantic-surface2",
  ghost: "bg-transparent text-semantic-muted hover:bg-semantic-surface2 hover:text-semantic-text",
  danger: "bg-semantic-danger text-white hover:bg-danger-700 active:translate-y-px"
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base"
};

export function buttonStyles({
  className,
  variant = "primary",
  size = "md",
  fullWidth
}: Pick<ButtonProps, "className" | "variant" | "size" | "fullWidth"> = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-[0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
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
