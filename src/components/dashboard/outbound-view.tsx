"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, RefreshCw, Send, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableHead, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Prospect = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  territory?: string | null;
  prospect_type: string;
  priority_tier?: string;
  strategic_value?: number;
  near_active_incident?: boolean;
  source?: string;
};

type ReferralPartner = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  territory?: string | null;
  partner_type: string;
  priority_tier?: string;
  strategic_value?: number;
  near_active_incident?: boolean;
  source?: string;
};

type OutboundList = {
  id: string;
  name: string;
  list_type: string;
  territory?: string | null;
  source_trigger?: string | null;
  campaign_name?: string | null;
  smartlead_campaign_id?: string | null;
  export_status: string;
  member_count?: number;
  created_at: string;
};

type Opportunity = {
  id: string;
  category?: string | null;
  service_line?: string | null;
  title?: string | null;
  location_text?: string | null;
  city?: string | null;
  state?: string | null;
  territory?: string | null;
  confidence?: number | null;
  urgency_score?: number | null;
  signal_count?: number | null;
  source_types?: string[];
  confidence_reasoning?: string | null;
  estimated_response_window?: string | null;
  distress_context_summary?: string | null;
  raw?: Record<string, unknown>;
  created_at: string;
};

const segmentOptions = [
  "property_manager",
  "multifamily_operator",
  "commercial_owner",
  "hoa",
  "facilities_manager",
  "insurance_agent",
  "public_adjuster",
  "plumber",
  "roofer",
  "hvac_contractor",
  "broker_agent",
  "inspector"
];

