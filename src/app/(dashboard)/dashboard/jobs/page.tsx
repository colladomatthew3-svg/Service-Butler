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
  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" subtitle="Active and upcoming jobs with value and priority." />

      <Card>
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
            <article key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
              <div>
                <p className="font-semibold text-semantic-text">{job.customer_name || "Unknown customer"}</p>
                <p className="text-sm text-semantic-muted">
                  {job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}
                </p>
                <p className="text-sm text-semantic-muted">
                  {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : "Not scheduled"}
                </p>
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
