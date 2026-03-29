import Link from "next/link";
import {
  Building2,
  Globe,
  HardHat,
  Radio,
  Server,
  ShieldCheck,
  TriangleAlert,
  Waves
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableHead, TD, TH } from "@/components/ui/table";

export type DataSourceRuntimeMode = "fully-live" | "live-partial" | "simulated";

export type DataSourceSummary = {
  id: string;
  name: string;
  sourceType: string;
  family: string;
  status: string;
  termsStatus: string;
  complianceStatus: string;
  runtimeMode: DataSourceRuntimeMode;
  freshness: number;
  reliability: number;
  latestRunStatus: string;
  recordsSeen: number;
  recordsCreated: number;
  provenance: string;
  latestRunAt?: string | null;
};

export type DataSourceMutationPayload = {
  name?: string;
  sourceType?: string;
  status?: string;
  termsStatus?: string;
  provenance?: string;
  reliabilityScore?: number;
  config?: Record<string, unknown>;
};

export type ConnectorHealthSummary = {
  ok: boolean;
  detail: string;
  runtimeMode: DataSourceRuntimeMode;
  checkedAt: string;
  latencyMs?: number;
};

export type IntegrationReadinessStatus = "ready" | "safe-mode" | "missing" | "disabled" | "partial";

export type IntegrationReadinessSummary = {
  name: string;
  status: IntegrationReadinessStatus;
  detail: string;
  actionLabel?: string;
  href?: string;
};

const SOURCE_FAMILIES = [
  { key: "weather", label: "Weather", icon: Waves, description: "NOAA, storm, freeze, and precipitation pressure." },
  { key: "permits", label: "Permits", icon: Building2, description: "Roofing, plumbing, HVAC, and repair permits." },
  { key: "social", label: "Social Intent", icon: Radio, description: "Reviews and intent signals from public mentions." },
  { key: "incident", label: "Incidents", icon: TriangleAlert, description: "Fire, emergency, and infrastructure incidents." },
  { key: "usgs", label: "USGS Water", icon: Waves, description: "Gauge and flood-pressure intelligence." },
  { key: "open311", label: "Open311", icon: Server, description: "Municipal service-request demand." },
  { key: "fema", label: "OpenFEMA", icon: ShieldCheck, description: "Catastrophe and disaster context." },
  { key: "census", label: "Census", icon: Globe, description: "Property and market-risk enrichment." },
  { key: "overpass", label: "Overpass", icon: HardHat, description: "Property and commercial asset intelligence." }
] as const;

type SourceRow = Record<string, unknown>;
type RunRow = Record<string, unknown>;

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "No recent run";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No recent run";

  const deltaMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

  const hours = Math.round(deltaMinutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function familyForSourceType(sourceType: string) {
  const normalized = sourceType.toLowerCase();
  const match = SOURCE_FAMILIES.find((family) => normalized.includes(family.key));
  return match?.label || "Other";
}

function runtimeModeForSource({
  status,
  termsStatus,
  latestRunStatus
}: {
  status: string;
  termsStatus: string;
  latestRunStatus: string;
}): DataSourceRuntimeMode {
  const normalizedStatus = status.toLowerCase();
  const normalizedTerms = termsStatus.toLowerCase();
  const normalizedRun = latestRunStatus.toLowerCase();

  if (normalizedStatus !== "active") return "simulated";
  if (normalizedTerms !== "approved") return "live-partial";
  if (!normalizedRun || normalizedRun === "pending" || normalizedRun === "running") return "live-partial";
  if (normalizedRun === "partial" || normalizedRun === "failed") return "live-partial";
  return "fully-live";
}

function complianceStatusForTerms(termsStatus: string) {
  const normalized = termsStatus.toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "blocked") return "blocked";
  if (normalized === "restricted") return "restricted";
  if (normalized === "pending_review") return "pending review";
  return normalized || "unknown";
}