function segmentLabel(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OutboundView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>([]);
  const [outboundLists, setOutboundLists] = useState<OutboundList[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const [prospectForm, setProspectForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    city: "",
    state: "NY",
    territory: "",
    prospect_type: "property_manager"
  });
  const [partnerForm, setPartnerForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    city: "",
    state: "NY",
    territory: "",
    partner_type: "insurance_agent"
  });
  const [listForm, setListForm] = useState({
    name: "",
    listType: "prospect",
    territory: "",
    segmentType: "property_manager",
    campaignName: "",
    smartleadCampaignId: "",
    nearIncident: "all"
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prospectsRes, partnersRes, listsRes, opportunitiesRes] = await Promise.all([
        fetch("/api/prospects"),
        fetch("/api/referral-partners"),
        fetch("/api/outbound-lists"),
        fetch("/api/opportunities?limit=8")
      ]);

      const [prospectsData, partnersData, listsData, opportunitiesData] = await Promise.all([
        prospectsRes.json().catch(() => ({})),
        partnersRes.json().catch(() => ({})),
        listsRes.json().catch(() => ({})),
        opportunitiesRes.json().catch(() => ({}))
      ]);

      if (!prospectsRes.ok || !partnersRes.ok || !listsRes.ok || !opportunitiesRes.ok) {
        showToast("Could not load outbound workspace");
        return;
      }

      setProspects(prospectsData.prospects || []);
      setReferralPartners(partnersData.referralPartners || []);
      setOutboundLists(listsData.outboundLists || []);
      setOpportunities(opportunitiesData.opportunities || []);
    } catch {
      showToast("Could not load outbound workspace");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const stats = useMemo(
    () => ({
      prospects: prospects.length,
      referralPartners: referralPartners.length,
      outboundLists: outboundLists.length,
      triggered: outboundLists.filter((item) => item.list_type === "incident_triggered").length
    }),
    [prospects, referralPartners, outboundLists]
  );

  async function createProspect() {
    setSubmitting(true);
    const res = await fetch("/api/prospects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prospectForm)
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      showToast(data.error || "Could not add prospect");
      return;
    }
    setProspectForm({
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      city: "",
      state: "NY",
      territory: "",
      prospect_type: "property_manager"
    });
    showToast("Prospect added");
    loadAll();
  }

  async function createPartner() {
    setSubmitting(true);
    const res = await fetch("/api/referral-partners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(partnerForm)
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      showToast(data.error || "Could not add referral partner");
      return;
    }
    setPartnerForm({
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      city: "",
      state: "NY",
      territory: "",
      partner_type: "insurance_agent"
    });
    showToast("Referral partner added");
    loadAll();
  }

  async function createList() {
    setSubmitting(true);
    const res = await fetch("/api/outbound-lists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: listForm.name || `${segmentLabel(listForm.segmentType)} - ${listForm.territory || "territory"} outreach`,
        listType: listForm.listType,
        territory: listForm.territory || null,
        campaignName: listForm.campaignName || null,
        smartleadCampaignId: listForm.smartleadCampaignId || null,
        segmentTypes: [listForm.segmentType],
        nearIncident: listForm.nearIncident === "all" ? null : listForm.nearIncident === "yes"
      })
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      showToast(data.error || "Could not create outbound list");
      return;
    }
    showToast("Outbound list created");
    loadAll();
  }

  async function createTriggeredList(opportunityId: string) {
    setTriggeringId(opportunityId);
    const res = await fetch(`/api/opportunities/${opportunityId}/outbound-list`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setTriggeringId(null);
    if (!res.ok) {
      showToast(data.error || "Could not generate incident-triggered list");
      return;
    }
    showToast("Incident-triggered list created");
    loadAll();
  }

  async function syncList(listId: string, campaignId?: string | null) {
    setSyncingId(listId);
    const res = await fetch(`/api/outbound-lists/${listId}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ smartleadCampaignId: campaignId || null })
    });
    const data = await res.json().catch(() => ({}));
    setSyncingId(null);
    if (!res.ok) {
      showToast(data.error || "Smartlead sync failed");
      return;
    }
    showToast(data.fallback ? "Smartlead not configured; CSV fallback is ready." : "List pushed to Smartlead");
    loadAll();
  }

  function exportList(listId: string) {
    window.location.href = `/api/outbound-lists/${listId}/export`;
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      showToast("No valid rows in CSV");
      return;
    }

    const res = await fetch("/api/outbound/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || "Import failed");
      return;
    }
    showToast(`Imported ${rows.length} prospect rows`);
    loadAll();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound Engine"
        subtitle="Build target lists by territory, work referral relationships, and push incident-triggered outreach into Smartlead."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleCsvUpload(file);
              }}
            />
            <Button size="lg" variant="secondary" onClick={() => csvInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button size="lg" variant="secondary" onClick={() => loadAll()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 rounded-[2rem] border border-brand-500/20 bg-[linear-gradient(120deg,rgba(216,239,229,0.88),rgba(255,255,255,0.95))] px-5 py-5 shadow-[0_18px_48px_rgba(25,112,77,0.1)] sm:grid-cols-[1.2fr_0.8fr] lg:px-6">
        <div className="space-y-3">
          <p className="inline-flex items-center rounded-full border border-brand-500/25 bg-white/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
            Outbound Workspace
          </p>
          <p className="text-sm text-semantic-text">
            Use this space to build lists, maintain referral relationships, and push incident-triggered outreach without losing the operational thread.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <MiniStat label="Prospects" value={stats.prospects} />
          <MiniStat label="Lists" value={stats.outboundLists} />
          <MiniStat label="Partners" value={stats.referralPartners} />
          <MiniStat label="Triggered" value={stats.triggered} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-semantic-border/55 bg-white/58">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h2 className="dashboard-section-title text-semantic-text">Recent Opportunities To Work</h2>
              <span className="hidden rounded-full border border-semantic-border/70 bg-white/75 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-semantic-muted sm:inline-flex">
                Source stream
              </span>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              <p className="text-sm text-semantic-muted">Loading opportunities...</p>
            ) : opportunities.length === 0 ? (
              <p className="text-sm text-semantic-muted">Run the scanner to create incident-driven outbound opportunities.</p>
            ) : (
              opportunities.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.2rem] border border-semantic-border/60 bg-white/74 p-4 shadow-[0_12px_26px_rgba(31,42,36,0.07)]"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="mt-1 h-12 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,rgb(var(--brand)),rgb(var(--accent)))]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{item.category || "opportunity"}</p>
                          <h3 className="mt-1 text-base font-semibold text-semantic-text">{item.title || "Opportunity"}</h3>
                          <p className="mt-1 text-sm text-semantic-muted">
                            {item.location_text || [item.city, item.state].filter(Boolean).join(", ") || item.territory || "Service area"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default">Confidence {item.confidence || 0}</Badge>
                          <Badge variant={(item.urgency_score || 0) >= 70 ? "warning" : "default"}>Urgency {item.urgency_score || 0}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="default">{humanizeToken(item.service_line || item.category || "general")}</Badge>
                        {item.signal_count && item.signal_count > 1 ? <Badge variant="brand">{item.signal_count} signals agree</Badge> : null}
                        {item.estimated_response_window ? <Badge variant="warning">Respond {item.estimated_response_window}</Badge> : null}
                        {sourceTypeSummary(item).map((source) => (
                          <Badge key={`${item.id}-${source}`} variant="default">
                            {humanizeToken(source)}
                          </Badge>
                        ))}
                      </div>
                      {(item.distress_context_summary || item.confidence_reasoning) && (
                        <div className="mt-3 rounded-[1rem] border border-semantic-border/60 bg-white/72 px-4 py-3">
                          {item.distress_context_summary ? (
                            <p className="text-sm text-semantic-text">
                              <span className="font-semibold">Context:</span> {item.distress_context_summary}
                            </p>
                          ) : null}
                          {item.confidence_reasoning ? (
                            <p className="mt-1 text-xs text-semantic-muted">
                              <span className="font-semibold text-semantic-text">Why now:</span> {formatConfidenceReasoning(item.confidence_reasoning)}
                            </p>
                          ) : null}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => createTriggeredList(item.id)} disabled={triggeringId === item.id}>
                          <Plus className="h-4 w-4" />
                          {triggeringId === item.id ? "Generating..." : "Generate Triggered List"}
                        </Button>
                        <Badge variant="default">{String(item.raw?.source || item.raw?.signal_source || "scanner")}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card className="border-semantic-border/55 bg-white/58">
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Build New Outbound List</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <Input placeholder="List name" value={listForm.name} onChange={(event) => setListForm((prev) => ({ ...prev, name: event.target.value }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={listForm.listType}
                onChange={(event) => setListForm((prev) => ({ ...prev, listType: event.target.value }))}
              >
                <option value="prospect">Prospect List</option>
                <option value="referral_partner">Referral Partner List</option>
                <option value="incident_triggered">Incident Triggered</option>
              </Select>
              <Select
                value={listForm.segmentType}
                onChange={(event) => setListForm((prev) => ({ ...prev, segmentType: event.target.value }))}
              >
                {segmentOptions.map((segment) => (
                  <option key={segment} value={segment}>{segmentLabel(segment)}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Territory (e.g. Nassau County, NY)"
                value={listForm.territory}
                onChange={(event) => setListForm((prev) => ({ ...prev, territory: event.target.value }))}
              />
              <Select
                value={listForm.nearIncident}
                onChange={(event) => setListForm((prev) => ({ ...prev, nearIncident: event.target.value }))}
              >
                <option value="all">All records</option>
                <option value="yes">Near active incident only</option>
                <option value="no">Exclude incident-linked</option>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Smartlead campaign name"
                value={listForm.campaignName}
                onChange={(event) => setListForm((prev) => ({ ...prev, campaignName: event.target.value }))}
              />
              <Input
                placeholder="Smartlead campaign ID (optional)"
                value={listForm.smartleadCampaignId}
                onChange={(event) => setListForm((prev) => ({ ...prev, smartleadCampaignId: event.target.value }))}
              />
            </div>
            <Button onClick={createList} disabled={submitting}>
              <Plus className="h-4 w-4" />
              Create Outbound List
            </Button>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-semantic-border/55 bg-white/58">
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Prospects</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Company name" value={prospectForm.company_name} onChange={(event) => setProspectForm((prev) => ({ ...prev, company_name: event.target.value }))} />
              <Input placeholder="Contact name" value={prospectForm.contact_name} onChange={(event) => setProspectForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
              <Input placeholder="Email" value={prospectForm.email} onChange={(event) => setProspectForm((prev) => ({ ...prev, email: event.target.value }))} />
              <Input placeholder="Phone" value={prospectForm.phone} onChange={(event) => setProspectForm((prev) => ({ ...prev, phone: event.target.value }))} />
              <Input placeholder="City" value={prospectForm.city} onChange={(event) => setProspectForm((prev) => ({ ...prev, city: event.target.value }))} />
              <Input placeholder="Territory" value={prospectForm.territory} onChange={(event) => setProspectForm((prev) => ({ ...prev, territory: event.target.value }))} />
              <Select
                value={prospectForm.prospect_type}
                onChange={(event) => setProspectForm((prev) => ({ ...prev, prospect_type: event.target.value }))}
              >
                {segmentOptions.map((segment) => (
                  <option key={segment} value={segment}>{segmentLabel(segment)}</option>
                ))}
              </Select>
              <Button onClick={createProspect} disabled={submitting}>
                <Plus className="h-4 w-4" />
                Add Prospect
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TH>Company</TH>
                    <TH>Segment</TH>
                    <TH>Territory</TH>
                    <TH>Contact</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {prospects.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <TD>
                        <div>
                          <p className="font-medium">{row.company_name}</p>
                          <p className="text-xs text-semantic-muted">{row.source || "manual"}</p>
                        </div>
                      </TD>
                      <TD>{segmentLabel(row.prospect_type)}</TD>
                      <TD>{row.territory || [row.city, row.state].filter(Boolean).join(", ") || "-"}</TD>
                      <TD>{row.contact_name || row.email || row.phone || "-"}</TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Referral Partners</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Company name" value={partnerForm.company_name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, company_name: event.target.value }))} />
              <Input placeholder="Contact name" value={partnerForm.contact_name} onChange={(event) => setPartnerForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
              <Input placeholder="Email" value={partnerForm.email} onChange={(event) => setPartnerForm((prev) => ({ ...prev, email: event.target.value }))} />
              <Input placeholder="Phone" value={partnerForm.phone} onChange={(event) => setPartnerForm((prev) => ({ ...prev, phone: event.target.value }))} />
              <Input placeholder="City" value={partnerForm.city} onChange={(event) => setPartnerForm((prev) => ({ ...prev, city: event.target.value }))} />
              <Input placeholder="Territory" value={partnerForm.territory} onChange={(event) => setPartnerForm((prev) => ({ ...prev, territory: event.target.value }))} />
              <Select
                value={partnerForm.partner_type}
                onChange={(event) => setPartnerForm((prev) => ({ ...prev, partner_type: event.target.value }))}
              >
                {segmentOptions.map((segment) => (
                  <option key={segment} value={segment}>{segmentLabel(segment)}</option>
                ))}
              </Select>
              <Button onClick={createPartner} disabled={submitting}>
                <Plus className="h-4 w-4" />
                Add Partner
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TH>Company</TH>
                    <TH>Type</TH>
                    <TH>Territory</TH>
                    <TH>Contact</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {referralPartners.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <TD>
                        <div>
                          <p className="font-medium">{row.company_name}</p>
                          <p className="text-xs text-semantic-muted">{row.source || "manual"}</p>
                        </div>
                      </TD>
                      <TD>{segmentLabel(row.partner_type)}</TD>
                      <TD>{row.territory || [row.city, row.state].filter(Boolean).join(", ") || "-"}</TD>
                      <TD>{row.contact_name || row.email || row.phone || "-"}</TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      </section>

      <Card className="border-semantic-border/55 bg-white/58">
        <CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Outbound Lists</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-sm text-semantic-muted">Loading outbound lists...</p>
          ) : outboundLists.length === 0 ? (
            <p className="text-sm text-semantic-muted">Create a list manually or generate one from an incident opportunity.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TH>List</TH>
                    <TH>Type</TH>
                    <TH>Territory</TH>
                    <TH>Members</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {outboundLists.map((row) => (
                    <tr key={row.id}>
                      <TD>
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-semantic-muted">{row.source_trigger || row.campaign_name || "manual list"}</p>
                        </div>
                      </TD>
                      <TD>{segmentLabel(row.list_type)}</TD>
                      <TD>{row.territory || "-"}</TD>
                      <TD>{row.member_count || 0}</TD>
                      <TD>
                        <Badge variant={row.export_status === "synced" ? "success" : "default"}>{row.export_status}</Badge>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => exportList(row.id)}>
                            <Download className="h-4 w-4" />
                            Export
                          </Button>
                          <Button size="sm" onClick={() => syncList(row.id, row.smartlead_campaign_id)} disabled={syncingId === row.id}>
                            <Send className="h-4 w-4" />
                            {syncingId === row.id ? "Syncing..." : "Push to Smartlead"}
                          </Button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1rem] border border-semantic-border/60 bg-white/74 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-semantic-text">{value}</p>
    </div>
  );
}

function sourceTypeSummary(item: Opportunity) {
  return Array.isArray(item.source_types) ? item.source_types.slice(0, 2) : [];
}

function humanizeToken(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConfidenceReasoning(value: string) {
  return value.replace(/[_=;+]/g, " ").replace(/\s+/g, " ").trim();
}

function parseCsv(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((part) => part.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((part) => part.trim());
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));
    return {
      name: row.company_name || row.name || "",
      phone: row.phone || "",
      email: row.email || "",
      service_type: row.segment || row.prospect_type || "property_manager",
      city: row.city || "",
      state: row.state || "NY",
      postal_code: row.zip || row.postal_code || "",
      tags: [row.segment || row.prospect_type || "imported"].filter(Boolean)
    };
  });
}
