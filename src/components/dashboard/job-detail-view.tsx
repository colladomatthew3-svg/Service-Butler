"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, DollarSign, MessageSquare, PhoneCall, Save, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { ReactNode } from "react";

type Job = {
  id: string;
  lead_id: string;
  pipeline_status: "NEW" | "CONTACTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "WON" | "LOST";
  scheduled_for: string | null;
  service_type: string | null;
  assigned_tech_name: string | null;
  estimated_value: number;
  notes: string | null;
  intent_score: number;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  created_at: string;
};

type Signal = {
  id: string;
  signal_type: string;
  title: string;
  detail: string;
  score: number;
};

export function JobDetailView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [valueDraft, setValueDraft] = useState(0);
  const [assignedDraft, setAssignedDraft] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState("");
  const [insuranceCarrier, setInsuranceCarrier] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [adjusterName, setAdjusterName] = useState("");
  const [adjusterPhone, setAdjusterPhone] = useState("");
  const [insuranceStage, setInsuranceStage] = useState("Filed");
  const { showToast } = useToast();

  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as { job?: Job }).job) {
        showToast((data as { error?: string }).error || "Could not load job");
        setLoading(false);
        return;
      }
      const payload = data as { job: Job; signals?: Signal[] };
      setJob(payload.job);
      setSignals(payload.signals || []);
      setNotes(payload.job.notes || "");
      setValueDraft(Number(payload.job.estimated_value || 0));
      setAssignedDraft(payload.job.assigned_tech_name || "");
      setScheduleDraft(payload.job.scheduled_for ? toDatetimeLocal(payload.job.scheduled_for) : "");
      const insurance = parseInsurance(payload.job.notes || "");
      setInsuranceCarrier(insurance.carrier || "");
      setClaimNumber(insurance.claimNumber || "");
      setAdjusterName(insurance.adjusterName || "");
      setAdjusterPhone(insurance.adjusterPhone || "");
      setInsuranceStage(insurance.stage || "Filed");
    } catch {
      showToast("Could not load job");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const totalSignal = useMemo(() => {
    if (!signals.length) return 0;
    return Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length);
  }, [signals]);

  async function update(patch: Record<string, unknown>, successMessage: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((data as { error?: string }).error || "Update failed");
        return;
      }
      setJob((data as { job: Job }).job);
      showToast(successMessage);
    } catch {
      showToast("Update failed");
    }
  }

  async function handleText() {
    if (!job?.customer_phone) {
      showToast("No phone on file");
      return;
    }
    const template = `Hey ${job.customer_name || "there"} - this is Service Butler. We're ready to schedule your ${job.service_type || "service"}. Reply YES with the best time.`;
    if (isMobile) {
      window.location.href = `sms:${job.customer_phone}?&body=${encodeURIComponent(template)}`;
      return;
    }
    try {
      await navigator.clipboard.writeText(template);
      showToast("Text template copied");
    } catch {
      showToast("Unable to copy template");
    }
  }

  if (loading || !job) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-36 md:pb-0">
      <PageHeader
        title={job.customer_name || "Job"}
        subtitle={`${job.service_type || "Service"} · ${[job.city, job.state].filter(Boolean).join(", ")}`}
        actions={<Badge variant="brand">Intent {job.intent_score || totalSignal}%</Badge>}
      />

      <section className="grid gap-3 rounded-[2rem] border border-brand-500/20 bg-[linear-gradient(120deg,rgba(216,239,229,0.88),rgba(255,255,255,0.95))] px-5 py-5 shadow-[0_18px_48px_rgba(25,112,77,0.1)] sm:grid-cols-[1.3fr_0.7fr] sm:px-6">
        <div className="space-y-3">
          <p className="inline-flex items-center rounded-full border border-brand-500/25 bg-white/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
            Job Command
          </p>
          <p className="text-sm text-semantic-text">
            Keep the job moving from contact to schedule to completion. Use the top actions to call, text, and advance stage without losing context.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniStat label="Status" value={job.pipeline_status} />
          <MiniStat label="Value" value={`$${Number(job.estimated_value || 0).toLocaleString()}`} />
          <MiniStat label="Signals" value={signals.length} />
        </div>
      </section>

      <Card className="border-semantic-border/55 bg-white/58">
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={job.pipeline_status} onChange={(e) => update({ pipeline_status: e.target.value }, "Status updated") }>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </Select>
          {job.customer_phone ? (
            <a href={`tel:${job.customer_phone}`}>
              <Button size="lg" fullWidth>
                <PhoneCall className="h-4 w-4" />
                Call
              </Button>
            </a>
          ) : (
            <Button size="lg" disabled>
              <PhoneCall className="h-4 w-4" />
              Call
            </Button>
          )}
          <Button size="lg" variant="secondary" disabled={!job.customer_phone} onClick={handleText}>
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
          <Button size="lg" variant="secondary" onClick={() => update({ pipeline_status: "SCHEDULED" }, "Marked scheduled")}>
            <CalendarPlus className="h-4 w-4" />
            Mark Scheduled
          </Button>
          <Button size="lg" variant="secondary" onClick={() => update({ pipeline_status: "COMPLETED" }, "Marked completed")}>
            <CheckCircle2 className="h-4 w-4" />
            Complete
          </Button>
        </CardBody>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Job Details</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Detail label="Service" value={job.service_type} icon={<Wrench className="h-4 w-4" />} />
                <Detail label="Customer Phone" value={job.customer_phone} icon={<PhoneCall className="h-4 w-4" />} />
                <Detail label="Address" value={[job.address, job.city, job.state, job.postal_code].filter(Boolean).join(", ")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Estimated value</span>
                  <Input type="number" value={valueDraft} onChange={(e) => setValueDraft(Number(e.target.value || 0))} />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Assigned tech</span>
                  <Input value={assignedDraft} onChange={(e) => setAssignedDraft(e.target.value)} placeholder="Nate (Roof Crew)" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Scheduled for</span>
                  <Input type="datetime-local" value={scheduleDraft} onChange={(e) => setScheduleDraft(e.target.value)} />
                </label>
                <Button
                  size="lg"
                  className="self-end"
                  onClick={() =>
                    update(
                      {
                        estimated_value: valueDraft,
                        assigned_tech_name: assignedDraft || null,
                        scheduled_for: scheduleDraft ? new Date(scheduleDraft).toISOString() : null
                      },
                      "Job details saved"
                    )
                  }
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Notes</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button size="lg" onClick={() => update({ notes }, "Notes saved") }>
                <Save className="h-4 w-4" />
                Save Notes
              </Button>
            </CardBody>
          </Card>

          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Insurance</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Carrier</span>
                  <Input value={insuranceCarrier} onChange={(e) => setInsuranceCarrier(e.target.value)} placeholder="State Farm" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Claim #</span>
                  <Input value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} placeholder="CLM-12345" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Adjuster Name</span>
                  <Input value={adjusterName} onChange={(e) => setAdjusterName(e.target.value)} placeholder="Jamie Rivera" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Adjuster Phone</span>
                  <Input value={adjusterPhone} onChange={(e) => setAdjusterPhone(e.target.value)} placeholder="+1..." />
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Stage</span>
                <Select value={insuranceStage} onChange={(e) => setInsuranceStage(e.target.value)}>
                  <option value="Filed">Filed</option>
                  <option value="Adjuster Scheduled">Adjuster Scheduled</option>
                  <option value="Approved">Approved</option>
                  <option value="Denied">Denied</option>
                </Select>
              </label>
              <Button
                size="lg"
                onClick={() => {
                  const mergedNotes = mergeInsuranceBlock(notes, {
                    carrier: insuranceCarrier,
                    claimNumber,
                    adjusterName,
                    adjusterPhone,
                    stage: insuranceStage
                  });
                  setNotes(mergedNotes);
                  update({ notes: mergedNotes }, "Insurance saved");
                }}
              >
                <Save className="h-4 w-4" />
                Save Insurance
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Revenue Snapshot</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              <p className="inline-flex items-center gap-2 text-2xl font-semibold text-semantic-text">
                <DollarSign className="h-5 w-5" />
                {Number(job.estimated_value || 0).toLocaleString()}
              </p>
              <p className="text-sm text-semantic-muted">Estimated revenue for this job.</p>
            </CardBody>
          </Card>

          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Lead Origin & Intent</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {signals.length === 0 && <p className="text-sm text-semantic-muted">No signals found for origin lead.</p>}
              {signals.slice(0, 5).map((signal) => (
                <div key={signal.id} className="rounded-[1rem] border border-semantic-border/60 bg-white/72 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-semantic-text">{signal.title}</p>
                    <Badge variant={signal.score >= 75 ? "success" : signal.score >= 60 ? "warning" : "default"}>{signal.score}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-semantic-muted">{signal.detail}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </section>

      <Link href="/dashboard/pipeline">
        <Button variant="ghost">Back to Pipeline</Button>
      </Link>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-[1rem] border border-semantic-border/60 bg-white/74 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-semantic-text">{value || "-"}</p>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value?: string | null; icon?: ReactNode }) {
  return (
    <div className="rounded-[1rem] border border-semantic-border/60 bg-white/72 p-3">
      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-semantic-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-semantic-text">{value || "-"}</p>
    </div>
  );
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function parseInsurance(notes: string) {
  const match = notes.match(/\[INSURANCE\]([\s\S]*?)\[\/INSURANCE\]/);
  if (!match) return {} as Record<string, string>;
  const lines = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const obj: Record<string, string> = {};
  for (const line of lines) {
    const [k, ...rest] = line.split(":");
    obj[k.trim()] = rest.join(":").trim();
  }
  return {
    carrier: obj.carrier || "",
    claimNumber: obj.claim_number || "",
    adjusterName: obj.adjuster_name || "",
    adjusterPhone: obj.adjuster_phone || "",
    stage: obj.stage || ""
  };
}

function mergeInsuranceBlock(
  notes: string,
  values: { carrier: string; claimNumber: string; adjusterName: string; adjusterPhone: string; stage: string }
) {
  const stripped = notes.replace(/\n?\[INSURANCE\][\s\S]*?\[\/INSURANCE\]\n?/g, "\n").trim();
  const block = [
    "[INSURANCE]",
    `carrier: ${values.carrier || "-"}`,
    `claim_number: ${values.claimNumber || "-"}`,
    `adjuster_name: ${values.adjusterName || "-"}`,
    `adjuster_phone: ${values.adjusterPhone || "-"}`,
    `stage: ${values.stage || "-"}`,
    "[/INSURANCE]"
  ].join("\n");
  return [stripped, block].filter(Boolean).join("\n\n").trim();
}