function runtimeBadgeVariant(mode: DataSourceRuntimeMode) {
  if (mode === "fully-live") return "success";
  if (mode === "live-partial") return "warning";
  return "default";
}

function integrationBadgeVariant(status: IntegrationReadinessStatus) {
  if (status === "ready") return "success";
  if (status === "safe-mode") return "warning";
  if (status === "partial") return "brand";
  if (status === "disabled") return "default";
  return "danger";
}

export function buildDataSourceSummaries({
  sourceRows,
  runRows
}: {
  sourceRows: SourceRow[];
  runRows?: RunRow[];
}): DataSourceSummary[] {
  const latestRunBySource = new Map<string, RunRow>();
  for (const run of runRows || []) {
    const sourceId = asText(run.source_id || run.id || "");
    if (!sourceId) continue;

    const existing = latestRunBySource.get(sourceId);
    if (!existing) {
      latestRunBySource.set(sourceId, run);
      continue;
    }

    const currentTime = new Date(asText(existing.completed_at || existing.started_at || "")).getTime();
    const incomingTime = new Date(asText(run.completed_at || run.started_at || "")).getTime();
    if (incomingTime >= currentTime) {
      latestRunBySource.set(sourceId, run);
    }
  }

  return sourceRows.map((row) => {
    const sourceId = asText(row.id || row.source_id || row.name || row.source_type || cryptoRandomFallback());
    const latestRun = latestRunBySource.get(sourceId);
    const sourceType = asText(row.source_type || "unknown");
    const status = asText(row.status || "unknown");
    const termsStatus = asText(row.terms_status || "unknown");
    const latestRunStatus = asText(latestRun?.status || row.latest_run_status || status);
    const runtimeMode = runtimeModeForSource({ status, termsStatus, latestRunStatus });

    return {
      id: sourceId,
      name: asText(row.name || familyForSourceType(sourceType)),
      sourceType,
      family: familyForSourceType(sourceType),
      status,
      termsStatus,
      complianceStatus: complianceStatusForTerms(termsStatus),
      runtimeMode,
      freshness: toNumber(row.freshness_score ?? row.data_freshness_score ?? row.reliability_score, 0),
      reliability: toNumber(row.reliability_score ?? row.source_reliability_score, 0),
      latestRunStatus,
      recordsSeen: toNumber(latestRun?.records_seen ?? row.latest_records_seen, 0),
      recordsCreated: toNumber(latestRun?.records_created ?? row.latest_records_created, 0),
      provenance: asText(row.provenance || row.source_provenance || "Unknown"),
      latestRunAt: asText(latestRun?.completed_at || latestRun?.started_at || row.updated_at || row.freshness_timestamp || "")
    };
  });
}

