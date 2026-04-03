"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radio, RefreshCw, ShieldCheck, Target, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableBody, TableHead, TD, TH } from "@/components/ui/table";
import { classifySourceLane, opportunityPriorityScore, type SourceLaneKey } from "@/lib/v2/source-lanes";

export type Opportunity = {
  id: string;
  category?: string | null;
  service_line?: string | null;
  title?: string | null;
  description?: string | null;
  location_text?: string | null;
  zip?: string | null;
  intent_score?: number | null;
  confidence?: number | null;
  urgency_score?: number | null;
  signal_count?: number | null;
  source_types?: string[];
  confidence_reasoning?: string | null;
  estimated_response_window?: string | null;
  distress_context_summary?: string | null;
  qualification_status?: "research_only" | "queued_for_sdr" | "qualified_contactable" | "rejected" | null;
  qualification_reason_code?: string | null;
  proof_authenticity?: "live_provider" | "live_derived" | "synthetic" | "unknown" | null;
  source_lane?: SourceLaneKey | null;
  priority_score?: number | null;
  next_recommended_action?: string | null;
  research_only?: boolean;
  requires_sdr_qualification?: boolean;
  counts_as_real_capture?: boolean;
  counts_as_real_lead?: boolean;
  created_at: string;
};
type SourceLaneFilter = "all" | SourceLaneKey;

const sourceLaneOrder: SourceLaneFilter[] = ["all", "311", "flood", "fire", "outage", "weather", "permits", "property", "social", "other"];

const sourceLaneLabel: Record<SourceLaneFilter, string> = {
  all: "All signals",
  "311": "311 & municipal",
  flood: "Flood & water",
  fire: "Fire & emergency",
  outage: "Outage & utility",
  weather: "Weather",
  permits: "Permits",
  property: "Property",
  social: "Distress",
  other: "Other"
};

