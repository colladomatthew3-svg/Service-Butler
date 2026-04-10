"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, TriangleAlert, Phone, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TH, TD, TableHead } from "@/components/ui/table";

type DispatchableLeadRow = {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  source_type: string | null;
  service_signal: string | null;
  timestamp: string | null;
  age_hours: number | null;
  confidence_score: number;
  trust_status: string;
  verification_status: string | null;
  contact_provenance: string | null;
  contact_attachment_status: string | null;
  contact_grounded_reason: string | null;
  dispatch_eligible: boolean;
  blocked_reason: string | null;
};

type DispatchableLeadResponse = {
  leads: DispatchableLeadRow[];
  summary: {
    dispatchable_count: number;
    blocked_count: number;
    recent_real_candidate_count: number;
    live_ingestion_paths: string[];
  };
  warning?: string;
  error?: string;
};

function formatTimestamp(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function DispatchableLeadsView() {
  const [data, setData] = useState<DispatchableLeadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDispatchableLeads() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dispatchable-leads", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as DispatchableLeadResponse;
      if (!response.ok) throw new Error(payload.error || "Could not load dispatchable leads");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dispatchable leads");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDispatchableLeads();
  }, []);

  const leads = data?.leads || [];
  const dispatchable = leads.filter((lead) => lead.dispatch_eligible);
  const blocked = leads.filter((lead) => !lead.dispatch_eligible).slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator"
        title="Dispatchable Leads"
        subtitle="Real, recent leads with enough trust and contact context to work right now."
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadDispatchableLeads()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Dispatchable now" value={String(data?.summary.dispatchable_count || 0)} icon={<ShieldCheck className="h-4 w-4" />} tone="success" />
        <StatTile label="Blocked recent candidates" value={String(data?.summary.blocked_count || 0)} icon={<TriangleAlert className="h-4 w-4" />} tone="warning" />
        <StatTile label="Recent real candidates" value={String(data?.summary.recent_real_candidate_count || 0)} icon={<Clock3 className="h-4 w-4" />} tone="brand" />
        <StatTile label="Live ingestion paths" value={String(data?.summary.live_ingestion_paths.length || 0)} icon={<Phone className="h-4 w-4" />} />
      </section>

      {data?.warning ? (
        <Card>
          <CardBody className="py-4 text-sm text-semantic-muted">{data.warning}</CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Ready queue</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Leads operators can act on immediately</h2>
          </div>
          <Badge variant="success">{dispatchable.length} shown</Badge>
        </CardHeader>
        <CardBody>
          {error ? (
            <p className="text-sm text-semantic-muted">{error}</p>
          ) : dispatchable.length === 0 && !loading ? (
            <p className="text-sm text-semantic-muted">No dispatchable leads are available yet. Check blocked candidates below to see what is still missing.</p>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TH>Name / business</TH>
                  <TH>Phone</TH>
                  <TH>Location</TH>
                  <TH>Source</TH>
                  <TH>Service signal</TH>
                  <TH>Recency</TH>
                  <TH>Trust</TH>
                </tr>
              </TableHead>
              <TableBody>
                {dispatchable.map((lead) => (
                  <tr key={lead.id}>
                    <TD>{lead.business_name}</TD>
                    <TD>{lead.phone || lead.email || "No contact"}</TD>
                    <TD>{lead.location || "Unknown"}</TD>
                    <TD>{lead.source || lead.source_type || "Unknown"}</TD>
                    <TD>{lead.service_signal || "Unknown"}</TD>
                    <TD>{lead.age_hours != null ? `${lead.age_hours}h ago` : formatTimestamp(lead.timestamp)}</TD>
                    <TD>
                      <div className="space-y-1">
                        <Badge variant="success">{lead.verification_status || "verified"}</Badge>
                        <div className="text-xs text-semantic-muted">{lead.trust_status}</div>
                        {lead.contact_provenance ? <div className="text-xs text-semantic-muted">Contact proof: {lead.contact_provenance}</div> : null}
                        {lead.contact_grounded_reason ? <div className="text-xs text-semantic-muted">{lead.contact_grounded_reason}</div> : null}
                      </div>
                    </TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Blocked queue</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Recent real candidates that still need work</h2>
          </div>
          <Badge variant="warning">{blocked.length} shown</Badge>
        </CardHeader>
        <CardBody>
          {blocked.length === 0 && !loading ? (
            <p className="text-sm text-semantic-muted">No blocked recent candidates right now.</p>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TH>Name / business</TH>
                  <TH>Source</TH>
                  <TH>Service signal</TH>
                  <TH>Recency</TH>
                  <TH>Contact state</TH>
                  <TH>Blocked reason</TH>
                </tr>
              </TableHead>
              <TableBody>
                {blocked.map((lead) => (
                  <tr key={lead.id}>
                    <TD>{lead.business_name}</TD>
                    <TD>{lead.source || lead.source_type || "Unknown"}</TD>
                    <TD>{lead.service_signal || "Unknown"}</TD>
                    <TD>{lead.age_hours != null ? `${lead.age_hours}h ago` : formatTimestamp(lead.timestamp)}</TD>
                    <TD>
                      <div className="space-y-1">
                        <div>{lead.contact_attachment_status || "unknown"}</div>
                        {lead.contact_provenance ? <div className="text-xs text-semantic-muted">{lead.contact_provenance}</div> : null}
                      </div>
                    </TD>
                    <TD>
                      <div className="space-y-1">
                        <div>{lead.blocked_reason || "Needs review"}</div>
                        {lead.contact_grounded_reason ? <div className="text-xs text-semantic-muted">{lead.contact_grounded_reason}</div> : null}
                      </div>
                    </TD>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