export function buildIntegrationReadinessSummaries(): IntegrationReadinessSummary[] {
  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  const twilioDisabled = envTrue("SB_DISABLE_TWILIO");
  const twilioSafeMode = envTrue("SB_TWILIO_SAFE_MODE");

  const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
  const hubspotDisabled = envTrue("SB_DISABLE_HUBSPOT");
  const hubspotSafeMode = envTrue("SB_HUBSPOT_SAFE_MODE");

  const billingMode = String(process.env.BILLING_MODE || "disabled").toLowerCase();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_ID);

  return [
    twilioDisabled
      ? { name: "Twilio", status: "disabled", detail: "SMS and voice are intentionally disabled in this environment.", actionLabel: "Review settings", href: "/dashboard/settings#integrations" }
      : twilioConfigured
        ? {
            name: "Twilio",
            status: twilioSafeMode ? "safe-mode" : "ready",
            detail: twilioSafeMode ? "Safe mode is on; messages are validated without unsafe live traffic." : "SMS and voice are configured for live-safe dispatch.",
            actionLabel: "Review settings",
            href: "/dashboard/settings#integrations"
          }
        : { name: "Twilio", status: "missing", detail: "Credentials are missing for SMS and voice." },
    hubspotDisabled
      ? { name: "HubSpot", status: "disabled", detail: "CRM sync is intentionally disabled in this environment." }
      : hubspotConfigured
        ? {
            name: "HubSpot",
            status: hubspotSafeMode ? "safe-mode" : "ready",
            detail: hubspotSafeMode ? "Safe mode is on; CRM validation runs without unsafe writes." : "CRM task sync and attribution are configured."
          }
        : { name: "HubSpot", status: "missing", detail: "HubSpot access token is missing." },
    process.env.SMARTLEAD_API_KEY
      ? {
          name: "Smartlead",
          status: "ready",
          detail: "Outbound list sync is configured for lead follow-up."
        }
      : { name: "Smartlead", status: "missing", detail: "Smartlead is not configured for list execution." },
    process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY
      ? { name: "Inngest", status: "ready", detail: "Workflow automation is configured." }
      : { name: "Inngest", status: "missing", detail: "Workflow keys are missing." },
    process.env.SERVICE_BUTLER_ENRICHMENT_URL
      ? {
          name: "Enrichment provider",
          status: "ready",
          detail: "Premium enrichment is configured for property and contact data."
        }
      : { name: "Enrichment provider", status: "missing", detail: "Premium enrichment endpoint is not set." },
    billingMode === "stripe"
      ? stripeConfigured
        ? { name: "Stripe", status: "ready", detail: "Billing and subscription enforcement are configured." }
        : { name: "Stripe", status: "missing", detail: "Stripe billing is enabled but configuration is incomplete." }
      : { name: "Stripe", status: "disabled", detail: "Billing mode is disabled in this environment." },
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? { name: "Supabase", status: "ready", detail: "Primary database and auth wiring are in place." }
      : { name: "Supabase", status: "missing", detail: "Supabase environment variables are incomplete." },
    process.env.WEBHOOK_SHARED_SECRET
      ? { name: "Webhook secret", status: "ready", detail: "Inbound webhook authentication is configured." }
      : { name: "Webhook secret", status: "missing", detail: "Webhook authentication secret is not set." }
  ];
}

export function getSourceFamilySnapshots(sources: DataSourceSummary[]) {
  return SOURCE_FAMILIES.map((family) => {
    const familySources = sources.filter((source) => source.family === family.label);
    const runtimeModes = familySources.map((source) => source.runtimeMode);
    const mode: "configured" | "partial" | "missing" =
      familySources.length === 0 ? "missing" : runtimeModes.includes("live-partial") ? "partial" : "configured";

    return {
      key: family.key,
      label: family.label,
      description: family.description,
      mode,
      count: familySources.length,
      icon: family.icon
    };
  });
}