export function OpportunitiesView() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceLaneFilter>("all");
  const [qualificationFilter, setQualificationFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function loadOpportunities() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/opportunities?limit=120", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; opportunities?: Opportunity[] };
      if (!res.ok) throw new Error(data.error || "Could not load opportunities");
      setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load opportunities");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOpportunities();
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredOpportunities = opportunities
    .filter((item) => {
      if (sourceFilter !== "all" && getSourceLane(item) !== sourceFilter) return false;
      if (qualificationFilter !== "all" && getQualificationBucket(item) !== qualificationFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        item.title,
        item.location_text,
        item.category,
        item.service_line,
        item.distress_context_summary,
        item.confidence_reasoning,
        ...(item.source_types || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .sort((left, right) => {
      const rightPriority = getPriorityScore(right);
      const leftPriority = getPriorityScore(left);
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

  const contactReadyCount = opportunities.filter((item) => item.qualification_status === "qualified_contactable").length;
  const highUrgencyCount = opportunities.filter((item) => getPriorityScore(item) >= 70).length;
  const needsSdrCount = opportunities.filter((item) => getQualificationBucket(item) === "needs_sdr").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Opportunities"
        subtitle="Work the 311, flood, fire, outage, weather, and permit opportunities that can become real jobs after verification."
        actions={
          <>
            <Link href="/dashboard/scanner" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open scanner
            </Link>
            <Link href="/dashboard/scanner?queue=sdr" className={buttonStyles({ size: "sm", variant: "secondary" })}>
              Open SDR lane
            </Link>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active opportunities" value={String(opportunities.length)} icon={<Target className="h-4 w-4" />} tone="brand" />
        <StatTile label="High urgency" value={String(highUrgencyCount)} icon={<TriangleAlert className="h-4 w-4" />} tone="warning" />
        <StatTile label="Contact ready" value={String(contactReadyCount)} icon={<ShieldCheck className="h-4 w-4" />} tone="success" />
        <StatTile label="Needs SDR" value={String(needsSdrCount)} icon={<Radio className="h-4 w-4" />} />
      </section>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Signal lanes</p>
              <h2 className="mt-1 text-base font-semibold text-semantic-text">Source-driven opportunities</h2>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadOpportunities()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceLaneOrder.map((lane) => {
              const count =
                lane === "all" ? opportunities.length : opportunities.filter((item) => getSourceLane(item) === lane).length;
              const active = sourceFilter === lane;
              return (
                <button
                  key={lane}
                  type="button"
                  className={buttonStyles({ size: "sm", variant: active ? "primary" : "secondary" })}
                  onClick={() => setSourceFilter(lane)}
                >
                  {sourceLaneLabel[lane]}
                  <span className="rounded-full bg-black/8 px-2 py-0.5 text-[11px] font-semibold text-current/80">{count}</span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_220px_180px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, market, or signal type"
            aria-label="Search opportunities"
          />
          <Select value={qualificationFilter} onChange={(event) => setQualificationFilter(event.target.value)} aria-label="Filter by qualification">
            <option value="all">All qualification states</option>
            <option value="contact_ready">Contact ready</option>
            <option value="needs_sdr">Needs SDR</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setSourceFilter("all");
              setQualificationFilter("all");
            }}
          >
            Clear filters
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Work queue</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Opportunities ranked for action</h2>
          </div>
          <Badge variant="default">{filteredOpportunities.length} shown</Badge>
        </CardHeader>
        <CardBody>
          {error ? (
            <EmptyState
              title="Opportunities could not load."
              body={error}
              actionHref="/dashboard/scanner"
              actionLabel="Open scanner"
            />
          ) : loading ? (
            <p className="text-sm text-semantic-muted">Loading opportunities...</p>
          ) : filteredOpportunities.length === 0 ? (
            <EmptyState
              title="No opportunities match the current filters."
              body="Run the scanner or widen the source and qualification filters to see more market-pressure opportunities."
              actionHref="/dashboard/scanner"
              actionLabel="Run scanner"
            />
          ) : (
            <Table className="border-spacing-y-0">
              <TableHead>
                <tr>
                  <TH>Opportunity</TH>
                  <TH>Signal</TH>
                  <TH>Qualification</TH>
                  <TH className="text-right">Next step</TH>
                </tr>
              </TableHead>
              <TableBody>
                {filteredOpportunities.map((item) => {
                  const action = getPrimaryAction(item);
                  const sourceLane = getSourceLane(item);
                  const summary = item.distress_context_summary || item.confidence_reasoning || item.description || "Source-backed demand signal.";
                  const sourceBadges = getSourceBadges(item);
                  return (
                    <tr key={item.id}>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-4 first:rounded-none last:rounded-none">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-semantic-text">{item.title || "Untitled opportunity"}</p>
                          <p className="mt-1 text-sm text-semantic-muted">{item.location_text || "Core market"}</p>
                          <p className="mt-2 max-w-xl text-xs leading-5 text-semantic-muted">{summary}</p>
                        </div>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-4 first:rounded-none last:rounded-none">
                        <div className="space-y-2">
                          <Badge variant="brand">{sourceLaneLabel[sourceLane]}</Badge>
                          <div className="flex flex-wrap gap-1.5">
                            {sourceBadges.map((badge) => (
                              <Badge key={`${item.id}-${badge}`} variant="default">
                                {badge}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-semantic-muted">
                            {formatRelativeTime(item.created_at)}
                            {item.signal_count ? ` · ${item.signal_count} corroborating signals` : ""}
                          </p>
                        </div>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-4 first:rounded-none last:rounded-none">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={qualificationBadgeVariant(item)}>
                              {qualificationLabel(item)}
                            </Badge>
                            <Badge variant={proofBadgeVariant(item.proof_authenticity)}>
                              {formatProofAuthenticity(item.proof_authenticity)}
                            </Badge>
                          </div>
                          <p className="text-xs text-semantic-text">
                            Priority {formatPercent(getPriorityScore(item))} · Urgency {formatPercent(item.urgency_score)}
                          </p>
                          <p className="text-xs text-semantic-muted">
                            {(item.next_recommended_action || "review_signal").replace(/_/g, " ")}
                            {item.qualification_reason_code ? ` · ${item.qualification_reason_code.replace(/_/g, " ")}` : ""}
                          </p>
                        </div>
                      </TD>
                      <TD className="border-b border-semantic-border/70 bg-transparent px-0 py-4 text-right first:rounded-none last:rounded-none">
                        <div className="flex flex-col items-end gap-2">
                          <Link href={action.href} className={buttonStyles({ size: "sm", variant: action.variant })}>
                            {action.label}
                          </Link>
                          <p className="max-w-[12rem] text-right text-xs leading-5 text-semantic-muted">{action.note}</p>
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionHref,
  actionLabel
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-semantic-border bg-semantic-surface px-5 py-6">
      <p className="text-base font-semibold text-semantic-text">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-semantic-muted">{body}</p>
      <Link href={actionHref} className={`${buttonStyles({ size: "sm", variant: "secondary" })} mt-4`}>
        {actionLabel}
      </Link>
    </div>
  );
}

function getQualificationBucket(item: Opportunity) {
  if (item.qualification_status === "qualified_contactable") return "contact_ready";
  if (item.qualification_status === "rejected") return "rejected";
  if (item.requires_sdr_qualification || item.research_only || item.qualification_status === "queued_for_sdr" || item.qualification_status === "research_only") {
    return "needs_sdr";
  }
  return "all";
}

function qualificationLabel(item: Opportunity) {
  if (item.qualification_status === "qualified_contactable") return "Qualified contactable";
  if (item.qualification_status === "queued_for_sdr") return "Queued for SDR";
  if (item.qualification_status === "rejected") return "Rejected";
  return "Research only";
}

function qualificationBadgeVariant(item: Opportunity): "default" | "success" | "warning" | "danger" | "brand" {
  if (item.qualification_status === "qualified_contactable") return "success";
  if (item.qualification_status === "queued_for_sdr") return "warning";
  if (item.qualification_status === "rejected") return "danger";
  return "default";
}

function proofBadgeVariant(value: Opportunity["proof_authenticity"]): "default" | "success" | "warning" | "danger" | "brand" {
  if (value === "live_provider") return "success";
  if (value === "live_derived") return "brand";
  if (value === "synthetic") return "warning";
  return "default";
}

function formatProofAuthenticity(value: Opportunity["proof_authenticity"]) {
  if (!value) return "Unknown proof";
  return value.replace(/_/g, " ");
}

function formatPercent(value: number | null | undefined) {
  return `${Math.max(0, Math.round(Number(value || 0)))}%`;
}

function formatRelativeTime(value: string) {
  const target = new Date(value);
  if (!Number.isFinite(target.getTime())) return "No timestamp";

  const delta = Date.now() - target.getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function scannerOpportunityHref(item: Opportunity, queue?: "sdr") {
  const params = new URLSearchParams();
  if (queue) params.set("queue", queue);
  params.set("opportunity", item.id);
  return `/dashboard/scanner?${params.toString()}`;
}

export function getPrimaryAction(item: Opportunity) {
  if (item.qualification_status === "qualified_contactable") {
    return {
      href: `/dashboard/outbound?opportunity=${encodeURIComponent(item.id)}`,
      label: "Launch buyer flow",
      variant: "primary" as const,
      note: "This opportunity has verified contact and can move into outbound or verified lead creation."
    };
  }

  if (item.qualification_status === "queued_for_sdr") {
    return {
      href: scannerOpportunityHref(item, "sdr"),
      label: "Review in SDR lane",
      variant: "secondary" as const,
      note: "Finish contact verification before this turns into a lead or job."
    };
  }

  if (item.research_only || item.requires_sdr_qualification || item.qualification_status === "research_only") {
    return {
      href: scannerOpportunityHref(item, "sdr"),
      label: "Send to SDR",
      variant: "secondary" as const,
      note: "Public-source opportunities stay research-only until SDR verifies a real contact path."
    };
  }

  return {
    href: scannerOpportunityHref(item),
    label: "Open scanner",
    variant: "secondary" as const,
    note: "Review the opportunity, confirm fit, and decide whether it belongs in the SDR lane."
  };
}

export function getSourceLane(item: Opportunity): SourceLaneKey {
  if (item.source_lane) return item.source_lane;
  return classifySourceLane({
    sourceTypes: item.source_types,
    category: item.category,
    serviceLine: item.service_line,
    summary: item.distress_context_summary,
    reasoning: item.confidence_reasoning
  });
}

function getPriorityScore(item: Opportunity) {
  if (Number.isFinite(Number(item.priority_score))) return Number(item.priority_score);
  return opportunityPriorityScore({
    urgencyScore: item.urgency_score,
    jobLikelihoodScore: item.intent_score,
    sourceReliabilityScore: item.confidence
  });
}

function getSourceBadges(item: Opportunity) {
  const sourceTypes = item.source_types && item.source_types.length > 0 ? item.source_types : [item.category || item.service_line || "signal"];
  return sourceTypes.slice(0, 3).map((value) =>
    String(value)
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}
