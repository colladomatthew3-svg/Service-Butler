import Link from "next/link";
import { ArrowUpRight, BadgeCheck, BookOpen, Building2, Globe, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableBody, TableHead, TD, TH } from "@/components/ui/table";
import { buildEnvironmentReadinessState } from "@/lib/control-plane/readiness";
import { listDataSourceSummaries } from "@/lib/control-plane/data-sources";
import type { DataSourceSummary, ReadinessState } from "@/lib/control-plane/types";
import { getV2TenantContext } from "@/lib/v2/context";
import { getCorporateDashboardReadModel, getFranchiseDashboardReadModel } from "@/lib/v2/dashboard-read-models";
import type { CaptureProofSummary } from "@/lib/v2/capture-proof";
import { getProductionReadinessSummary } from "@/lib/v2/readiness";
import { isDemoMode } from "@/lib/services/review-mode";
import type { ReactNode } from "react";

type SourcePreviewRow = {
  source_id: string;
  source_name: string;
  source_type: string;
  authenticity?: string;
  event_count?: number;
  score: number;
  recommendation: string;
  verified_lead_count: number;
  booked_job_count: number;
};

type TerritoryPerformanceRow = {
  territory_id: string;
  territory_name: string;
  assignments: number;
  accepted: number;
  completed: number;
};

type ProofSampleRow = {
  lead_id: string;
  contact_name: string;
  source_name: string;
  service_line: string;
  verification_score: number;
  proof_authenticity?: string;
  proof_summary: string;
};

type FranchiseReadModel = {
  intelligence?: {
    source_quality_preview?: SourcePreviewRow[];
    source_trust_summary?: { keep: number; tune: number; pause: number };
  };
  lead_quality_proof?: {
    verified_lead_count?: number;
    live_provider_verified_lead_count?: number;
    network_verified_lead_count?: number;
    booked_jobs_from_verified_leads?: number;
    booked_jobs_from_live_provider_verified_leads?: number;
    booked_jobs_from_network_leads?: number;
    network_activated_opportunity_count?: number;
    network_outreach_event_count?: number;
    contactable_lead_count?: number;
    proof_samples?: ProofSampleRow[];
  };
  capture_proof_summary?: CaptureProofSummary | null;
  outreach_activity?: {
    total?: number;
  };
  territory_performance?: TerritoryPerformanceRow[];
  freshness?: {
    connector_runs_considered?: number;
    outreach_events_considered?: number;
  };
} | null;

type CorporateReadModel = {
  metrics?: Array<{ label: string; value: number }>;
  byFranchise?: Array<{ tenant_id: string; franchise: string; opportunities: number; booked_jobs: number; booking_rate: number }>;
} | null;

type NetworkViewModel = {
  viewState: "live" | "demo" | "blocked";
  demoMode: boolean;
  franchise: FranchiseReadModel | null;
  corporate: CorporateReadModel | null;
  dataSources: DataSourceSummary[];
  readiness: ReadinessState | null;
};

