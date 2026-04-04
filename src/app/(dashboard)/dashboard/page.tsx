import Link from "next/link";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Radio,
  ShieldCheck,
  Target,
  TrendingUp,
  TriangleAlert
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableBody, TableHead, TD, TH } from "@/components/ui/table";
import type { DataSourceSummary } from "@/lib/control-plane/types";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { WeatherTicker } from "@/components/dashboard/weather-ticker";
import { listDataSourceSummaries } from "@/lib/control-plane/data-sources";
import { getForecastByLatLng } from "@/lib/services/weather";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { getFranchiseDashboardReadModel } from "@/lib/v2/dashboard-read-models";
import { getOpportunityQualificationSnapshot } from "@/lib/v2/opportunity-qualification";
import { opportunityPriorityScore } from "@/lib/v2/source-lanes";

type DashboardLeadRow = {
  id: string;
  name?: string | null;
  service_type?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  requested_timeframe?: string | null;
  created_at: string;
  scheduled_for?: string | null;
  intent?: number;
  intentScore?: number;
};

type DashboardJobRow = {
  id: string;
  pipeline_status?: string | null;
  scheduled_for?: string | null;
  estimated_value?: number | null;
  service_type?: string | null;
  customer_name?: string | null;
  city?: string | null;
  state?: string | null;
  intent_score?: number | null;
};

type DashboardOpportunityRow = {
  id: string;
  category?: string | null;
  title?: string | null;
  location_text?: string | null;
  intent_score?: number | null;
  urgency_score?: number | null;
  confidence?: number | null;
  priority_score?: number | null;
  created_at: string;
};

type DashboardOutboundRow = {
  id: string;
  name?: string | null;
  list_type?: string | null;
  export_status?: string | null;
};

type DashboardSdrRow = {
  id: string;
  title?: string | null;
  location_text?: string | null;
  created_at: string;
  next_recommended_action?: string | null;
  qualification_source?: string | null;
};

