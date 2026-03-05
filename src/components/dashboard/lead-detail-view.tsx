"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MessageSquare, PhoneCall, RefreshCw, Save, Clock3, Wrench, Gauge } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type Lead = {
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
};

type Signal = {
  id: string;
  signal_type: string;
  title: string;
  detail: string;
  score: number;
  payload: Record<string, unknown>;
};

export function LeadDetailView({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("new");
  const [customSchedule, setCustomSchedule] = useState("");
  const { showToast } = useToast();
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !(data as { lead?: Lead }).lead) {
      showToast((data as { error?: string }).error || "Could not load lead");
      setLoading(false);
      return;
    }
    const payload = data as { lead: Lead; signals?: Signal[] };
    setLead(payload.lead);
    setSignals(payload.signals || []);
    setNotesDraft(payload.lead.notes || "");
    setStatusDraft(payload.lead.status || "new");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const intentAverage = useMemo(() => {
    if (signals.length === 0) return 0;
    return Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length);
  }, [signals]);

  const groupedSignals = useMemo(() => {
    const groups: Record<"Urgency" | "Demand" | "Weather impact", Signal[]> = {
      Urgency: [],
      Demand: [],
      "Weather impact": []
    };

    for (const signal of signals) {
      if (signal.signal_type === "urgency") groups.Urgency.push(signal);
      else if (signal.signal_type === "weather") groups["Weather impact"].push(signal);
      else groups.Demand.push(signal);
    }

    return groups;
  }, [signals]);

  const timeline = useMemo(() => {
    if (!lead) return [] as Array<{ title: string; detail: string; time: string }>;
    const items = [
      {
        title: "Lead created",
        detail: `${lead.source || "manual"} intake captured`,
        time: formatTime(lead.created_at)
      },
      {
        title: `Status: ${lead.status}`,
        detail: lead.status === "new" ? "Needs first response" : "Pipeline updated",
        time: "Now"
      }
    ];

    if (lead.scheduled_for) {
      items.unshift({
        title: "Visit scheduled",
        detail: formatDateLong(lead.scheduled_for),
        time: "Scheduled"
      });
    }

    if ((lead.requested_timeframe || "").toLowerCase().includes("asap")) {
      items.push({
        title: "Urgency flagged",
        detail: "Customer requested immediate service window",
        time: "Auto"
      });
    }

    if (signals.length > 0) {
      items.push({
        title: "Intent analyzed",
        detail: `${signals.length} signal${signals.length > 1 ? "s" : ""} scored`,
        time: "Auto"
      });
    }

    return items.slice(0, 6);
  }, [lead, signals.length]);

  async function patch(values: Record<string, unknown>) {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { error?: string }).error || "Update failed");
      return;
    }
    setLead((prev) => (prev ? { ...prev, ...(data as { lead?: Partial<Lead> }).lead } : prev));
  }

  async function refreshSignals() {
    setSignalsLoading(true);
    const wait = new Promise((resolve) => setTimeout(resolve, 600));
    const req = fetch(`/api/leads/${leadId}/signals`, { method: "POST" });
    const [res] = await Promise.all([req, wait]);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSignalsLoading(false);
      showToast((data as { error?: string }).error || "Could not refresh signals");
      return;
    }

    const leadRes = await fetch(`/api/leads/${leadId}`);
    const leadData = await leadRes.json().catch(() => ({}));
    if (leadRes.ok) {
      setSignals((leadData as { signals?: Signal[] }).signals || []);
    }
    setSignalsLoading(false);
    showToast("Signals updated");
  }

  async function applyQuickSchedule(type: "today2" | "tomorrow9" | "thisWeek") {
    const now = new Date();
    const d = new Date(now);
    if (type === "today2") {
      d.setHours(14, 0, 0, 0);
    } else if (type === "tomorrow9") {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else {
      const daysToThursday = (4 - d.getDay() + 7) % 7 || 3;
      d.setDate(d.getDate() + daysToThursday);
      d.setHours(11, 0, 0, 0);
    }
    await patch({ status: "scheduled", scheduled_for: d.toISOString() });
    showToast("Scheduled");
  }

  function scrollToSchedule() {
    document.getElementById("lead-schedule-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleTextLead() {
    if (!lead?.phone) {
      showToast("No phone on file");
      return;
    }
    const template = `Hey ${lead.name || "there"} - this is Service Butler. We can get you a crew for ${lead.service_type || "your request"}. Reply YES and a good time today.`;
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

  async function convertToJob() {
    if (!lead) return;
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
    setLead((prev) => (prev ? { ...prev, converted_job_id: data.jobId } : prev));
    showToast(data.created ? "Converted to Job" : "Opened existing job");
    window.location.href = `/dashboard/jobs/${data.jobId}`;
  }

  const missingPhone = !lead?.phone?.trim();

  if (loading || !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40 md:pb-0">
      <PageHeader
        title={lead.name || "Lead"}
        subtitle={`${lead.service_type || "Service"} · ${[lead.city, lead.state].filter(Boolean).join(", ") || "Location pending"}`}
        actions={
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Badge variant="default">{lead.service_type || "Service"}</Badge>
            <Badge variant={statusBadge(statusDraft)}>{statusDraft}</Badge>
            <IntentChip score={intentAverage} />
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-semantic-surface2 p-2 text-brand-700">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-semantic-muted">Intent score</p>
              <p className="text-2xl font-semibold text-semantic-text">
                {intentAverage}% <span className="text-base font-medium text-semantic-muted">{intentLabel(intentAverage)} priority</span>
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[180px_auto_auto_auto]">
            <Select
              value={statusDraft}
              onChange={async (e) => {
                setStatusDraft(e.target.value);
                await patch({ status: e.target.value });
                showToast("Status updated");
              }}
            >
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="scheduled">scheduled</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </Select>
            <Button size="lg" onClick={convertToJob}>
              {lead.converted_job_id ? "Open Job" : "Convert to Job"}
            </Button>
            <Button size="lg" onClick={scrollToSchedule}>
              <CalendarPlus className="h-4 w-4" />
              Schedule
            </Button>
            {missingPhone ? (
              <Button size="lg" variant="secondary" disabled title="No phone on file">
                <PhoneCall className="h-4 w-4" />
                Call
              </Button>
            ) : (
              <a href={`tel:${lead.phone}`}>
                <Button size="lg" variant="secondary" fullWidth>
                  <PhoneCall className="h-4 w-4" />
                  Call
                </Button>
              </a>
            )}
            <Button size="lg" variant="secondary" disabled={missingPhone} onClick={handleTextLead}>
              <MessageSquare className="h-4 w-4" />
              Text
            </Button>
            <Button size="lg" variant="secondary" onClick={() => showToast("Use scheduler below")}> 
              <CalendarPlus className="h-4 w-4" />
              Schedule
            </Button>
            <Button size="lg" variant="secondary" onClick={convertToJob}>
              {lead.converted_job_id ? "Open Job" : "Convert to Job"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {missingPhone && (
        <div className="rounded-xl border border-warning-500/20 bg-warning-100 px-4 py-3 text-sm text-warning-700">
          Add a phone number to enable Call and Text actions.
        </div>
      )}

      {lead.scheduled_for && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Next scheduled time: <span className="font-semibold">{formatDateLong(lead.scheduled_for)}</span>
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card id="lead-schedule-card">
            <CardHeader>
              <h2 className="text-lg font-semibold text-semantic-text">Customer & Job Details</h2>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Detail label="Phone" value={lead.phone || "-"} icon={<PhoneCall className="h-4 w-4" />} />
              <Detail label="Service" value={lead.service_type || "-"} icon={<Wrench className="h-4 w-4" />} />
              <Detail
                label="Address"
                value={[lead.address, lead.city, lead.state, lead.postal_code].filter(Boolean).join(", ") || "-"}
                className="sm:col-span-2"
              />
              <Detail label="Requested timeframe" value={lead.requested_timeframe || "-"} icon={<Clock3 className="h-4 w-4" />} />
              <Detail
                label="Scheduled"
                value={lead.scheduled_for ? formatDateLong(lead.scheduled_for) : "Not scheduled yet"}
                className={cn(lead.scheduled_for && "ring-1 ring-inset ring-brand-500/30")}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-semantic-text">Scheduling</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => applyQuickSchedule("today2")}>Today 2pm</Button>
                <Button variant="secondary" onClick={() => applyQuickSchedule("tomorrow9")}>Tomorrow 9am</Button>
                <Button variant="secondary" onClick={() => applyQuickSchedule("thisWeek")}>This week</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  className="h-12 rounded-xl border border-semantic-border bg-semantic-surface px-4 text-sm"
                  value={customSchedule}
                  onChange={(e) => setCustomSchedule(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    if (!customSchedule) return;
                    await patch({ status: "scheduled", scheduled_for: new Date(customSchedule).toISOString() });
                    showToast("Custom schedule saved");
                  }}
                >
                  Save
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-semantic-text">Notes</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <Textarea rows={6} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Capture key details for dispatch and tech handoff." />
              <Button
                size="lg"
                onClick={async () => {
                  await patch({ notes: notesDraft });
                  showToast("Notes saved");
                }}
              >
                <Save className="h-4 w-4" />
                Save Notes
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-semantic-text">Recent Activity</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {timeline.map((entry, idx) => (
                <div key={`${entry.title}-${idx}`} className="grid grid-cols-[22px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                    {idx < timeline.length - 1 && <span className="mt-1 h-full w-px bg-semantic-border" />}
                  </div>
                  <div className="pb-3">
                    <p className="font-medium text-semantic-text">{entry.title}</p>
                    <p className="text-sm text-semantic-muted">{entry.detail}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-semantic-muted">{entry.time}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-semantic-text">Intent Signals</h2>
              <Button variant="secondary" size="sm" onClick={refreshSignals}>
                <RefreshCw className={cn("h-4 w-4", signalsLoading && "animate-spin")} />
                Refresh Signals
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {signalsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : signals.length === 0 ? (
              <p className="text-sm text-semantic-muted">No signals yet. Refresh to regenerate signal analysis.</p>
            ) : (
              (["Urgency", "Demand", "Weather impact"] as const).map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{group}</p>
                  {groupedSignals[group].length === 0 ? (
                    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3 text-sm text-semantic-muted">
                      No {group.toLowerCase()} signals right now.
                    </div>
                  ) : (
                    groupedSignals[group].map((signal) => (
                      <div key={signal.id} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-semantic-text">{signal.title}</p>
                          <Badge variant={scoreBadge(signal.score)}>{signal.score}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-semantic-muted">{signal.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>

      <Link href="/dashboard/leads" className="inline-block">
        <Button variant="ghost">Back to Lead Inbox</Button>
      </Link>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-semantic-border bg-semantic-surface/95 p-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={convertToJob}>
            {lead.converted_job_id ? "Open Job" : "Convert to Job"}
          </Button>
          <Button size="lg" onClick={scrollToSchedule}>
            <CalendarPlus className="h-4 w-4" />
            Schedule
          </Button>
          {missingPhone ? (
            <Button size="lg" variant="secondary" disabled title="No phone on file">
              <PhoneCall className="h-4 w-4" />
              Call
            </Button>
          ) : (
            <a href={`tel:${lead.phone}`}>
              <Button size="lg" variant="secondary" fullWidth>
                <PhoneCall className="h-4 w-4" />
                Call
              </Button>
            </a>
          )}
          <Button size="lg" variant="secondary" disabled={missingPhone} onClick={handleTextLead}>
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
          <Button size="lg" variant="secondary" onClick={() => showToast("Use scheduler card")}> 
            <CalendarPlus className="h-4 w-4" />
            Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  icon,
  className
}: {
  label: string;
  value?: string | null;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-semantic-border bg-semantic-surface2 p-3", className)}>
      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-semantic-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-semantic-text">{value || "-"}</p>
    </div>
  );
}

function formatDateLong(dateString: string) {
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function scoreBadge(score: number) {
  if (score >= 75) return "success" as const;
  if (score >= 60) return "warning" as const;
  return "default" as const;
}

function statusBadge(status: string) {
  if (status === "new") return "warning" as const;
  if (status === "won") return "success" as const;
  if (status === "lost") return "danger" as const;
  if (status === "scheduled") return "brand" as const;
  return "default" as const;
}

function intentLabel(score: number) {
  if (score >= 75) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function IntentChip({ score }: { score: number }) {
  const tone = score >= 75 ? "success" : score >= 60 ? "warning" : "default";
  return <Badge variant={tone}>Intent {score}%</Badge>;
}
