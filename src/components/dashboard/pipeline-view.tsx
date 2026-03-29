"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, DollarSign, MoveRight, PhoneCall } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const columns = ["NEW", "CONTACTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "WON", "LOST"] as const;
type Pipeline = (typeof columns)[number];

type JobRow = {
  id: string;
  lead_id: string;
  pipeline_status: Pipeline;
  scheduled_for: string | null;
  service_type: string | null;
  assigned_tech_name: string | null;
  estimated_value: number;
  intent_score: number;
  customer_name: string | null;
  customer_phone: string | null;
  city: string | null;
  state: string | null;
};

export function PipelineView() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMobile, setActiveMobile] = useState<Pipeline>("NEW");
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/jobs");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setJobs([]);
      showToast("Jobs API unavailable in current mode");
      setLoading(false);
      return;
    }
    setJobs((data as { jobs?: JobRow[] }).jobs || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    return columns.reduce<Record<Pipeline, JobRow[]>>((acc, col) => {
      acc[col] = jobs.filter((job) => job.pipeline_status === col);
      return acc;
    }, {} as Record<Pipeline, JobRow[]>);
  }, [jobs]);

  const summary = useMemo(() => {
    const active = jobs.filter((job) => !["WON", "LOST"].includes(job.pipeline_status)).length;
    const scheduled = jobs.filter((job) => !!job.scheduled_for).length;
    const value = jobs.reduce((sum, job) => sum + Number(job.estimated_value || 0), 0);
    return { active, scheduled, value };
  }, [jobs]);

  async function move(job: JobRow, next: Pipeline) {
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipeline_status: next })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { error?: string }).error || "Could not update job");
      return;
    }
    setJobs((prev) => prev.map((row) => (row.id === job.id ? { ...row, pipeline_status: next } : row)));
    setSelectedJob(null);
    showToast("Job moved");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle="Move work from first contact to booked, completed revenue."
        actions={
          <Link href="/dashboard/leads">
            <Button size="lg">Convert Lead to Job</Button>
          </Link>
        }
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-semantic-border/60 bg-[linear-gradient(120deg,rgba(229,236,251,0.95),rgba(255,255,255,0.98))] shadow-[0_18px_60px_rgba(16,24,40,0.08)]">
        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1.4fr_1fr] lg:px-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-800">
              Command view
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-semantic-text sm:text-3xl">Keep work moving from booked to complete without hunting through cards.</h2>
              <p className="max-w-2xl text-sm text-semantic-muted sm:text-base">
                The pipeline should read like an operator command center: active work up top, stage movement one tap away, and revenue context visible at a glance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/leads">
                <Button size="sm" variant="secondary">
                  Convert Lead to Job
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard/jobs">
                <Button size="sm" variant="secondary">
                  Open Jobs
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard/schedule">
                <Button size="sm" variant="secondary">
                  Review Schedule
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SummaryCard label="Active Jobs" value={summary.active.toString()} helper="Open work that still needs movement" />
            <SummaryCard label="Scheduled" value={summary.scheduled.toString()} helper="Jobs with a calendar commitment" />
            <SummaryCard label="Pipeline Value" value={`$${summary.value.toLocaleString()}`} helper="Gross estimated value in play" />
          </div>
        </div>
      </section>

      {loading ? (
        <Card className="border-semantic-border/60 bg-white/72 shadow-[0_14px_45px_rgba(16,24,40,0.06)]">
          <CardBody className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-semantic-border/60 bg-white/78 p-2 pb-2 lg:hidden">
            {columns.map((col) => (
              <button
                key={col}
                onClick={() => setActiveMobile(col)}
                className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${
                  activeMobile === col ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
                }`}
              >
                {label(col)} ({grouped[col].length})
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:hidden">
            <PipelineColumn title={activeMobile} items={grouped[activeMobile]} onMove={(job) => setSelectedJob(job)} />
          </div>

          <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
            {columns.map((col) => (
              <PipelineColumn key={col} title={col} items={grouped[col]} onMove={(job) => setSelectedJob(job)} />
            ))}
          </div>
        </>
      )}

      {selectedJob && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-900/40 p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0" onClick={() => setSelectedJob(null)} />
          <Card className="relative z-[71] w-full max-w-xl rounded-t-3xl border-semantic-border/60 bg-white/95 shadow-[0_18px_60px_rgba(31,42,36,0.14)] sm:rounded-2xl">
            <CardHeader>
              <h3 className="text-lg font-semibold text-semantic-text">Move {selectedJob.customer_name || "job"}</h3>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {columns.map((col) => (
                <Button
                  key={col}
                  variant={selectedJob.pipeline_status === col ? "primary" : "secondary"}
                  onClick={() => move(selectedJob, col)}
                >
                  {label(col)}
                </Button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function PipelineColumn({
  title,
  items,
  onMove
}: {
  title: Pipeline;
  items: JobRow[];
  onMove: (job: JobRow) => void;
}) {
  return (
    <Card className="min-w-[290px] border-semantic-border/60 bg-white/82 shadow-[0_14px_45px_rgba(16,24,40,0.06)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-semantic-muted">{label(title)}</p>
            <p className="mt-1 text-xs text-semantic-muted">{emptyStateDescription(title)}</p>
          </div>
          <Badge variant="default">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3.5">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-semantic-border bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(241,246,253,0.92))] p-4">
            <p className="text-sm font-semibold text-semantic-text">{emptyStateTitle(title)}</p>
            <p className="mt-1 text-sm text-semantic-muted">{emptyStateDescription(title)}</p>
          </div>
        )}
        {items.map((job) => (
          <article
            key={job.id}
            className="rounded-2xl border border-semantic-border/70 bg-white/88 p-4 shadow-[0_10px_24px_rgba(16,24,40,0.06)] transition hover:border-semantic-border hover:bg-white"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-semibold text-semantic-text">{job.customer_name || "Unknown customer"}</p>
                {job.assigned_tech_name && <p className="text-xs text-semantic-muted">Assigned to {job.assigned_tech_name}</p>}
              </div>
              <Badge variant={job.intent_score >= 75 ? "warning" : "default"}>{job.intent_score}%</Badge>
            </div>
            <p className="mt-2 text-sm text-semantic-muted">{job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-semantic-muted">
              <p className="inline-flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                ${Number(job.estimated_value || 0).toLocaleString()}
              </p>
              <p className="inline-flex items-center gap-1">
                <CalendarClock className="h-4 w-4" />
                {job.scheduled_for ? formatDate(job.scheduled_for) : "Not scheduled"}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {job.customer_phone ? (
                <a href={`tel:${job.customer_phone}`}>
                  <Button size="sm" fullWidth>
                    <PhoneCall className="h-4 w-4" />
                    Call
                  </Button>
                </a>
              ) : (
                <Button size="sm" fullWidth disabled>
                  <PhoneCall className="h-4 w-4" />
                  Call
                </Button>
              )}
              <Link href={`/dashboard/jobs/${job.id}`}>
                <Button size="sm" variant="secondary" fullWidth>
                  Open Job
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <button className="mt-3 inline-flex items-center text-sm font-semibold text-brand-700" onClick={() => onMove(job)}>
              Move stage <MoveRight className="ml-1 h-4 w-4" />
            </button>
          </article>
        ))}
      </CardBody>
    </Card>
  );
}

function emptyStateTitle(title: Pipeline) {
  if (title === "NEW") return "Run the Lead Scanner to generate opportunities.";
  if (title === "SCHEDULED") return "Convert a lead into a job to populate your calendar.";
  return `No jobs in ${label(title)} yet.`;
}

function emptyStateDescription(title: Pipeline) {
  if (title === "NEW") return "Weather-driven opportunities and newly converted jobs will land here first.";
  if (title === "SCHEDULED") return "Booked work appears here once dispatch confirms timing and crew assignment.";
  return "Move work forward from the previous stage to build this column.";
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card className="border-semantic-border/60 bg-white/76">
      <CardBody className="py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-semantic-text">{value}</p>
        <p className="mt-1 text-xs text-semantic-muted">{helper}</p>
      </CardBody>
    </Card>
  );
}

function label(p: Pipeline) {
  if (p === "IN_PROGRESS") return "In Progress";
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function formatDate(input: string) {
  return new Date(input).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
