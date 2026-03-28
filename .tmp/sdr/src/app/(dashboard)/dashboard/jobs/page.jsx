"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JobsPage;
const link_1 = __importDefault(require("next/link"));
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const empty_state_1 = require("@/components/ui/empty-state");
const lucide_react_1 = require("lucide-react");
async function JobsPage() {
    if ((0, review_mode_1.isDemoMode)()) {
        const { jobs } = (0, store_1.getDemoDashboardSnapshot)();
        return <JobsBoard jobs={jobs || []}/>;
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: jobs } = await supabase
        .from("jobs")
        .select("id,customer_name,service_type,pipeline_status,scheduled_for,estimated_value,city,state,intent_score")
        .eq("account_id", accountId)
        .order("scheduled_for", { ascending: true, nullsFirst: false });
    return <JobsBoard jobs={jobs || []}/>;
}
function JobsBoard({ jobs }) {
    return (<div className="space-y-6">
      <page_header_1.PageHeader title="Jobs" subtitle="Active and upcoming jobs with value and priority."/>

      <card_1.Card>
        <card_1.CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Jobs Board</h2>
        </card_1.CardHeader>
        <card_1.CardBody className="space-y-3">
          {jobs.length === 0 && (<empty_state_1.EmptyState icon={<lucide_react_1.BriefcaseBusiness className="h-5 w-5"/>} title="No jobs yet" description="Claim a Scanner opportunity or convert a lead into a job to start filling the jobs board." ctaLabel="Open Scanner" ctaHref="/dashboard/scanner"/>)}

          {jobs.map((job) => (<article key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
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
                <badge_1.Badge variant="brand">{job.pipeline_status || "NEW"}</badge_1.Badge>
                <badge_1.Badge variant={Number(job.intent_score) >= 75 ? "warning" : "default"}>{Number(job.intent_score) || 0}%</badge_1.Badge>
                <span className="text-sm font-semibold text-semantic-text">${Number(job.estimated_value || 0).toLocaleString()}</span>
                <link_1.default href={`/dashboard/jobs/${job.id}`}>
                  <button_1.Button size="sm" variant="secondary">Open</button_1.Button>
                </link_1.default>
              </div>
            </article>))}
        </card_1.CardBody>
      </card_1.Card>
    </div>);
}
