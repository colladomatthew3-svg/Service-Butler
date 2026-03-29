import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataSourcesControlPanel, IntegrationReadinessPanel } from "@/components/dashboard/data-sources-control-panel";
import { WeatherSettingsForm } from "@/components/dashboard/weather-settings-form";
import { PageHeader } from "@/components/ui/page-header";

const readinessHighlights = [
  {
    label: "Data source truth",
    detail: "Every connector family is surfaced here, including partial and simulated feeds."
  },
  {
    label: "Live-safe integrations",
    detail: "Twilio, HubSpot, Smartlead, Inngest, Stripe, Supabase, and webhook auth are disclosed honestly."
  },
  {
    label: "Service area control",
    detail: "Weather and territory configuration stay visible because they shape routing and urgency."
  }
];

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Controls"
        title="Settings"
        subtitle="Configure the acquisition-ready control plane, live-safe integrations, and service-area intelligence from one operator surface."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">Pilot ready</Badge>
            <Link href="/dashboard/network" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open network overview
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-3">
        {readinessHighlights.map((item) => (
          <Card key={item.label}>
            <CardBody className="px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-semantic-text">{item.detail}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <section id="data-sources" className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Data sources</p>
          <h2 className="mt-1 text-base font-semibold text-semantic-text">Restoration intelligence control plane</h2>
          <p className="mt-1 text-sm text-semantic-muted">
            Operators can add, inspect, test, and run sources here while buyers see the same runtime truth reflected in the network proof view.
          </p>
        </div>
        <DataSourcesControlPanel />
      </section>

      <section id="integrations" className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-brand-500/18 bg-[linear-gradient(120deg,rgba(229,236,251,0.92),rgba(255,255,255,0.98))]">
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Service area</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Weather and routing context</h2>
            <p className="mt-1 text-sm text-semantic-muted">
              Forecast inputs still drive urgency and demand scoring, so the operator setup stays close to the live data-source controls.
            </p>
          </CardHeader>
          <CardBody>
            <WeatherSettingsForm />
          </CardBody>
        </Card>

        <IntegrationReadinessPanel />
      </section>
    </div>
  );
}
