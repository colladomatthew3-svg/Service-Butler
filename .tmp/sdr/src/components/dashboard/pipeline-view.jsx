"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineView = PipelineView;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const card_1 = require("@/components/ui/card");
const page_header_1 = require("@/components/ui/page-header");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const skeleton_1 = require("@/components/ui/skeleton");
const toast_1 = require("@/components/ui/toast");
const columns = ["NEW", "CONTACTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "WON", "LOST"];
function PipelineView() {
    const [jobs, setJobs] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [activeMobile, setActiveMobile] = (0, react_1.useState)("NEW");
    const [selectedJob, setSelectedJob] = (0, react_1.useState)(null);
    const { showToast } = (0, toast_1.useToast)();
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
        setJobs(data.jobs || []);
        setLoading(false);
    }
    (0, react_1.useEffect)(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const grouped = (0, react_1.useMemo)(() => {
        return columns.reduce((acc, col) => {
            acc[col] = jobs.filter((job) => job.pipeline_status === col);
            return acc;
        }, {});
    }, [jobs]);
    const summary = (0, react_1.useMemo)(() => {
        const active = jobs.filter((job) => !["WON", "LOST"].includes(job.pipeline_status)).length;
        const scheduled = jobs.filter((job) => !!job.scheduled_for).length;
        const value = jobs.reduce((sum, job) => sum + Number(job.estimated_value || 0), 0);
        return { active, scheduled, value };
    }, [jobs]);
    async function move(job, next) {
        const res = await fetch(`/api/jobs/${job.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pipeline_status: next })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || "Could not update job");
            return;
        }
        setJobs((prev) => prev.map((row) => (row.id === job.id ? { ...row, pipeline_status: next } : row)));
        setSelectedJob(null);
        showToast("Job moved");
    }
    return (<div className="space-y-6">
      <page_header_1.PageHeader title="Pipeline" subtitle="Move work from first contact to booked, completed revenue." actions={<link_1.default href="/dashboard/leads">
            <button_1.Button size="lg">Convert Lead to Job</button_1.Button>
          </link_1.default>}/>

      <section className="flex flex-wrap gap-3">
        <SummaryCard label="Active Jobs" value={summary.active.toString()}/>
        <SummaryCard label="Scheduled" value={summary.scheduled.toString()}/>
        <SummaryCard label="Pipeline Value" value={`$${summary.value.toLocaleString()}`}/>
      </section>

      {loading ? (<card_1.Card>
          <card_1.CardBody className="space-y-3">
            <skeleton_1.Skeleton className="h-20 w-full"/>
            <skeleton_1.Skeleton className="h-20 w-full"/>
            <skeleton_1.Skeleton className="h-20 w-full"/>
          </card_1.CardBody>
        </card_1.Card>) : (<>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {columns.map((col) => (<button key={col} onClick={() => setActiveMobile(col)} className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${activeMobile === col ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"}`}>
                {label(col)} ({grouped[col].length})
              </button>))}
          </div>

          <div className="grid gap-4 lg:hidden">
            <PipelineColumn title={activeMobile} items={grouped[activeMobile]} onMove={(job) => setSelectedJob(job)}/>
          </div>

          <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
            {columns.map((col) => (<PipelineColumn key={col} title={col} items={grouped[col]} onMove={(job) => setSelectedJob(job)}/>))}
          </div>
        </>)}

      {selectedJob && (<div className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-900/40 p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0" onClick={() => setSelectedJob(null)}/>
          <card_1.Card className="relative z-[71] w-full max-w-xl rounded-t-3xl sm:rounded-2xl">
            <card_1.CardHeader>
              <h3 className="text-lg font-semibold text-semantic-text">Move {selectedJob.customer_name || "job"}</h3>
            </card_1.CardHeader>
            <card_1.CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {columns.map((col) => (<button_1.Button key={col} variant={selectedJob.pipeline_status === col ? "primary" : "secondary"} onClick={() => move(selectedJob, col)}>
                  {label(col)}
                </button_1.Button>))}
            </card_1.CardBody>
          </card_1.Card>
        </div>)}
    </div>);
}
function PipelineColumn({ title, items, onMove }) {
    return (<card_1.Card className="min-w-[290px] border-semantic-border/60 bg-white/70">
      <card_1.CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-semantic-muted">{label(title)}</p>
          <badge_1.Badge variant="default">{items.length}</badge_1.Badge>
        </div>
      </card_1.CardHeader>
      <card_1.CardBody className="space-y-3">
        {items.length === 0 && (<div className="rounded-xl border border-dashed border-semantic-border bg-semantic-surface2/70 p-4">
            <p className="text-sm font-semibold text-semantic-text">{emptyStateTitle(title)}</p>
            <p className="mt-1 text-sm text-semantic-muted">{emptyStateDescription(title)}</p>
          </div>)}
        {items.map((job) => (<article key={job.id} className="rounded-[1rem] border border-semantic-border/70 bg-white/72 p-3 shadow-[0_10px_24px_rgba(31,42,36,0.07)]">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-semantic-text">{job.customer_name || "Unknown customer"}</p>
              <badge_1.Badge variant={job.intent_score >= 75 ? "warning" : "default"}>{job.intent_score}%</badge_1.Badge>
            </div>
            <p className="mt-1 text-sm text-semantic-muted">{job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-semantic-muted">
              <lucide_react_1.DollarSign className="h-4 w-4"/>
              ${Number(job.estimated_value || 0).toLocaleString()}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-semantic-muted">
              <lucide_react_1.CalendarClock className="h-4 w-4"/>
              {job.scheduled_for ? formatDate(job.scheduled_for) : "Not scheduled"}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {job.customer_phone ? (<a href={`tel:${job.customer_phone}`}>
                  <button_1.Button size="sm" fullWidth>
                    <lucide_react_1.PhoneCall className="h-4 w-4"/>
                    Call
                  </button_1.Button>
                </a>) : (<button_1.Button size="sm" fullWidth disabled>
                  <lucide_react_1.PhoneCall className="h-4 w-4"/>
                  Call
                </button_1.Button>)}
              <link_1.default href={`/dashboard/jobs/${job.id}`}>
                <button_1.Button size="sm" variant="secondary" fullWidth>
                  Open Job
                  <lucide_react_1.ArrowRight className="h-4 w-4"/>
                </button_1.Button>
              </link_1.default>
            </div>
            <button className="mt-3 inline-flex items-center text-sm font-semibold text-brand-700" onClick={() => onMove(job)}>
              Move stage <lucide_react_1.MoveRight className="ml-1 h-4 w-4"/>
            </button>
          </article>))}
      </card_1.CardBody>
    </card_1.Card>);
}
function emptyStateTitle(title) {
    if (title === "NEW")
        return "Run the Lead Scanner to generate opportunities.";
    if (title === "SCHEDULED")
        return "Convert a lead into a job to populate your calendar.";
    return `No jobs in ${label(title)} yet.`;
}
function emptyStateDescription(title) {
    if (title === "NEW")
        return "Weather-driven opportunities and newly converted jobs will land here first.";
    if (title === "SCHEDULED")
        return "Booked work appears here once dispatch confirms timing and crew assignment.";
    return "Move work forward from the previous stage to build this column.";
}
function SummaryCard({ label, value }) {
    return (<card_1.Card className="min-w-[180px] flex-1 border-semantic-border/60 bg-white/72">
      <card_1.CardBody className="py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-semantic-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-semantic-text">{value}</p>
      </card_1.CardBody>
    </card_1.Card>);
}
function label(p) {
    if (p === "IN_PROGRESS")
        return "In Progress";
    return p.charAt(0) + p.slice(1).toLowerCase();
}
function formatDate(input) {
    return new Date(input).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