export default async function DashboardOverviewPage() {
  const demoMode = isDemoMode();
  let leadRows: DashboardLeadRow[] = [];
  let jobRows: DashboardJobRow[] = [];
  let opportunities: DashboardOpportunityRow[] = [];
  let outboundLists: DashboardOutboundRow[] = [];
  let sdrQueue: DashboardSdrRow[] = [];
  let enrichedLeads: Array<DashboardLeadRow & { intent: number }> = [];
  let sourceSummaries: DataSourceSummary[] = await listDataSourceSummaries();
  let captureProofSummary:
    | {
        realSourceEventsCaptured?: number;
        realOpportunitiesCaptured?: number;
        opportunitiesRequiringSdr?: number;
        qualifiedContactableOpportunities?: number;
        realLeadsCreated?: number;
        bookedJobsAttributed?: number;
      }
    | null = null;
  let settings:
    | {
        weather_lat?: number | null;
        weather_lng?: number | null;
        weather_location_label?: string | null;
        home_base_city?: string | null;
        home_base_state?: string | null;
      }
    | null = null;

  if (demoMode) {
    sourceSummaries = await listDataSourceSummaries();
    settings = null;
  } else {
    const { accountId, supabase } = await getCurrentUserContext();

    const [{ data: leads }, { data: loadedSettings }, { data: jobs }, { data: loadedLists }] = await Promise.all([
      supabase
        .from("leads")
        .select("id,name,service_type,city,state,status,requested_timeframe,created_at,scheduled_for")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
      supabase
        .from("account_settings")
        .select("weather_lat,weather_lng,weather_location_label,home_base_city,home_base_state")
        .eq("account_id", accountId)
        .maybeSingle(),
      supabase
        .from("jobs")
        .select("id,pipeline_status,scheduled_for,estimated_value,service_type,customer_name,city,state,intent_score")
        .eq("account_id", accountId)
        .order("scheduled_for", { ascending: true, nullsFirst: false }),
      supabase.from("outbound_lists").select("id,name,list_type,export_status").eq("account_id", accountId).order("created_at", { ascending: false }).limit(12)
    ]);

    const { data: loadedOpportunities } = await supabase
      .from("opportunities")
      .select("id,category,title,location_text,intent_score,urgency_score,confidence,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(30);

    leadRows = leads || [];
    jobRows = jobs || [];
    opportunities = loadedOpportunities || [];
    outboundLists = loadedLists || [];
    settings = loadedSettings;

    const leadIds = leadRows.map((lead) => String(lead.id));
    let scoreMap: Record<string, number[]> = {};
    if (leadIds.length > 0) {
      const { data: signals } = await supabase.from("lead_intent_signals").select("lead_id,score").in("lead_id", leadIds);
      scoreMap = (signals || []).reduce<Record<string, number[]>>((acc, row) => {
        const key = String(row.lead_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(Number(row.score) || 0);
        return acc;
      }, {});
    }

    enrichedLeads = leadRows.map((lead) => {
      const values = scoreMap[String(lead.id)] || [];
      const intent = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      return { ...lead, intent };
    });

    const v2Context = await getV2TenantContext().catch(() => null);
    if (v2Context) {
      sourceSummaries = await listDataSourceSummaries({
        supabase: v2Context.supabase as never,
        tenantId: v2Context.franchiseTenantId
      });
      const franchiseReadModel = await getFranchiseDashboardReadModel({
        supabase: v2Context.supabase,
        franchiseTenantId: v2Context.franchiseTenantId
      });
      captureProofSummary = franchiseReadModel.capture_proof_summary || null;

      const { data: queuedOpportunities } = await v2Context.supabase
        .from("v2_opportunities")
        .select("id,title,location_text,created_at,lifecycle_status,contact_status,explainability_json")
        .eq("tenant_id", v2Context.franchiseTenantId)
        .order("created_at", { ascending: false })
        .limit(80);

      sdrQueue = ((queuedOpportunities || []) as Array<Record<string, unknown>>)
        .filter((row) => {
          const qualification = getOpportunityQualificationSnapshot({
            explainability: row.explainability_json,
            lifecycleStatus: row.lifecycle_status,
            contactStatus: row.contact_status
          });
          return qualification.qualificationStatus === "queued_for_sdr";
        })
        .map((row) => {
          const explainability = (row.explainability_json as Record<string, unknown> | null) || {};
          return {
            id: String(row.id),
            title: typeof row.title === "string" ? row.title : "Queued signal",
            location_text: typeof row.location_text === "string" ? row.location_text : null,
            created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
            next_recommended_action: typeof explainability.next_recommended_action === "string" ? explainability.next_recommended_action : null,
            qualification_source: typeof explainability.qualification_source === "string" ? explainability.qualification_source : null
          };
        })
        .slice(0, 5);
    }
  }

  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const highIntent = enrichedLeads.filter((lead) => lead.intent >= 75 && lead.status !== "won" && lead.status !== "lost").length;
  const scheduledToday = jobRows.filter((job) => job.scheduled_for && new Date(job.scheduled_for as string) >= startOfDay).length;
  const jobsNextSeven = jobRows.filter(
    (job) => job.scheduled_for && new Date(job.scheduled_for as string) >= now && new Date(job.scheduled_for as string) <= nextWeek
  ).length;

  const weeklyRevenue = jobRows
    .filter((job) => job.scheduled_for && new Date(job.scheduled_for as string) >= now && new Date(job.scheduled_for as string) <= nextWeek)
    .reduce((sum, job) => sum + Number(job.estimated_value || 0), 0);

  const nextUp = jobRows
    .filter((job) => job.scheduled_for && new Date(job.scheduled_for as string) >= now)
    .sort((a, b) => new Date(a.scheduled_for as string).getTime() - new Date(b.scheduled_for as string).getTime())
    .slice(0, 5);

  const lat = settings?.weather_lat != null ? Number(settings.weather_lat) : null;
  const lng = settings?.weather_lng != null ? Number(settings.weather_lng) : null;
  const weatherLabel = settings?.weather_location_label
    ? String(settings.weather_location_label)
    : [settings?.home_base_city, settings?.home_base_state].filter(Boolean).join(", ");

  let weatherHighRisk = false;
  if (lat != null && lng != null) {
    try {
      const forecast = await getForecastByLatLng(lat, lng);
      const precip = forecast.current.precipitationChance ?? 0;
      const wind = forecast.current.windKph ?? 0;
      const nextWet = forecast.next6Hours.some((hour) => hour.precipChance >= 45);
      weatherHighRisk = precip >= 55 || wind >= 30 || nextWet;
    } catch {
      weatherHighRisk = false;
    }
  }

  const bookedJobs = jobRows.filter((job) =>
    ["WON", "COMPLETED", "SCHEDULED", "IN_PROGRESS"].includes(String(job.pipeline_status || "").toUpperCase())
  ).length;
  const syncedLists = outboundLists.filter((item) => String(item.export_status) === "synced").length;
  const priorityLeads = [...enrichedLeads]
    .filter((lead) => !["won", "lost"].includes(String(lead.status || "").toLowerCase()))
    .sort((a, b) => Number(b.intent || 0) - Number(a.intent || 0))
    .slice(0, 5);
  const highestUrgencyOpportunities = [...opportunities]
    .sort((a, b) => resolveOpportunityPriority(b) - resolveOpportunityPriority(a))
    .slice(0, 5);
  const latestOpportunity = opportunities[0] || null;

  const territorySummary = buildTerritorySummary({
    opportunities,
    leads: leadRows,
    jobs: jobRows,
    fallbackMarket: weatherLabel || "Core market"
  });
  const activeMarkets = Math.max(territorySummary.length, weatherLabel ? 1 : 0);
  const latestSignalAge = latestOpportunity ? formatRelativeTime(latestOpportunity.created_at) : "No signals";
  const queueReadyLeads = priorityLeads.filter((lead) => !lead.scheduled_for).length || priorityLeads.length;
  const blockedSources = sourceSummaries.filter((source) => source.captureStatus === "blocked").length;
  const simulatedSources = sourceSummaries.filter((source) => source.captureStatus === "simulated").length;
  const hasProofChainData = Boolean(
    captureProofSummary &&
      Object.values(captureProofSummary).some((value) => Number(value || 0) > 0)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator"
        title="Operator Command Center"
        subtitle="Real-time view of demand, verified leads, booked work, and local market pressure."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Opportunities" value={String(opportunities.length)} icon={<Target className="h-4 w-4" />} tone="brand" />
        <StatTile label="Needs action" value={String(queueReadyLeads)} icon={<TriangleAlert className="h-4 w-4" />} tone="warning" />
        <StatTile label="Jobs booked" value={String(bookedJobs)} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatTile label="Outreach sync" value={String(syncedLists)} icon={<Radio className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Week revenue" value={formatCurrency(weeklyRevenue)} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatTile label="Jobs next 7 days" value={String(jobsNextSeven)} icon={<Clock3 className="h-4 w-4" />} />
        <StatTile label="Active markets" value={String(activeMarkets)} icon={<MapPin className="h-4 w-4" />} />
        <StatTile label="Latest signal" value={latestSignalAge} icon={<Radio className="h-4 w-4" />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <WeatherTicker lat={lat} lng={lng} locationLabel={weatherLabel} />

        <SourceHealthSnapshotCard sources={sourceSummaries} ctaHref="/dashboard/settings#data-sources" forceBlockedGuidance={demoMode} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Highest urgency</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Opportunities to work first</h2>
            </div>
            <Link href="/dashboard/opportunities" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open opportunities
            </Link>
          </CardHeader>
          <CardBody className="space-y-4">
            {highestUrgencyOpportunities.length === 0 ? (
              <EmptyPanel
                title="No real opportunities detected yet."
                body="Open live source setup first, then run the scanner. Research-only market pressure should route into SDR before it is counted in the proof chain."
              />
            ) : (
              <Table className="border-spacing-y-0">
                <TableHead>
                  <tr>
                    <TH>Opportunity</TH>
                    <TH>Territory</TH>
                    <TH className="text-right">Intent</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {highestUrgencyOpportunities.map((item) => (
                    <tr key={item.id}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <Link
                          href={`/dashboard/opportunities?opportunity=${encodeURIComponent(item.id)}`}
                          className="text-sm font-medium text-semantic-text transition hover:text-brand-700"
                        >
                          {item.title || "Untitled opportunity"}
                        </Link>
                        <p className="mt-1 text-xs text-semantic-muted">{item.category ? toTitleCase(item.category) : "Restoration signal"}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none text-xs text-semantic-muted">
                        {item.location_text || weatherLabel || "Core market"}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        <Badge variant={resolveOpportunityPriority(item) >= 75 ? "warning" : "default"}>
                          {resolveOpportunityPriority(item)}%
                        </Badge>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Needs action</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Verified leads to contact next</h2>
            </div>
            <Link href="/dashboard/leads" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open leads
            </Link>
          </CardHeader>
          <CardBody className="space-y-4">
            {priorityLeads.length === 0 ? (
              <EmptyPanel
                title="No verified lead queue yet."
                body="Use scanner capture and SDR verification to clear a real phone or email. This route stays empty until the live proof chain produces verified leads."
              />
            ) : (
              <Table className="border-spacing-y-0">
                <TableHead>
                  <tr>
                    <TH>Lead</TH>
                    <TH>Service line</TH>
                    <TH className="text-right">Queue status</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {priorityLeads.map((lead) => (
                    <tr key={lead.id}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <Link href={`/dashboard/leads/${lead.id}`} className="text-sm font-medium text-semantic-text transition hover:text-brand-700">
                          {lead.name || "Unknown lead"}
                        </Link>
                        <p className="mt-1 text-xs text-semantic-muted">{[lead.city, lead.state].filter(Boolean).join(", ") || weatherLabel || "Core market"}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <p className="text-sm text-semantic-text">{lead.service_type || "Restoration service"}</p>
                        <p className="mt-1 text-xs text-semantic-muted">{lead.requested_timeframe || "Immediate follow-up recommended"}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        <Badge variant={Number(lead.intent || 0) >= 75 ? "warning" : "default"}>{Number(lead.intent || 0)}%</Badge>
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-semantic-muted">
                          {lead.scheduled_for ? "Scheduled follow-up" : "Call now"}
                        </p>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">SDR lane</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Queued follow-up waiting on verified contact</h2>
            </div>
            <Link href="/dashboard/scanner?queue=sdr" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open SDR lane
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {sdrQueue.length === 0 ? (
              <EmptyPanel
                title="No queued SDR work right now."
                body="Once live sources are configured, run the scanner and escalate research-only rows here. SDR is the bridge between source capture and verified lead creation."
              />
            ) : (
              sdrQueue.map((item) => (
                <Link
                  key={item.id}
                  href="/dashboard/scanner?queue=sdr"
                  className="flex items-center justify-between gap-4 rounded-lg border border-semantic-border bg-semantic-surface px-4 py-3 transition hover:border-brand-300 hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-semantic-text">{item.title || "Queued signal"}</p>
                    <p className="mt-1 text-xs text-semantic-muted">{item.location_text || weatherLabel || "Core market"}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-semantic-muted">
                      {(item.next_recommended_action || "await_sdr_review").replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="warning">Queued for SDR</Badge>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-semantic-muted">{formatRelativeTime(item.created_at)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Qualification throughput</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">What has to be true before a signal becomes a lead</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <MetricRow
              label="Research-only signals"
              value={String(sdrQueue.length)}
              helper="Signals stay blocked until SDR captures a verified phone or email."
              icon={<TriangleAlert className="h-4 w-4" />}
            />
            <MetricRow
              label="Lead queue"
              value={String(priorityLeads.length)}
              helper="Once contact is verified, the signal can move into the lead queue for dispatch."
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <MetricRow
              label="Buyer-proof path"
              value="Signal -> SDR -> lead -> job"
              helper="This keeps the demo honest and makes attribution legible to a buyer."
              icon={<ShieldCheck className="h-4 w-4" />}
            />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Operator proof</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Real capture vs qualified lead proof</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {hasProofChainData ? (
              <>
                <p className="text-sm leading-6 text-semantic-muted">
                  Signals and opportunities show market pressure. Only verified-contact, traceable chains count as lead and booked-job proof.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricRow label="Real source events" value={String(captureProofSummary?.realSourceEventsCaptured || 0)} helper="Live public or provider-backed events captured into v2 source events." icon={<Radio className="h-4 w-4" />} />
                  <MetricRow label="Real opportunities" value={String(captureProofSummary?.realOpportunitiesCaptured || 0)} helper="Non-simulated opportunities created from those events." icon={<Target className="h-4 w-4" />} />
                  <MetricRow label="Needs SDR" value={String(captureProofSummary?.opportunitiesRequiringSdr || 0)} helper="Signals blocked until verified contact is captured." icon={<TriangleAlert className="h-4 w-4" />} />
                  <MetricRow label="Qualified contactable" value={String(captureProofSummary?.qualifiedContactableOpportunities || 0)} helper="Opportunities now eligible to become leads." icon={<ShieldCheck className="h-4 w-4" />} />
                  <MetricRow label="Real leads" value={String(captureProofSummary?.realLeadsCreated || 0)} helper="Verified leads on a traceable non-simulated path." icon={<CheckCircle2 className="h-4 w-4" />} />
                  <MetricRow label="Booked jobs proof" value={String(captureProofSummary?.bookedJobsAttributed || 0)} helper="Attributed booked jobs from the qualified proof chain." icon={<TrendingUp className="h-4 w-4" />} />
                </div>
              </>
            ) : (
              <EmptyPanel
                title="No buyer-safe proof chain yet."
                body="Start with live source setup, run the scanner, route research-only rows into SDR, and verify one real contactable lead before expecting booked-job proof."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Production watch</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">What can still block a buyer-safe demo</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <MetricRow label="Blocked live sources" value={String(blockedSources)} helper="These sources are configured but still blocked by terms, credentials, or failed runs." icon={<TriangleAlert className="h-4 w-4" />} />
            <MetricRow label="Simulated sources" value={String(simulatedSources)} helper="Useful for operator review only. Excluded from real capture and buyer-proof metrics." icon={<Radio className="h-4 w-4" />} />
            <MetricRow label="Queued SDR aging" value={String(sdrQueue.length)} helper="Research-only opportunities waiting on verified contact before lead creation." icon={<Clock3 className="h-4 w-4" />} />
            <MetricRow
              label="Proof dropoff"
              value={String(Math.max(0, (captureProofSummary?.realOpportunitiesCaptured || 0) - (captureProofSummary?.realLeadsCreated || 0)))}
              helper="Real opportunities that have not yet converted into verified leads."
              icon={<Radio className="h-4 w-4" />}
            />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Territory summary</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Where demand is stacking up</h2>
            </div>
            <Badge variant="brand">{activeMarkets} active</Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            {territorySummary.length === 0 ? (
              <EmptyPanel
                title="No territory view yet."
                body="Markets appear here after live source setup, scanner capture, SDR verification, and the first proof-chain conversions."
              />
            ) : (
              <Table className="border-spacing-y-0">
                <TableHead>
                  <tr>
                    <TH>Market</TH>
                    <TH className="text-right">Signals</TH>
                    <TH className="text-right">Leads</TH>
                    <TH className="text-right">Jobs</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {territorySummary.map((territory) => (
                    <tr key={territory.label}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <p className="text-sm font-medium text-semantic-text">{territory.label}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {territory.opportunities}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {territory.leads}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {territory.jobs}
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Revenue proof</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Why this reads like a traceable lead engine</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <MetricRow
                label="Booked revenue"
                value={formatCurrency(weeklyRevenue)}
                helper="Booked work scheduled in the next seven days."
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <MetricRow
                label="High-intent leads"
                value={String(highIntent)}
                helper="Verified demand that should be worked before it cools off."
                icon={<TriangleAlert className="h-4 w-4" />}
              />
              <MetricRow
                label="Jobs on board today"
                value={String(scheduledToday)}
                helper="Proof that the workflow is turning qualified opportunities into actual scheduled work."
                icon={<Clock3 className="h-4 w-4" />}
              />
              <MetricRow
                label="Operating posture"
                value={weatherHighRisk ? "Elevated weather pressure" : "Stable market conditions"}
                helper="The service area, weather feed, and queue should read like one connected operating system."
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Scheduled work</p>
                <h2 className="mt-1 text-base font-semibold text-semantic-text">Upcoming jobs</h2>
              </div>
              <Link href="/dashboard/jobs" className={buttonStyles({ size: "sm", variant: "secondary" })}>
                Open jobs
              </Link>
            </CardHeader>
            <CardBody className="space-y-2">
              {nextUp.length === 0 ? (
                <EmptyPanel
                  title="No booked visits yet."
                  body="Booked work appears here only after the scanner -> SDR -> lead -> job proof chain is real and attributable."
                />
              ) : (
                nextUp.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-semantic-border bg-semantic-surface px-4 py-3 transition hover:border-brand-300 hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-semantic-text">{job.customer_name || "Unknown customer"}</p>
                      <p className="mt-1 text-xs text-semantic-muted">
                        {job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-semantic-text">{formatScheduled(job.scheduled_for as string)}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-semantic-muted">{job.pipeline_status || "NEW"}</p>
                    </div>
                  </Link>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SourceHealthSnapshotCard({
  sources,
  ctaHref,
  forceBlockedGuidance = false
}: {
  sources: DataSourceSummary[];
  ctaHref: string;
  forceBlockedGuidance?: boolean;
}) {
  const liveCount = sources.filter((source) => source.runtimeMode === "fully-live").length;
  const partialCount = sources.filter((source) => source.runtimeMode === "live-partial").length;
  const visibleSources = sources
    .filter((source) => source.configured || source.runtimeMode !== "simulated")
    .slice(0, 4);

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Source health</p>
          <h2 className="mt-1 text-base font-semibold text-semantic-text">Live ingestion snapshot</h2>
        </div>
        <Link href={ctaHref} className={buttonStyles({ size: "sm", variant: "secondary" })}>
          Open data sources
        </Link>
      </CardHeader>
      <CardBody className="space-y-4">
        {forceBlockedGuidance ? (
          <EmptyPanel
            title="Live source setup required."
            body="Normal operator view stays blocked until live sources are configured. Open data sources, activate real connectors, then run the scanner and push research-only pressure into SDR."
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MiniSourceStat label="Live" value={String(liveCount)} />
              <MiniSourceStat label="Partial" value={String(partialCount)} />
              <MiniSourceStat label="Total" value={String(sources.length)} />
            </div>
            {visibleSources.length === 0 ? (
              <EmptyPanel
                title="No active data sources yet."
                body="Open settings to configure live sources, then run the scanner. Once capture starts, research-only pressure should route into SDR before it becomes lead proof."
              />
            ) : (
              <div className="space-y-2">
                {visibleSources.map((source) => (
                  <div key={source.id || source.catalogKey} className="rounded-lg border border-semantic-border bg-semantic-surface p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-semantic-text">{source.name}</p>
                        <p className="mt-1 text-xs text-semantic-muted">
                          {source.family} · {source.freshnessLabel}
                        </p>
                      </div>
                      <Badge variant={source.runtimeMode === "fully-live" ? "success" : source.runtimeMode === "live-partial" ? "warning" : "default"}>
                        {source.runtimeMode}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-semantic-muted">
                      {source.latestRunStatus || "not run"} · {source.recordsCreated.toLocaleString()} created · {source.recordsSeen.toLocaleString()} seen
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function MiniSourceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-semantic-border bg-semantic-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-semantic-text">{value}</p>
    </div>
  );
}

function formatScheduled(date: string) {
  return new Date(date).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function MetricRow({
  label,
  value,
  helper,
  icon
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-semantic-border bg-semantic-surface p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
        <p className="mt-1 text-sm font-medium text-semantic-text">{value}</p>
        <p className="mt-1 text-xs leading-5 text-semantic-muted">{helper}</p>
      </div>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-semantic-border bg-semantic-surface p-4">
      <p className="text-sm font-medium text-semantic-text">{title}</p>
      <p className="mt-1 text-xs leading-5 text-semantic-muted">{body}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function resolveOpportunityPriority(item: DashboardOpportunityRow) {
  if (Number.isFinite(Number(item.priority_score))) return Number(item.priority_score);
  return opportunityPriorityScore({
    urgencyScore: item.urgency_score,
    jobLikelihoodScore: item.intent_score,
    sourceReliabilityScore: item.confidence
  });
}

function formatRelativeTime(value: string) {
  const target = new Date(value);
  if (!Number.isFinite(target.getTime())) return "No signals";

  const delta = Date.now() - target.getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTerritorySummary({
  opportunities,
  leads,
  jobs,
  fallbackMarket
}: {
  opportunities: DashboardOpportunityRow[];
  leads: DashboardLeadRow[];
  jobs: DashboardJobRow[];
  fallbackMarket: string;
}) {
  const markets = new Map<string, { label: string; opportunities: number; leads: number; jobs: number }>();

  const getBucket = (label: string) => {
    if (!markets.has(label)) {
      markets.set(label, { label, opportunities: 0, leads: 0, jobs: 0 });
    }
    return markets.get(label)!;
  };

  for (const item of opportunities) {
    const label = normalizeMarketLabel(item.location_text, fallbackMarket);
    getBucket(label).opportunities += 1;
  }

  for (const item of leads) {
    const label = normalizeMarketLabel([item.city, item.state].filter(Boolean).join(", "), fallbackMarket);
    getBucket(label).leads += 1;
  }

  for (const item of jobs) {
    const label = normalizeMarketLabel([item.city, item.state].filter(Boolean).join(", "), fallbackMarket);
    getBucket(label).jobs += 1;
  }

  return Array.from(markets.values())
    .sort((a, b) => b.opportunities + b.leads + b.jobs - (a.opportunities + a.leads + a.jobs))
    .slice(0, 5);
}

function normalizeMarketLabel(value: string | null | undefined, fallbackMarket: string) {
  return String(value || "").trim() || fallbackMarket;
}
