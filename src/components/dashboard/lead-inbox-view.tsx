"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, PhoneCall, CalendarPlus, ChevronRight, X, Clock3, SlidersHorizontal, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
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

  async function loadLeads() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (service !== "all") params.set("service", service);
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
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
    window.location.href = `/dashboard/leads/${(data as { leadId: string }).leadId}`;
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
          <div className="flex flex-wrap gap-2">
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
            <Button size="lg" variant="secondary" onClick={() => csvInputRef.current?.click()} disabled={importingCsv}>
              {importingCsv ? <Clock3 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import CSV
            </Button>
            <Button size="lg" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="flex items-center gap-2 rounded-xl border border-semantic-border bg-semantic-surface2 px-3">
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
              <Button size="sm" onClick={loadLeads}>
                Search
              </Button>
            </div>
            <div className="min-w-[190px]">
              <Select value={service} onChange={(e) => setService(e.target.value)}>
                {serviceFilters.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All service types" : option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[190px]">
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
            <p className="mt-1 text-sm text-semantic-muted">Try clearing filters or add a new lead to start your queue.</p>
            <p className="mt-2 text-sm text-semantic-muted">Tip: add one HVAC or plumbing lead to see intent scoring in action.</p>
            <div className="mt-5">
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
              <Link key={lead.id} href={`/dashboard/leads/${lead.id}`}>
                <Card className="transition hover:border-brand-300 hover:shadow-card">
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

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="lg"
                        onClick={(e) => {
                          e.preventDefault();
                          convertLeadToJob(lead);
                        }}
                      >
                        {lead.converted_job_id ? "Open Job" : "Convert to Job"}
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          scheduleLead(lead.id, "todayPm");
                        }}
                      >
                        <CalendarPlus className="h-4 w-4" />
                        Schedule
                      </Button>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()}>
                          <Button size="lg" variant="secondary" fullWidth>
                            <PhoneCall className="h-4 w-4" />
                            Call
                          </Button>
                        </a>
                      ) : (
                        <Button size="lg" variant="secondary" disabled title="No phone on file">
                          <PhoneCall className="h-4 w-4" />
                          Call
                        </Button>
                      )}
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          handleTextLead(lead);
                        }}
                      >
                        Text
                      </Button>
                    </div>
                    <div className="flex items-center justify-end text-sm font-semibold text-brand-700">
                      Open <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TH>Lead</TH>
                    <TH>Details</TH>
                    <TH>Intent</TH>
                    <TH>Created</TH>
                    <TH>Actions</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {visibleLeads.map((lead) => (
                    <tr key={lead.id} className="transition hover:bg-semantic-surface2/70">
                      <TD>
                        <Link href={`/dashboard/leads/${lead.id}`} className="font-semibold text-semantic-text hover:text-brand-700">
                          {lead.name || "Unknown lead"}
                        </Link>
                        <p className="text-xs text-semantic-muted">{lead.phone || "No phone yet"}</p>
                      </TD>
                      <TD>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">{lead.service_type || "Service"}</Badge>
                            <Badge variant={statusBadge(lead.status)}>{lead.status}</Badge>
                            {lead.converted_job_id && <Badge variant="success">Job</Badge>}
                            {isUrgent(lead.requested_timeframe) && <Badge variant="warning">ASAP</Badge>}
                          </div>
                          <p className="text-xs text-semantic-muted">{[lead.address, lead.city, lead.state].filter(Boolean).join(", ") || "Location pending"}</p>
                        </div>
                      </TD>
                      <TD>
                        <IntentMeter score={lead.intentScore} signalCount={lead.signalCount} compact />
                      </TD>
                      <TD>
                        <p className="text-sm text-semantic-text">{relativeTime(lead.created_at)}</p>
                        <p className="text-xs text-semantic-muted">{lead.scheduled_for ? `Scheduled ${formatDateShort(lead.scheduled_for)}` : "No slot yet"}</p>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={() => convertLeadToJob(lead)}>
                            {lead.converted_job_id ? "Open Job" : "Convert to Job"}
                          </Button>
                          <Button size="sm" onClick={() => scheduleLead(lead.id, "tomorrowAm")}>
                            <CalendarPlus className="h-4 w-4" />
                            Schedule
                          </Button>
                          {lead.phone ? (
                            <a href={`tel:${lead.phone}`}>
                              <Button size="sm" variant="secondary">
                                <PhoneCall className="h-4 w-4" />
                                Call
                              </Button>
                            </a>
                          ) : (
                            <Button size="sm" variant="secondary" disabled title="No phone on file">
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
                            {lead.converted_job_id ? "Open Job" : "Convert"}
                          </Button>
                          <Link href={`/dashboard/leads/${lead.id}`}>
                            <Button size="sm" variant="ghost">
                              Open
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
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
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold transition",
              value === option
                ? "bg-semantic-brand text-white shadow-sm"
                : "bg-semantic-surface2 text-semantic-muted ring-1 ring-inset ring-semantic-border hover:bg-semantic-surface"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
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
