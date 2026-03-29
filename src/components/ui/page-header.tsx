import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">{eyebrow}</p> : null}
        <h1 className={`dashboard-page-title text-semantic-text ${eyebrow ? "mt-2" : ""}`}>{title}</h1>
        {subtitle && <p className="dashboard-body mt-1.5 max-w-2xl text-semantic-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div>}
    </header>
  );
}
