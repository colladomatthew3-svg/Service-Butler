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

  async function scheduleJob(job: JobRow) {
    const slot = new Date();
    slot.setDate(slot.getDate() + 1);
    slot.setHours(9, 0, 0, 0);

    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduled_for: slot.toISOString(), pipeline_status: job.pipeline_status === "NEW" ? "SCHEDULED" : job.pipeline_status })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { error?: string }).error || "Could not schedule job");
      return;
    }

    setJobs((prev) =>
      prev.map((row) =>
        row.id === job.id
          ? { ...row, scheduled_for: slot.toISOString(), pipeline_status: row.pipeline_status === "NEW" ? "SCHEDULED" : row.pipeline_status }
          : row
      )
    );
    showToast("Scheduled");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle="Move work from first contact to completed revenue."
        actions={
          <Link href="/dashboard/leads">
            <Button size="lg">Add from Leads</Button>
          </Link>
        }
      />

      {loading ? (
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
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
            <PipelineColumn
              title={activeMobile}
              items={grouped[activeMobile]}
              onSchedule={scheduleJob}
              onMove={(job) => setSelectedJob(job)}
            />
          </div>

          <div className="hidden gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-7">
            {columns.map((col) => (
              <PipelineColumn key={col} title={col} items={grouped[col]} onSchedule={scheduleJob} onMove={(job) => setSelectedJob(job)} />
            ))}
          </div>
        </>
      )}

      {selectedJob && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-900/40 p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0" onClick={() => setSelectedJob(null)} />
          <Card className="relative z-[71] w-full max-w-xl rounded-t-3xl sm:rounded-2xl">
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
  onSchedule,
  onMove
}: {
  title: Pipeline;
  items: JobRow[];
  onSchedule: (job: JobRow) => void;
  onMove: (job: JobRow) => void;
}) {
  return (
    <Card className="min-w-[280px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-semantic-muted">{label(title)}</p>
          <Badge variant="default">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {items.length === 0 && <p className="text-sm text-semantic-muted">No jobs here.</p>}
        {items.map((job) => (
          <article key={job.id} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-semantic-text">{job.customer_name || "Unknown customer"}</p>
              <Badge variant={job.intent_score >= 75 ? "warning" : "default"}>{job.intent_score}%</Badge>
            </div>
            <p className="mt-1 text-sm text-semantic-muted">{job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-semantic-muted">
              <DollarSign className="h-4 w-4" />
              ${Number(job.estimated_value || 0).toLocaleString()}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-semantic-muted">
              <CalendarClock className="h-4 w-4" />
              {job.scheduled_for ? formatDate(job.scheduled_for) : "Not scheduled"}
            </p>
<<<<<<< ours
            <div className="mt-3 grid grid-cols-2 gap-2">
=======
            <div className="mt-3 grid grid-cols-1 gap-2">
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
              <Button size="sm" fullWidth onClick={() => onSchedule(job)}>
                <CalendarClock className="h-4 w-4" />
                {job.scheduled_for ? "Reschedule" : "Schedule"}
              </Button>
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
              <Link href={`/dashboard/jobs/${job.id}`}>
                <Button size="sm" fullWidth>
                  <CalendarClock className="h-4 w-4" />
                  {job.scheduled_for ? "Reschedule" : "Schedule"}
                </Button>
              </Link>
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
              {job.customer_phone ? (
                <a href={`tel:${job.customer_phone}`}>
                  <Button size="sm" variant="secondary" fullWidth>
                    <PhoneCall className="h-4 w-4" />
                    Call
                  </Button>
                </a>
              ) : (
                <Button size="sm" variant="secondary" fullWidth disabled>
                  <PhoneCall className="h-4 w-4" />
                  Call
                </Button>
              )}
              <Link href={`/dashboard/jobs/${job.id}`}>
                <Button size="sm" variant="secondary" fullWidth>
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <button className="mt-2 inline-flex items-center text-sm font-semibold text-brand-700" onClick={() => onMove(job)}>
              Move stage <MoveRight className="ml-1 h-4 w-4" />
            </button>
          </article>
        ))}
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
