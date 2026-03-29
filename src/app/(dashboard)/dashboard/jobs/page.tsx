import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoDashboardSnapshot } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BriefcaseBusiness } from "lucide-react";

export default async function JobsPage() {
  if (isDemoMode()) {
    const { jobs } = getDemoDashboardSnapshot();
    return <JobsBoard jobs={jobs || []} />;
  }

  const { accountId, supabase } = await getCurrentUserContext();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id,customer_name,service_type,pipeline_status,scheduled_for,estimated_value,city,state,intent_score")
    .eq("account_id", accountId)
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  return <JobsBoard jobs={jobs || []} />;
}

type JobRow = {
  id: string;
  customer_name?: string | null;
  service_type?: string | null;
  pipeline_status?: string | null;
  scheduled_for?: string | null;
  estimated_value?: number | null;
  city?: string | null;
  state?: string | null;
  intent_score?: number | null;
};

function JobsBoard({ jobs }: { jobs: JobRow[] }) {
  const openJobs = jobs.filter((job) => !["COMPLETED", "WON", "LOST"].includes(String(job.pipeline_status || "").toUpperCase())).length;
  const scheduledJobs = jobs.filter((job) => Boolean(job.scheduled_for)).length;
  const totalValue = jobs.reduce((sum, job) => sum + Number(job.estimated_value || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" subtitle="Active and upcoming jobs with value and priority." />

      <section className="grid gap-3 rounded-[2rem] border border-brand-500/18 bg-[linear-gradient(120deg,rgba(229,236,251,0.95),rgba(255,255,255,0.98))] px-5 py-5 shadow-[0_18px_48px_rgba(16,24,40,0.1)] sm:grid-cols-[1.25fr_0.75fr] sm:px-6">
        <div className="space-y-3">
          <p className="inline-flex items-center rounded-full border border-brand-500/20 bg-white/78 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
            Job Control
          </p>
          <p className="text-sm text-semantic-text">
            Booked work sits here first. Keep scheduled work visible, prioritize open jobs, and move fast on the next inspection or crew assignment.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniStat label="Open" value={openJobs} />
          <MiniStat label="Scheduled" value={scheduledJobs} />
          <MiniStat label="Value" value={`$${totalValue.toLocaleString()}`} />
        </div>
      </section>

      <Card className="border-semantic-border/55 bg-white/72">
        <CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Jobs Board</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {jobs.length === 0 && (
            <EmptyState
              icon={<BriefcaseBusiness className="h-5 w-5" />}
              title="No jobs yet"
              description="Claim a Scanner opportunity or convert a lead into a job to start filling the jobs board."
              ctaLabel="Open Scanner"
              ctaHref="/dashboard/scanner"
            />
          )}

          {jobs.map((job) => (
            <article
              key={job.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-[1.25rem] border border-semantic-border/60 bg-white/82 p-4 shadow-[0_12px_26px_rgba(16,24,40,0.07)] transition hover:-translate-y-0.5 hover:border-brand-300"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 h-12 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,rgb(var(--brand)),rgb(var(--accent)))]" />
                <div>
                  <p className="font-semibold text-semantic-text">{job.customer_name || "Unknown customer"}</p>
                  <p className="text-sm text-semantic-muted">
                    {job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-sm text-semantic-muted">
                    {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : "Not scheduled"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="brand">{job.pipeline_status || "NEW"}</Badge>
                <Badge variant={Number(job.intent_score) >= 75 ? "warning" : "default"}>{Number(job.intent_score) || 0}%</Badge>
                <span className="text-sm font-semibold text-semantic-text">${Number(job.estimated_value || 0).toLocaleString()}</span>
                <Link href={`/dashboard/jobs/${job.id}`}>
                  <Button size="sm" variant="secondary">Open</Button>
                </Link>
              </div>
            </article>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1rem] border border-semantic-border/60 bg-white/74 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-semantic-text">{value}</p>
    </div>
  );
}
