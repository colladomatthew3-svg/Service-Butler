"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buttonStyles = buttonStyles;
exports.Button = Button;
const cn_1 = require("@/lib/utils/cn");
const variantClass = {
    primary: "bg-[linear-gradient(130deg,rgb(var(--sb-primary)),rgb(var(--sb-primary-hover)))] text-white shadow-[0_12px_28px_rgba(24,89,62,0.3)] hover:brightness-105 hover:shadow-[0_16px_32px_rgba(24,89,62,0.28)] active:translate-y-px",
    secondary: "border border-semantic-border/80 bg-white/75 text-semantic-text shadow-[0_8px_24px_rgba(31,43,37,0.08)] hover:bg-semantic-surface2",
    ghost: "bg-transparent text-semantic-muted hover:bg-white/65 hover:text-semantic-text",
    danger: "bg-[linear-gradient(130deg,rgb(var(--danger)),rgb(158,43,43))] text-white hover:brightness-105 active:translate-y-px"
};
const sizeClass = {
    sm: "h-11 px-4 text-sm",
    md: "h-12 px-5 text-sm",
    lg: "h-14 px-7 text-base"
};
function buttonStyles({ className, variant = "primary", size = "md", fullWidth } = {}) {
    return (0, cn_1.cn)("inline-flex items-center justify-center gap-2 rounded-[1rem] text-sm font-semibold tracking-[0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed", "focus-visible:ring-semantic-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-semantic-surface disabled:border disabled:border-semantic-border disabled:bg-semantic-surface2 disabled:text-semantic-muted disabled:opacity-75 disabled:shadow-none", variantClass[variant], sizeClass[size], fullWidth && "w-full", className);
}
function Button({ className, variant = "primary", size = "md", fullWidth, ...props }) {
    return (<button className={buttonStyles({ className, variant, size, fullWidth })} {...props}/>);
}
