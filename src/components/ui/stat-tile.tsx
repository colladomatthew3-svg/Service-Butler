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
      ? "bg-brand-50 text-brand-700"
      : tone === "success"
        ? "bg-success-100 text-success-700"
        : tone === "warning"
          ? "bg-warning-100 text-warning-700"
          : "bg-neutral-100 text-neutral-700";

  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-600">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{value}</p>
        </div>
        {icon && <div className={`rounded-xl p-3 ${toneClass}`}>{icon}</div>}
      </CardBody>
    </Card>
  );
}
