import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function JobsPage() {
  const { accountId, supabase } = await getCurrentUserContext();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id,customer_name,service_type,pipeline_status,scheduled_for,estimated_value,city,state,intent_score")
    .eq("account_id", accountId)
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" subtitle="Active and upcoming jobs with value and priority." />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-semantic-text">Jobs Board</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {(jobs || []).length === 0 && <p className="text-sm text-semantic-muted">No jobs yet. Convert a lead or dispatch from Scanner.</p>}

          {(jobs || []).map((job) => (
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
