import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center py-12 text-center">
        {icon && <div className="mb-4 rounded-full bg-semantic-surface2 p-3 text-semantic-muted">{icon}</div>}
        <h3 className="text-lg font-semibold text-semantic-text">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-semantic-muted">{description}</p>
        {ctaLabel && ctaHref && (
          <Link href={ctaHref} className={buttonStyles({ className: "mt-6" })}>
            {ctaLabel}
          </Link>
        )}
      </CardBody>
    </Card>
  );
}
