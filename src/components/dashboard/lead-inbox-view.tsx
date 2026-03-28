"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, PhoneCall, CalendarPlus, ChevronRight, X, Clock3, SlidersHorizontal, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type LeadRow = {
  id: string;
  created_at: string;
  status: string;
  name: string;
  phone: string;
  service_type: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  requested_timeframe: string;
  source: string;
  notes: string | null;
  scheduled_for: string | null;
  converted_job_id?: string | null;
  intentScore: number;
  signalCount: number;
};

type SortMode = "intent" | "newest" | "schedule";

const statusFilters = ["all", "new", "contacted", "scheduled", "won", "lost"] as const;

export function LeadInboxView() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("all");
  const [service, setService] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("intent");
  const [showAdd, setShowAdd] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    service_type: "HVAC",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    requested_timeframe: "ASAP",
    notes: ""
  });

  const { showToast } = useToast();
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  const serviceFilters = useMemo(() => {
    const set = new Set(leads.map((l) => l.service_type).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const items = [...leads];
    if (sort === "newest") {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === "schedule") {
      items.sort((a, b) => {
        const at = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        const bt = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
    } else {
      items.sort((a, b) => b.intentScore - a.intentScore);
    }
    return items;
  }, [leads, sort]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = leads.filter((lead) => new Date(lead.created_at).getTime() >= today.getTime()).length;
    const highIntent = leads.filter((lead) => lead.intentScore >= 75 && lead.status !== "won" && lead.status !== "lost").length;
    const needsSchedule = leads.filter((lead) => !lead.scheduled_for && lead.status !== "lost" && lead.status !== "won").length;
    const stale = leads.filter((lead) => now - new Date(lead.created_at).getTime() > 1000 * 60 * 60 * 24).length;
    return { newToday, highIntent, needsSchedule, stale };
  }, [leads]);

  async function loadLeads() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (service !== "all") params.set("service", service);
    if (search.trim()) params.set("search", search.trim());
    const queryString = params.toString();
    const url = queryString ? `/api/leads?${queryString}` : "/api/leads";

    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Unable to load leads");
      setLeads((data as { leads?: LeadRow[] }).leads || []);
    } catch {
      setLeads([]);
      showToast("Lead API unavailable in current mode");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, service]);

  async function submitLead() {
    setSavingLead(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSavingLead(false);
      showToast((data as { error?: string }).error || "Failed to create lead");
      return;
    }
    showToast("Lead added");
    setShowAdd(false);
    setForm({
      name: "",
      phone: "",
      service_type: "HVAC",
      address: "",
      city: "",
      state: "",
      postal_code: "",
      requested_timeframe: "ASAP",
      notes: ""
    });
    router.push(`/dashboard/leads/${(data as { leadId: string }).leadId}`);
    router.refresh();
  }

  async function scheduleLead(leadId: string, preset: "todayPm" | "tomorrowAm" | "thisWeek") {
    const d = new Date();
    if (preset === "todayPm") {
      d.setHours(14, 0, 0, 0);
    } else if (preset === "tomorrowAm") {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else {
      const daysToFriday = (5 - d.getDay() + 7) % 7 || 2;
      d.setDate(d.getDate() + daysToFriday);
      d.setHours(10, 0, 0, 0);
    }

    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "scheduled", scheduled_for: d.toISOString() })
    });
    if (!res.ok) {
      showToast("Could not schedule lead");
      return;
    }

    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, status: "scheduled", scheduled_for: d.toISOString() } : lead)));
    showToast("Scheduled");
  }

  async function handleTextLead(lead: LeadRow) {
    if (!lead.phone) {
      showToast("No phone on file");
      return;
    }
    const template = textTemplate(lead);
    if (isMobile) {
      window.location.href = `sms:${lead.phone}?&body=${encodeURIComponent(template)}`;
      return;
    }
    try {
      await navigator.clipboard.writeText(template);
      showToast("Text template copied");
    } catch {
      showToast("Unable to copy template");
    }
  }

  async function convertLeadToJob(lead: LeadRow) {
    if (lead.converted_job_id) {
      window.location.href = `/dashboard/jobs/${lead.converted_job_id}`;
      return;
    }
    const res = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.jobId) {
      showToast(data.error || "Could not convert lead");
      return;
    }
    setLeads((prev) => prev.map((row) => (row.id === lead.id ? { ...row, converted_job_id: data.jobId } : row)));
    showToast(data.created ? "Converted to Job" : "Opened existing job");
    window.location.href = `/dashboard/jobs/${data.jobId}`;
  }

  async function importCsvFile(file: File) {
    setImportingCsv(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        showToast("CSV has no valid rows");
        setImportingCsv(false);
        return;
      }
      const outboundRes = await fetch("/api/outbound/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows })
      });
      const outboundData = await outboundRes.json().catch(() => ({}));
      if (!outboundRes.ok) {
        showToast((outboundData as { error?: string }).error || "CSV import failed");
        setImportingCsv(false);
        return;
      }

      const leadRows = rows.slice(0, 40);
      const created: string[] = [];
      for (const row of leadRows) {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            phone: row.phone,
            service_type: row.service_type || "General",
            city: row.city,
            state: row.state,
            postal_code: row.postal_code,
            requested_timeframe: "Today",
            source: "import",
            notes: "Imported from CSV outbound prospecting"
          })
        });
        if (res.ok) created.push(row.name || "Lead");
      }

      showToast(`Imported ${rows.length} contacts, created ${created.length} leads`);
      await loadLeads();
    } catch {
      showToast("Could not parse CSV file");
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Inbox"
        subtitle="Prioritize by intent and move the next call into a booked job."
        actions={
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importCsvFile(file);
              }}
            />
            <Button size="lg" variant="secondary" fullWidth onClick={() => csvInputRef.current?.click()} disabled={importingCsv}>
              {importingCsv ? <Clock3 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import CSV
            </Button>
            <Button size="lg" fullWidth onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        }
      />

      <div className="rounded-[1.7rem] border border-brand-500/28 bg-[linear-gradient(115deg,rgba(216,239,229,0.88),rgba(255,255,255,0.94))] px-5 py-5 shadow-[0_20px_56px_rgba(25,112,77,0.11)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Verified Lead Queue</p>
        <p className="mt-2 text-sm text-semantic-text">
          This inbox is optimized for verified, contactable leads first. Use quick actions to call, text, schedule, and convert without context switching.
        </p>
      </div>

      <Card className="overflow-visible">
        <CardBody className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px] lg:items-center">
            <div className="flex flex-col gap-2 rounded-2xl border border-semantic-border/75 bg-white/78 p-2 sm:flex-row sm:items-center sm:px-3 sm:py-2">
              <div className="flex flex-1 items-center gap-2 px-1">
                <Search className="h-4 w-4 text-semantic-muted" />
                <Input
                  placeholder="Search customer, phone, or location"
                  className="border-0 bg-transparent shadow-none focus:ring-0"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadLeads();
                    }
                  }}
                />
              </div>
              <Button size="sm" fullWidth className="sm:w-auto" onClick={loadLeads}>Search</Button>
            </div>
            <div>
              <Select value={service} onChange={(e) => setService(e.target.value)}>
                {serviceFilters.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All service types" : option}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                <option value="intent">Highest intent</option>
                <option value="newest">Newest</option>
                <option value="schedule">Nearest schedule</option>
              </Select>
            </div>
          </div>

          <FilterChips
            label="Status"
            options={statusFilters as unknown as string[]}
            value={status}
            onChange={(value) => setStatus(value as (typeof statusFilters)[number])}
          />
        </CardBody>
      </Card>

      <section className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <QuickKpi label="New Today" value={kpis.newToday} />
        <QuickKpi label="High Intent" value={kpis.highIntent} tone="warning" />
        <QuickKpi label="Need Schedule" value={kpis.needsSchedule} tone="brand" />
        <QuickKpi label="Over 24h Old" value={kpis.stale} />
      </section>

      {loading ? (
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardBody>
        </Card>
      ) : visibleLeads.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-lg font-semibold text-semantic-text">No leads found</p>
            <p className="mt-1 text-sm text-semantic-muted">Run the Lead Scanner or add a new lead to start the inbox workflow.</p>
            <p className="mt-2 text-sm text-semantic-muted">The inbox gets stronger once weather-driven opportunities begin converting into leads.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard/scanner">
                <Button size="lg" variant="secondary">
                  Open Scanner
                </Button>
              </Link>
              <Button size="lg" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-4 lg:hidden">
            {visibleLeads.map((lead) => (
              <Card key={lead.id} className="transition hover:border-brand-300 hover:shadow-card">
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-semantic-text">{lead.name || "Unknown lead"}</p>
                      <p className="text-sm text-semantic-muted">{[lead.city, lead.state].filter(Boolean).join(", ") || "Location pending"}</p>
                    </div>
                    <Badge variant={statusBadge(lead.status)}>{lead.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{lead.service_type || "Service"}</Badge>
                    {lead.converted_job_id && <Badge variant="success">Job created</Badge>}
                    {isUrgent(lead.requested_timeframe) && <Badge variant="warning">ASAP</Badge>}
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-semantic-muted">
                      <Clock3 className="h-3 w-3" />
                      {relativeTime(lead.created_at)}
                    </span>
                  </div>

                  <IntentMeter score={lead.intentScore} signalCount={lead.signalCount} />
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-semantic-muted">
                    <span className="rounded-full bg-semantic-surface2 px-3 py-1">Source: {leadSourceLabel(lead.source)}</span>
                    <span className="rounded-full bg-semantic-surface2 px-3 py-1">Detected: {relativeTime(lead.created_at)}</span>
                    <span className="rounded-full bg-semantic-surface2 px-3 py-1">{lead.requested_timeframe || "Timing pending"}</span>
                  </div>
                  {lead.notes && (
                    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 px-3 py-2 text-sm text-semantic-muted">
                      <span className="font-semibold text-semantic-text">Why this lead matters:</span> {lead.notes}
                    </div>
                  )}
                  <div className="rounded-xl border border-semantic-border bg-semantic-surface2 px-3 py-2 text-sm text-semantic-muted">
                    <span className="font-semibold text-semantic-text">Next step:</span> {nextStepLabel(lead)}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()}>
                        <Button size="lg" fullWidth>
                          <PhoneCall className="h-4 w-4" />
                          Call
                        </Button>
                      </a>
                    ) : (
                      <Button size="lg" disabled title="No phone on file">
                        <PhoneCall className="h-4 w-4" />
                        Call
                      </Button>
                    )}
                    <Button size="lg" variant="secondary" onClick={(e) => { e.preventDefault(); handleTextLead(lead); }}>
                      Text
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        scheduleLead(lead.id, "todayPm");
                      }}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Today PM
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        convertLeadToJob(lead);
                      }}
                    >
                      {lead.converted_job_id ? "Open Job" : "Convert to Job"}
                    </Button>
                    <Button
                      size="md"
                      variant="ghost"
                      fullWidth
                      className="col-span-2"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/dashboard/leads/${lead.id}`;
                      }}
                    >
                      Open Lead
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="hidden space-y-3 lg:block">
            {visibleLeads.map((lead) => (
              <article
                key={lead.id}
                className="rounded-[1.3rem] border border-semantic-border/70 bg-white/76 px-5 py-4 shadow-[0_14px_30px_rgba(30,42,36,0.08)] transition hover:-translate-y-0.5 hover:border-brand-300"
              >
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.75fr_1fr] xl:items-center">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/leads/${lead.id}`} className="text-base font-semibold text-semantic-text hover:text-brand-700">
                        {lead.name || "Unknown lead"}
                      </Link>
                      <Badge variant={statusBadge(lead.status)}>{lead.status}</Badge>
                      {lead.converted_job_id && <Badge variant="success">Job</Badge>}
                    </div>
                    <p className="text-sm text-semantic-muted">{lead.phone || "No phone yet"}</p>
                    <p className="text-sm text-semantic-muted">{[lead.address, lead.city, lead.state].filter(Boolean).join(", ") || "Location pending"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{lead.service_type || "Service"}</Badge>
                      {isUrgent(lead.requested_timeframe) && <Badge variant="warning">ASAP</Badge>}
                      <Badge variant="default">{leadSourceLabel(lead.source)}</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <IntentMeter score={lead.intentScore} signalCount={lead.signalCount} compact />
                    <p className="text-sm text-semantic-muted">{relativeTime(lead.created_at)}</p>
                    <p className="text-xs text-semantic-muted">{lead.scheduled_for ? `Scheduled ${formatDateShort(lead.scheduled_for)}` : "No slot yet"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`}>
                        <Button size="sm">
                          <PhoneCall className="h-4 w-4" />
                          Call
                        </Button>
                      </a>
                    ) : (
                      <Button size="sm" disabled title="No phone on file">
                        <PhoneCall className="h-4 w-4" />
                        Call
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => handleTextLead(lead)}>
                      Text
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => scheduleLead(lead.id, "tomorrowAm")}>
                      <CalendarPlus className="h-4 w-4" />
                      Tomorrow AM
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => convertLeadToJob(lead)}>
                      {lead.converted_job_id ? "Open Job" : "Convert to Job"}
                    </Button>
                    <Link href={`/dashboard/leads/${lead.id}`}>
                      <Button size="sm" variant="ghost">
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-neutral-900/40 p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0" onClick={() => setShowAdd(false)} />
          <Card className="relative z-[61] w-full max-w-2xl rounded-t-3xl sm:rounded-2xl">
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold text-semantic-text">Add Lead</h3>
                  <p className="text-sm text-semantic-muted">Capture the essentials now, qualify details after first contact.</p>
                </div>
                <button
                  aria-label="Close"
                  className="rounded-xl p-2 text-semantic-muted transition hover:bg-semantic-surface2"
                  onClick={() => setShowAdd(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Service type</label>
                  <Select value={form.service_type} onChange={(e) => setForm((prev) => ({ ...prev, service_type: e.target.value }))}>
                    {["HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping", "General Repair"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Requested timeframe</label>
                  <Select
                    value={form.requested_timeframe}
                    onChange={(e) => setForm((prev) => ({ ...prev, requested_timeframe: e.target.value }))}
                  >
                    {[
                      "ASAP",
                      "Today",
                      "Tomorrow",
                      "This week",
                      "Flexible"
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Customer name">
                  <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Jane Carter" />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="+1 555 123 4567" />
                </Field>
              </div>

              <Field label="Address (optional)">
                <Input
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="124 Maple Ave"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="City">
                  <Input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Brentwood" />
                </Field>
                <Field label="State">
                  <Input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} placeholder="NY" />
                </Field>
                <Field label="Postal">
                  <Input
                    value={form.postal_code}
                    onChange={(e) => setForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                    placeholder="11717"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  className="min-h-24 w-full rounded-xl border border-semantic-border bg-semantic-surface px-4 py-3 text-sm outline-none transition placeholder:text-semantic-muted focus:border-semantic-brand focus:ring-4 focus:ring-semantic-brand/15"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Leak under sink, customer available after 3pm."
                />
              </Field>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" size="lg" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button
                  size="lg"
                  onClick={submitLead}
                  disabled={savingLead || !form.name.trim() || !form.phone.trim() || !form.service_type.trim()}
                >
                  {savingLead ? "Adding..." : "Add Lead"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function leadSourceLabel(source: string) {
  const normalized = String(source || "manual").toLowerCase();
  if (normalized === "scanner") return "Scanner";
  if (normalized === "import") return "Imported";
  if (normalized === "manual") return "Manual";
  return normalized.replace(/_/g, " ");
}

function FilterChips({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 shrink-0 rounded-[0.95rem] px-4 text-sm font-semibold transition",
              value === option
                ? "bg-semantic-brand text-white shadow-[0_8px_20px_rgba(25,112,77,0.25)]"
                : "bg-semantic-surface2/85 text-semantic-muted ring-1 ring-inset ring-semantic-border hover:bg-semantic-surface"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickKpi({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "brand" }) {
  const toneClass = tone === "warning" ? "text-warning-700" : tone === "brand" ? "text-brand-700" : "text-semantic-text";
  return (
    <Card className="min-w-[180px] shrink-0">
      <CardBody className="space-y-1 py-3 sm:py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-semantic-muted">{label}</p>
        <p className={cn("text-2xl font-semibold", toneClass)}>{value}</p>
      </CardBody>
    </Card>
  );
}

function statusBadge(status: string) {
  if (status === "new") return "warning" as const;
  if (status === "won") return "success" as const;
  if (status === "lost") return "danger" as const;
  if (status === "scheduled") return "brand" as const;
  return "default" as const;
}

function isUrgent(timeframe?: string | null) {
  const text = (timeframe || "").toLowerCase();
  return text.includes("asap") || text.includes("today") || text.includes("emergency");
}

function relativeTime(dateString: string) {
  const then = new Date(dateString).getTime();
  const now = Date.now();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function nextStepLabel(lead: LeadRow) {
  if (lead.converted_job_id) return "Open job and confirm crew assignment.";
  if (lead.status === "new") return "Call now and qualify scope.";
  if (!lead.scheduled_for) return "Offer next available time slot.";
  return `Show up ${formatDateShort(lead.scheduled_for)} and close the job.`;
}

function intentTone(score: number) {
  if (score >= 75) return "bg-success-500";
  if (score >= 60) return "bg-warning-500";
  return "bg-brand-500";
}

function intentLabel(score: number) {
  if (score >= 75) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function IntentMeter({ score, signalCount, compact }: { score: number; signalCount: number; compact?: boolean }) {
  return (
    <div>
      <p className={cn("font-semibold text-semantic-text", compact ? "text-sm" : "text-sm")}>{score}% intent · {intentLabel(score)}</p>
      <div className="mt-1.5 h-2.5 w-full rounded-full bg-semantic-surface2">
        <div className={cn("h-2.5 rounded-full transition-all duration-500", intentTone(score))} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <p className="mt-1 text-xs text-semantic-muted">{signalCount} signals analyzed</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">{label}</span>
      {children}
    </label>
  );
}

function textTemplate(lead: LeadRow) {
  return `Hey ${lead.name || "there"} - this is Service Butler. We can get you a crew for ${lead.service_type || "your request"}. Reply YES and a good time today.`;
}

function parseCsv(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((col) => col.trim().toLowerCase());
  const rows: Array<{
    name: string;
    phone: string;
    email: string;
    service_type: string;
    city: string;
    state: string;
    postal_code: string;
    tags: string[];
  }> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((cell) => cell.trim());
    const row = Object.fromEntries(header.map((key, idx) => [key, values[idx] || ""])) as Record<string, string>;
    const name = row.name || row.full_name || "";
    if (!name) continue;
    rows.push({
      name,
      phone: row.phone || row.phone_e164 || "",
      email: row.email || "",
      service_type: row.service_type || row.service || "General",
      city: row.city || "",
      state: row.state || "",
      postal_code: row.postal_code || row.zip || "",
      tags: (row.tags || "")
        .split("|")
        .map((tag) => tag.trim())
        .filter(Boolean)
    });
  }

  return rows;
}