export function DataSourcesControlPlane({
  sources,
  ctaHref = "/dashboard/network"
}: {
  sources: DataSourceSummary[];
  ctaHref?: string;
}) {
  const liveCount = sources.filter((source) => source.runtimeMode === "fully-live").length;
  const partialCount = sources.filter((source) => source.runtimeMode === "live-partial").length;
  const simulatedCount = sources.filter((source) => source.runtimeMode === "simulated").length;
  const familySnapshots = getSourceFamilySnapshots(sources);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Data sources</p>
          <h2 className="mt-1 text-base font-semibold text-semantic-text">Production control plane</h2>
          <p className="mt-1 text-sm text-semantic-muted">
            Every family is surfaced here so operators can see what is live, what is partial, and what still needs activation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">{liveCount} live</Badge>
          <Badge variant="warning">{partialCount} partial</Badge>
          <Badge variant="default">{simulatedCount} simulated</Badge>
          <Link href={ctaHref} className={buttonStyles({ size: "sm", variant: "secondary" })}>
            Open network overview
          </Link>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {familySnapshots.map((family) => {
            const Icon = family.icon;
            const familyVariant = family.mode === "configured" ? "success" : family.mode === "partial" ? "warning" : "default";
            return (
              <div key={family.key} className="rounded-lg border border-semantic-border bg-semantic-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-semantic-text">{family.label}</p>
                      <p className="text-xs text-semantic-muted">{family.description}</p>
                    </div>
                  </div>
                  <Badge variant={familyVariant}>{family.mode}</Badge>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-semantic-muted">{family.count} configured source{family.count === 1 ? "" : "s"}</p>
              </div>
            );
          })}
        </div>

        <Table className="border-spacing-y-0">
          <TableHead>
            <tr>
              <TH>Source</TH>
              <TH>Mode</TH>
              <TH>Freshness</TH>
              <TH>Latest run</TH>
              <TH className="text-right">Records</TH>
            </tr>
          </TableHead>
          <TableBody>
            {sources.length === 0 ? (
              <tr>
                <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-4" colSpan={5}>
                  <EmptyState
                    title="No data sources found yet."
                    body="Seed or configure your first live source so the control plane can show runtime mode, freshness, and connector proof."
                  />
                </TD>
              </tr>
            ) : (
              sources.map((source) => (
                <tr key={source.id}>
                  <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                    <p className="text-sm font-medium text-semantic-text">{source.name}</p>
                    <p className="mt-1 text-xs text-semantic-muted">
                      {source.family} · {source.sourceType}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-semantic-muted">{source.provenance}</p>
                  </TD>
                  <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                    <Badge variant={runtimeBadgeVariant(source.runtimeMode)}>{source.runtimeMode}</Badge>
                    <p className="mt-2 text-xs text-semantic-muted">{source.status} · {source.complianceStatus}</p>
                  </TD>
                  <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                    <p className="text-sm font-medium text-semantic-text">{formatPercent(source.freshness)}</p>
                    <p className="mt-1 text-xs text-semantic-muted">{source.latestRunAt ? formatRelativeTime(source.latestRunAt) : "No recent run"}</p>
                  </TD>
                  <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                    <p className="text-sm font-medium text-semantic-text">{source.latestRunStatus || "not run"}</p>
                    <p className="mt-1 text-xs text-semantic-muted">{source.reliability.toFixed(0)} reliability</p>
                  </TD>
                  <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                    <p className="text-sm font-medium text-semantic-text">{source.recordsSeen.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-semantic-muted">{source.recordsCreated.toLocaleString()} created</p>
                  </TD>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}

export function SourceHealthSnapshot({
  sources,
  ctaHref = "/dashboard/settings#data-sources"
}: {
  sources: DataSourceSummary[];
  ctaHref?: string;
}) {
  const liveCount = sources.filter((source) => source.runtimeMode === "fully-live").length;
  const partialCount = sources.filter((source) => source.runtimeMode === "live-partial").length;
  const latest = [...sources].sort((a, b) => Number(b.freshness) - Number(a.freshness)).slice(0, 3);

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Source health</p>
          <h2 className="mt-1 text-base font-semibold text-semantic-text">Control-plane snapshot</h2>
        </div>
        <Link href={ctaHref} className={buttonStyles({ size: "sm", variant: "secondary" })}>
          Open data sources
        </Link>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Live" value={String(liveCount)} />
          <MiniStat label="Partial" value={String(partialCount)} />
          <MiniStat label="Total" value={String(sources.length)} />
        </div>
        {latest.length === 0 ? (
          <EmptyState title="No data sources yet." body="Configure live sources in settings to surface runtime status and connector proof here." />
        ) : (
          <div className="space-y-2">
            {latest.map((source) => (
              <div key={source.id} className="rounded-lg border border-semantic-border bg-semantic-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-semantic-text">{source.name}</p>
                    <p className="mt-1 text-xs text-semantic-muted">{source.family}</p>
                  </div>
                  <Badge variant={runtimeBadgeVariant(source.runtimeMode)}>{source.runtimeMode}</Badge>
                </div>
                <p className="mt-2 text-xs text-semantic-muted">
                  {source.latestRunStatus || "not run"} · {source.recordsCreated.toLocaleString()} created · {source.recordsSeen.toLocaleString()} seen
                </p>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function IntegrationReadinessPanel({
  items,
  ctaHref = "/dashboard/settings"
}: {
  items: IntegrationReadinessSummary[];
  ctaHref?: string;
}) {
  const readyCount = items.filter((item) => item.status === "ready").length;
  const safeModeCount = items.filter((item) => item.status === "safe-mode").length;
  const missingCount = items.filter((item) => item.status === "missing").length;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Integration readiness</p>
          <h2 className="mt-1 text-base font-semibold text-semantic-text">Live-safe support matrix</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">{readyCount} ready</Badge>
          <Badge variant="warning">{safeModeCount} safe mode</Badge>
          <Badge variant="default">{missingCount} missing</Badge>
          <Link href={ctaHref} className={buttonStyles({ size: "sm", variant: "secondary" })}>
            Review settings
          </Link>
        </div>
      </CardHeader>
      <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.name} className="rounded-lg border border-semantic-border bg-semantic-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-semantic-text">{item.name}</p>
                <p className="mt-1 text-xs text-semantic-muted">{item.detail}</p>
              </div>
              <Badge variant={integrationBadgeVariant(item.status)}>{item.status}</Badge>
            </div>
            {item.href && item.actionLabel && (
              <Link href={item.href} className={buttonStyles({ size: "sm", variant: "secondary", className: "mt-3" })}>
                {item.actionLabel}
              </Link>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-semantic-border bg-semantic-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-semantic-text">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-semantic-border bg-semantic-surface p-4">
      <p className="text-sm font-medium text-semantic-text">{title}</p>
      <p className="mt-1 text-xs leading-5 text-semantic-muted">{body}</p>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function envTrue(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function cryptoRandomFallback() {
  return `source-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildDemoDataSourceBundle() {
  const now = new Date();
  return {
    sourceRows: [
      {
        id: "demo-weather",
        name: "NOAA Weather Feed",
        source_type: "weather",
        status: "active",
        terms_status: "approved",
        reliability_score: 92,
        freshness_timestamp: now.toISOString(),
        provenance: "api.weather.gov",
        latest_run_status: "completed",
        latest_records_seen: 124,
        latest_records_created: 18
      },
      {
        id: "demo-permits",
        name: "Permit Signals",
        source_type: "permits",
        status: "active",
        terms_status: "approved",
        reliability_score: 84,
        freshness_timestamp: new Date(now.getTime() - 1000 * 60 * 38).toISOString(),
        provenance: "provider.permits",
        latest_run_status: "completed",
        latest_records_seen: 76,
        latest_records_created: 9
      },
      {
        id: "demo-open311",
        name: "Open311 Requests",
        source_type: "open311",
        status: "active",
        terms_status: "approved",
        reliability_score: 78,
        freshness_timestamp: new Date(now.getTime() - 1000 * 60 * 92).toISOString(),
        provenance: "municipal.open311",
        latest_run_status: "partial",
        latest_records_seen: 48,
        latest_records_created: 5
      }
    ] as SourceRow[],
    runRows: [
      {
        source_id: "demo-weather",
        status: "completed",
        records_seen: 124,
        records_created: 18,
        completed_at: now.toISOString()
      },
      {
        source_id: "demo-permits",
        status: "completed",
        records_seen: 76,
        records_created: 9,
        completed_at: new Date(now.getTime() - 1000 * 60 * 38).toISOString()
      },
      {
        source_id: "demo-open311",
        status: "partial",
        records_seen: 48,
        records_created: 5,
        completed_at: new Date(now.getTime() - 1000 * 60 * 92).toISOString()
      }
    ] as RunRow[]
  };
}
