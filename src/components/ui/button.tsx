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
    "border border-transparent bg-semantic-brand text-white shadow-soft hover:bg-semantic-brandHover active:translate-y-px",
  secondary:
    "border border-semantic-border bg-white text-semantic-text shadow-none hover:bg-semantic-surface2",
  ghost: "border border-transparent bg-transparent text-semantic-muted hover:bg-semantic-surface2 hover:text-semantic-text",
  danger: "border border-transparent bg-semantic-danger text-white shadow-soft hover:brightness-95 active:translate-y-px"
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base"
};

export function buttonStyles({
  className,
  variant = "primary",
  size = "md",
  fullWidth
}: Pick<ButtonProps, "className" | "variant" | "size" | "fullWidth"> = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
    "focus-visible:ring-semantic-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-semantic-surface disabled:border disabled:border-semantic-border disabled:bg-semantic-surface2 disabled:text-semantic-muted disabled:opacity-75 disabled:shadow-none",
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
