import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-100 text-brand-700"
      : tone === "success"
        ? "bg-success-100/90 text-success-700"
        : tone === "warning"
          ? "bg-warning-100/90 text-warning-700"
          : "bg-semantic-surface2 text-semantic-muted";

  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
          <p className="mt-1.5 font-heading text-[1.55rem] font-semibold tracking-tight text-semantic-text">{value}</p>
        </div>
        {icon && <div className={`rounded-md p-2.5 ${toneClass}`}>{icon}</div>}
      </CardBody>
    </Card>
  );
}