export default async function NetworkOverviewPage() {
  const viewModel = await loadNetworkViewModel();
  const franchise = viewModel.franchise;
  const corporate = viewModel.corporate;
  const sources = viewModel.dataSources;

  const sourcePreview = franchise?.intelligence?.source_quality_preview?.slice(0, 5) || [];
  const sourceTrust = franchise?.intelligence?.source_trust_summary || { keep: 0, tune: 0, pause: 0 };
  const verifiedLeadCount = franchise?.lead_quality_proof?.verified_lead_count || 0;
  const liveProviderVerifiedLeadCount = franchise?.lead_quality_proof?.live_provider_verified_lead_count || 0;
  const networkVerifiedLeadCount = franchise?.lead_quality_proof?.network_verified_lead_count || 0;
  const bookedFromVerified = franchise?.lead_quality_proof?.booked_jobs_from_verified_leads || 0;
  const bookedFromLiveProviderVerified = franchise?.lead_quality_proof?.booked_jobs_from_live_provider_verified_leads || 0;
  const bookedFromNetworkLeads = franchise?.lead_quality_proof?.booked_jobs_from_network_leads || 0;
  const networkActivatedOpportunities = franchise?.lead_quality_proof?.network_activated_opportunity_count || 0;
  const networkOutreachEvents = franchise?.lead_quality_proof?.network_outreach_event_count || 0;
  const outreachTotal = franchise?.outreach_activity?.total || 0;
  const territoryPerformance = franchise?.territory_performance || [];
  const proofSamples = franchise?.lead_quality_proof?.proof_samples || [];
  const captureProof = franchise?.capture_proof_summary || null;
  const revenue = pickMetric(corporate?.metrics || [], "attributable_revenue") || pickMetric(corporate?.metrics || [], "estimated_revenue");
  const scheduledWork = pickMetric(corporate?.metrics || [], "scheduled_work");
  const opportunities = pickMetric(corporate?.metrics || [], "opportunity_volume");
  const bookedJobs = pickMetric(corporate?.metrics || [], "booked_jobs");
  const networkCount = corporate?.byFranchise?.length || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer view"
        title="Network Overview"
        subtitle="A buyer-facing proof surface for restoration demand, connector freshness, verified leads, booked jobs, and revenue evidence."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={viewModel.viewState === "blocked" ? "danger" : "brand"}>
              {viewModel.viewState === "blocked" ? "Blocked proof" : viewModel.demoMode ? "Demo proof" : "Live proof"}
            </Badge>
            <Link href="/dashboard/settings#data-sources" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Review data sources
            </Link>
            <Link href="/dashboard" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open operator view
            </Link>
          </div>
        }
      />

      {viewModel.viewState === "blocked" && viewModel.readiness ? (
        <Card className="border-rose-300/70 bg-rose-50/80">
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-800">Buyer proof blocked</p>
            <h2 className="mt-1 text-base font-semibold text-rose-950">This environment is not live enough to show buyer-proof metrics.</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-rose-950">{viewModel.readiness.reason}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {viewModel.readiness.blockingIssues.map((entry) => (
                <div key={`${entry.code}-${entry.message}`} className="rounded-lg border border-rose-300/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">{entry.code.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-sm font-medium text-rose-950">{entry.message}</p>
                  {entry.detail ? <p className="mt-1 text-sm text-rose-900/80">{entry.detail}</p> : null}
                </div>
              ))}
            </div>
            {viewModel.readiness.recommendedActions.length > 0 ? (
              <div className="rounded-lg border border-rose-300/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">Remediation</p>
                <ul className="mt-3 space-y-2 text-sm text-rose-950">
                  {viewModel.readiness.recommendedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {viewModel.viewState === "blocked" ? null : (
        <>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Real source events" value={captureProof?.realSourceEventsCaptured || 0} icon={<Globe className="h-4 w-4" />} tone="brand" />
        <StatTile label="Real opportunities" value={captureProof?.realOpportunitiesCaptured || 0} icon={<Target className="h-4 w-4" />} tone="brand" />
        <StatTile label="Needs SDR" value={captureProof?.opportunitiesRequiringSdr || 0} icon={<BookOpen className="h-4 w-4" />} />
        <StatTile label="Qualified contactable" value={captureProof?.qualifiedContactableOpportunities || 0} icon={<BadgeCheck className="h-4 w-4" />} tone="success" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Verified leads" value={verifiedLeadCount} icon={<BadgeCheck className="h-4 w-4" />} tone="success" />
        <StatTile label="Live-provider verified leads" value={liveProviderVerifiedLeadCount} icon={<BadgeCheck className="h-4 w-4" />} tone="brand" />
        <StatTile label="Network verified leads" value={networkVerifiedLeadCount} icon={<Building2 className="h-4 w-4" />} tone="brand" />
        <StatTile label="Booked jobs from verified leads" value={bookedFromVerified} icon={<BookOpen className="h-4 w-4" />} tone="success" />
        <StatTile label="Booked jobs from live-provider leads" value={bookedFromLiveProviderVerified} icon={<BookOpen className="h-4 w-4" />} tone="brand" />
        <StatTile label="Booked jobs from network leads" value={bookedFromNetworkLeads} icon={<ArrowUpRight className="h-4 w-4" />} tone="success" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Attributable revenue" value={formatCurrency(revenue)} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatTile label="Scheduled work" value={scheduledWork} icon={<BookOpen className="h-4 w-4" />} />
        <StatTile label="Active franchises" value={networkCount} icon={<Building2 className="h-4 w-4" />} />
        <StatTile label="Network outreach events" value={networkOutreachEvents} icon={<Globe className="h-4 w-4" />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Capture proof</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Signals, opportunities, and leads are counted separately</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm leading-6 text-semantic-muted">
              Public-source opportunities are market pressure signals. Only verified-contact, traceable chains count as lead and booked-job proof.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="All source events" value={captureProof?.sourceEventsCaptured || 0} />
              <MiniStat label="All opportunities" value={captureProof?.opportunitiesCreated || 0} />
              <MiniStat label="Research-only" value={captureProof?.counts.is_research_only || 0} />
              <MiniStat label="Real leads" value={captureProof?.realLeadsCreated || 0} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Source quality preview</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Lead quality by source</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">{sourceTrust.keep} keep</Badge>
              <Badge variant="warning">{sourceTrust.tune} tune</Badge>
              <Badge variant="default">{sourceTrust.pause} pause</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {sourcePreview.length === 0 ? (
              <EmptyState
                title="No source quality proof yet."
                body="Once data sources and lead flow are active, this view shows which feeds create verified leads and booked jobs."
              />
            ) : (
              <Table className="border-spacing-y-0">
                <TableHead>
                  <tr>
                    <TH>Source</TH>
                    <TH className="text-right">Signals</TH>
                    <TH className="text-right">Score</TH>
                    <TH className="text-right">Verified leads</TH>
                    <TH className="text-right">Booked jobs</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {sourcePreview.map((source) => (
                    <tr key={`${source.source_id}-${source.source_name}`}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <p className="text-sm font-medium text-semantic-text">{source.source_name}</p>
                        <p className="mt-1 text-xs text-semantic-muted">
                          {source.source_type}{source.authenticity ? ` · ${source.authenticity.replace(/_/g, " ")}` : ""}
                        </p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {source.event_count || 0}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        <Badge variant={source.score >= 75 ? "success" : source.score >= 50 ? "warning" : "default"}>{source.score}</Badge>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-semantic-muted">{source.recommendation}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {source.verified_lead_count}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {source.booked_job_count}
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Connector freshness</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Active source status</h2>
            </div>
            <Badge variant="brand">{sources.length} sources</Badge>
          </CardHeader>
          <CardBody className="space-y-2">
            {sources.length === 0 ? (
              <EmptyState
                title="No active connectors yet."
                body="The network surface still renders, but it will become more convincing once live data sources are activated."
              />
            ) : (
              sources.map((source) => {
                const variant = source.runtimeMode === "fully-live" ? "success" : source.runtimeMode === "live-partial" ? "warning" : "default";
                return (
                  <div key={source.id} className="rounded-lg border border-semantic-border bg-semantic-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-semantic-text">{source.name}</p>
                        <p className="mt-1 text-xs text-semantic-muted">
                          {source.family} · {source.sourceType}
                        </p>
                      </div>
                      <Badge variant={variant}>{source.runtimeMode}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-semantic-muted sm:grid-cols-3">
                      <p>Freshness: {formatPercent(source.freshness)}</p>
                      <p>Latest run: {source.latestRunStatus || "not run"}</p>
                      <p>Records: {source.recordsCreated.toLocaleString()} created</p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-semantic-muted">{source.buyerReadinessNote}</p>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Territory performance</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Where booked work is landing</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {territoryPerformance.length === 0 ? (
              <EmptyState title="No territory performance yet." body="Territory metrics will appear as assignments, accepts, and completions accumulate." />
            ) : (
              <Table className="border-spacing-y-0">
                <TableHead>
                  <tr>
                    <TH>Territory</TH>
                    <TH className="text-right">Assignments</TH>
                    <TH className="text-right">Accepted</TH>
                    <TH className="text-right">Completed</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {territoryPerformance.map((territory) => (
                    <tr key={territory.territory_id}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <p className="text-sm font-medium text-semantic-text">{territory.territory_name}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {territory.assignments}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {territory.accepted}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {territory.completed}
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
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Verified lead proof</p>
                <h2 className="mt-1 text-base font-semibold text-semantic-text">Contactable lead evidence</h2>
              </div>
              <Badge variant="success">{outreachTotal} outreach events</Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Verified" value={verifiedLeadCount} />
                <MiniStat label="Live-provider verified" value={liveProviderVerifiedLeadCount} />
                <MiniStat label="Booked from live-provider" value={bookedFromLiveProviderVerified} />
                <MiniStat label="Contacts" value={franchise?.lead_quality_proof?.contactable_lead_count || 0} />
              </div>
              {proofSamples.length === 0 ? (
                <EmptyState title="No proof samples yet." body="Once verified leads land, the buyer view shows contact, source provenance, and booked-job evidence." />
              ) : (
                proofSamples.slice(0, 3).map((sample) => (
                  <div key={sample.lead_id} className="rounded-lg border border-semantic-border bg-semantic-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-semantic-text">{sample.contact_name}</p>
                        <p className="mt-1 text-xs text-semantic-muted">
                          {sample.source_name} · {sample.service_line}
                          {sample.proof_authenticity ? ` · ${sample.proof_authenticity.replace(/_/g, " ")}` : ""}
                        </p>
                      </div>
                      <Badge variant="brand">{sample.verification_score}</Badge>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-semantic-muted">{sample.proof_summary}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Revenue proof</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Why this can sell to a buyer</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <MetricRow
                label="Attributable revenue"
                value={formatCurrency(revenue)}
                helper="Booked-job revenue only, after synthetic and research-only chains are excluded."
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <MetricRow
                label="Opportunities"
                value={opportunities}
                helper="Live market-pressure opportunities feeding the verified lead workflow."
                icon={<Target className="h-4 w-4" />}
              />
              <MetricRow
                label="Scheduled work"
                value={scheduledWork}
                helper="Scheduled or booked execution tied to qualified, traceable chains."
                icon={<BookOpen className="h-4 w-4" />}
              />
              <MetricRow
                label="Booked jobs"
                value={bookedJobs}
                helper="Booked jobs only, separate from scheduled work and attribution roll-ups."
                icon={<ArrowUpRight className="h-4 w-4" />}
              />
              <MetricRow
                label="Activated contact path"
                value={`${networkActivatedOpportunities} opportunities / ${networkVerifiedLeadCount} verified contacts`}
                helper="Live signals can activate a curated partner and prospect network when homeowner contact data is not available."
                icon={<Building2 className="h-4 w-4" />}
              />
              <MetricRow
                label="Network readiness"
                value={viewModel.demoMode ? "Demo-safe" : "Live-safe"}
                helper="The buyer-facing surface shows live-safe proof rather than placeholder integrations."
                icon={<Globe className="h-4 w-4" />}
              />
              <MetricRow
                label="Proof dropoff"
                value={String(Math.max(0, (captureProof?.realOpportunitiesCaptured || 0) - (captureProof?.realLeadsCreated || 0)))}
                helper="Real opportunities still waiting to become verified leads."
                icon={<BadgeCheck className="h-4 w-4" />}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Franchise roll-up</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Performance by franchise</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {corporate?.byFranchise?.length ? (
              <Table className="border-spacing-y-0">
                <TableHead>
                  <tr>
                    <TH>Franchise</TH>
                    <TH className="text-right">Opportunities</TH>
                    <TH className="text-right">Booked jobs</TH>
                    <TH className="text-right">Booking rate</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {corporate.byFranchise.slice(0, 6).map((row) => (
                    <tr key={row.tenant_id}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 first:rounded-none last:rounded-none">
                        <p className="text-sm font-medium text-semantic-text">{row.franchise}</p>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {row.opportunities}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        {row.booked_jobs}
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-3 text-right first:rounded-none last:rounded-none">
                        <Badge variant={row.booking_rate >= 25 ? "success" : row.booking_rate >= 10 ? "warning" : "default"}>{row.booking_rate}%</Badge>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No franchise roll-up yet." body="Once the network has multiple tenants, this card will show the acquisition story across locations." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Operational proof</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Freshness and routing cadence</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <MiniStat label="Connector runs considered" value={franchise?.freshness?.connector_runs_considered || 0} />
            <MiniStat label="Outreach events considered" value={franchise?.freshness?.outreach_events_considered || 0} />
            <MiniStat label="Source quality preview" value={sourcePreview.length} />
            <p className="text-sm leading-6 text-semantic-muted">
              {viewModel.demoMode
                ? "Demo mode keeps the proof surface readable while preserving the control plane structure buyers will see in production."
                : "This view combines read-model proof with live source freshness so we can show a buyer that the system is producing real leads, not just pretty charts."}
            </p>
          </CardBody>
        </Card>
      </section>
        </>
      )}

    </div>
  );
}

async function loadNetworkViewModel(): Promise<NetworkViewModel> {
  if (isDemoMode()) {
    const dataSources = await listDataSourceSummaries();
    return {
      viewState: "demo",
      demoMode: true,
      franchise: buildDemoFranchiseModel(),
      corporate: buildDemoCorporateModel(),
      dataSources,
      readiness: null
    };
  }

  const context = await getV2TenantContext().catch(() => null);
  if (!context) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources: [],
      readiness: buildEnvironmentReadinessState(
        "No live tenant context is available for buyer-proof reporting.",
        "Sign in with a tenant-mapped live account instead of falling back to demo proof."
      )
    };
  }

  const [dataSources, readinessSummary] = await Promise.all([
    listDataSourceSummaries({
      supabase: context.supabase as never,
      tenantId: context.franchiseTenantId
    }),
    getProductionReadinessSummary({
      supabase: context.supabase
    })
  ]);

  const blockingChecks = readinessSummary.checks.filter(
    (check) =>
      check.required &&
      check.status === "fail" &&
      new Set(["v2_flags", "supabase_rest", "active_territories", "service_area", "active_data_sources", "live_safe_sources"]).has(check.key)
  );

  if (blockingChecks.length > 0) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources,
      readiness: {
        mode: "blocked",
        live: false,
        reason: "Buyer-proof metrics are blocked until tenant readiness and live-safe source prerequisites pass.",
        blockingIssues: blockingChecks.map((check) => ({
          code: check.key === "live_safe_sources" ? "not_live_in_environment" : "live_partial",
          message: check.message,
          detail: check.detail
        })),
        recommendedActions: [
          "Enable SB_USE_V2_READS and SB_USE_V2_WRITES in the live environment.",
          "Configure at least one active, live-safe data source for the tenant.",
          "Set active territories and service area before using the buyer network view."
        ]
      }
    };
  }

  try {
    const [franchise, corporate] = await Promise.all([
      getFranchiseDashboardReadModel({
        supabase: context.supabase,
        franchiseTenantId: context.franchiseTenantId
      }),
      getCorporateDashboardReadModel({
        supabase: context.supabase,
        enterpriseTenantId: context.enterpriseTenantId
      })
    ]);

    return {
      viewState: "live",
      demoMode: false,
      franchise,
      corporate,
      dataSources,
      readiness: null
    };
  } catch (error) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources,
      readiness: {
        mode: "blocked",
        live: false,
        reason: "Buyer-proof read models could not be loaded from the live environment.",
        blockingIssues: [
          {
            code: "not_live_in_environment",
            message: error instanceof Error ? error.message : "Live buyer-proof read models are unavailable."
          }
        ],
        recommendedActions: ["Restore live read-model access before using this buyer-facing surface."]
      }
    };
  }
}

function pickMetric(metrics: Array<{ label: string; value: number }>, label: string) {
  return metrics.find((metric) => metric.label === label)?.value || 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function buildDemoFranchiseModel(): FranchiseReadModel {
  return {
    intelligence: {
      source_quality_preview: [
        {
          source_id: "demo-weather",
          source_name: "NOAA Weather Alerts",
          source_type: "weather",
          score: 88,
          recommendation: "keep",
          verified_lead_count: 18,
          booked_job_count: 6
        },
        {
          source_id: "demo-permits",
          source_name: "Building Permits",
          source_type: "permits",
          score: 73,
          recommendation: "tune",
          verified_lead_count: 11,
          booked_job_count: 4
        },
        {
          source_id: "demo-open311",
          source_name: "Open311 Service Requests",
          source_type: "open311",
          score: 69,
          recommendation: "tune",
          verified_lead_count: 8,
          booked_job_count: 3
        },
        {
          source_id: "demo-water",
          source_name: "USGS Water Data",
          source_type: "usgs_water",
          score: 79,
          recommendation: "keep",
          verified_lead_count: 6,
          booked_job_count: 2
        }
      ],
      source_trust_summary: {
        keep: 4,
        tune: 3,
        pause: 2
      }
    },
    lead_quality_proof: {
      verified_lead_count: 43,
      network_verified_lead_count: 22,
      booked_jobs_from_verified_leads: 15,
      booked_jobs_from_network_leads: 7,
      network_activated_opportunity_count: 18,
      network_outreach_event_count: 31,
      contactable_lead_count: 57,
      proof_samples: [
        {
          lead_id: "lead-1",
          contact_name: "Kelly Mora",
          source_name: "NOAA Weather Alerts",
          service_line: "water mitigation",
          verification_score: 91,
          proof_summary: "Storm-triggered homeowner lead verified by phone and booked into a same-day mitigation job."
        },
        {
          lead_id: "lead-2",
          contact_name: "Armand Lewis",
          source_name: "Building Permits",
          service_line: "roof leak response",
          verification_score: 82,
          proof_summary: "Permit signal matched contact data and converted into an inspection booking within 24 hours."
        },
        {
          lead_id: "lead-3",
          contact_name: "Dana Ortiz",
          source_name: "Open311 Service Requests",
          service_line: "sewage cleanup",
          verification_score: 78,
          proof_summary: "Municipal complaint plus enrichment produced a contactable lead that became scheduled work."
        }
      ]
    },
    outreach_activity: {
      total: 126
    },
    territory_performance: [
      { territory_id: "territory-1", territory_name: "Suffolk West", assignments: 23, accepted: 19, completed: 12 },
      { territory_id: "territory-2", territory_name: "Suffolk East", assignments: 18, accepted: 15, completed: 9 },
      { territory_id: "territory-3", territory_name: "Nassau Core", assignments: 14, accepted: 11, completed: 7 }
    ],
    freshness: {
      connector_runs_considered: 18,
      outreach_events_considered: 126
    }
  };
}

function buildDemoCorporateModel(): CorporateReadModel {
  return {
    metrics: [
      { label: "estimated_revenue", value: 312000 },
      { label: "opportunity_volume", value: 186 },
      { label: "booked_jobs", value: 41 }
    ],
    byFranchise: [
      { tenant_id: "fr-1", franchise: "Long Island North", opportunities: 72, booked_jobs: 18, booking_rate: 25 },
      { tenant_id: "fr-2", franchise: "Long Island South", opportunities: 61, booked_jobs: 14, booking_rate: 23 },
      { tenant_id: "fr-3", franchise: "Queens Pilot", opportunities: 53, booked_jobs: 9, booking_rate: 17 }
    ]
  };
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-semantic-border bg-semantic-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-semantic-text">{value}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  helper,
  icon
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-semantic-border bg-semantic-surface px-4 py-3">
      <div className="rounded-md bg-brand-100 p-2 text-brand-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-semantic-text">{label}</p>
        <p className="mt-1 text-lg font-semibold text-semantic-text">{value}</p>
        <p className="mt-1 text-xs leading-5 text-semantic-muted">{helper}</p>
      </div>
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
