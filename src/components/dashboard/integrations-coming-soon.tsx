"use client";

import { IntegrationReadinessPanel, buildIntegrationReadinessSummaries } from "@/components/dashboard/control-plane";

export function IntegrationsComingSoon() {
  return (
    <IntegrationReadinessPanel
      items={buildIntegrationReadinessSummaries()}
      ctaHref="/dashboard/settings#integrations"
    />
  );
}
