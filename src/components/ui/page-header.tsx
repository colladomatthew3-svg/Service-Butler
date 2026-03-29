import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-50/80 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Command Center
        </p>
        <h1 className="dashboard-page-title mt-3 text-semantic-text">{title}</h1>
        {subtitle && <p className="dashboard-body mt-2 max-w-2xl text-semantic-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end md:gap-3">{actions}</div>}
    </header>
  );
}
