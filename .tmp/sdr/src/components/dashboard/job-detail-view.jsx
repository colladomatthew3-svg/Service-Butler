"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobDetailView = JobDetailView;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const select_1 = require("@/components/ui/select");
const textarea_1 = require("@/components/ui/textarea");
const skeleton_1 = require("@/components/ui/skeleton");
const input_1 = require("@/components/ui/input");
const toast_1 = require("@/components/ui/toast");
function JobDetailView({ jobId }) {
    const [job, setJob] = (0, react_1.useState)(null);
    const [signals, setSignals] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [notes, setNotes] = (0, react_1.useState)("");
    const [valueDraft, setValueDraft] = (0, react_1.useState)(0);
    const [assignedDraft, setAssignedDraft] = (0, react_1.useState)("");
    const [scheduleDraft, setScheduleDraft] = (0, react_1.useState)("");
    const [insuranceCarrier, setInsuranceCarrier] = (0, react_1.useState)("");
    const [claimNumber, setClaimNumber] = (0, react_1.useState)("");
    const [adjusterName, setAdjusterName] = (0, react_1.useState)("");
    const [adjusterPhone, setAdjusterPhone] = (0, react_1.useState)("");
    const [insuranceStage, setInsuranceStage] = (0, react_1.useState)("Filed");
    const { showToast } = (0, toast_1.useToast)();
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    async function load() {
        setLoading(true);
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.job) {
            showToast(data.error || "Could not load job");
            setLoading(false);
            return;
        }
        const payload = data;
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
        setLoading(false);
    }
    (0, react_1.useEffect)(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId]);
    const totalSignal = (0, react_1.useMemo)(() => {
        if (!signals.length)
            return 0;
        return Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length);
    }, [signals]);
    async function update(patch, successMessage) {
        const res = await fetch(`/api/jobs/${jobId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || "Update failed");
            return;
        }
        setJob(data.job);
        showToast(successMessage);
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
        }
        catch {
            showToast("Unable to copy template");
        }
    }
    if (loading || !job) {
        return (<div className="space-y-4">
        <skeleton_1.Skeleton className="h-10 w-72"/>
        <skeleton_1.Skeleton className="h-80 w-full"/>
      </div>);
    }
    return (<div className="space-y-6 pb-36 md:pb-0">
      <page_header_1.PageHeader title={job.customer_name || "Job"} subtitle={`${job.service_type || "Service"} · ${[job.city, job.state].filter(Boolean).join(", ")}`} actions={<badge_1.Badge variant="brand">Intent {job.intent_score || totalSignal}%</badge_1.Badge>}/>

      <card_1.Card>
        <card_1.CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select_1.Select value={job.pipeline_status} onChange={(e) => update({ pipeline_status: e.target.value }, "Status updated")}>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select_1.Select>
          {job.customer_phone ? (<a href={`tel:${job.customer_phone}`}>
              <button_1.Button size="lg" fullWidth>
                <lucide_react_1.PhoneCall className="h-4 w-4"/>
                Call
              </button_1.Button>
            </a>) : (<button_1.Button size="lg" disabled>
              <lucide_react_1.PhoneCall className="h-4 w-4"/>
              Call
            </button_1.Button>)}
          <button_1.Button size="lg" variant="secondary" disabled={!job.customer_phone} onClick={handleText}>
            <lucide_react_1.MessageSquare className="h-4 w-4"/>
            Text
          </button_1.Button>
          <button_1.Button size="lg" variant="secondary" onClick={() => update({ pipeline_status: "SCHEDULED" }, "Marked scheduled")}>
            <lucide_react_1.CalendarPlus className="h-4 w-4"/>
            Mark Scheduled
          </button_1.Button>
          <button_1.Button size="lg" variant="secondary" onClick={() => update({ pipeline_status: "COMPLETED" }, "Marked completed")}>
            <lucide_react_1.CheckCircle2 className="h-4 w-4"/>
            Complete
          </button_1.Button>
        </card_1.CardBody>
      </card_1.Card>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Job Details</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              <Detail label="Service" value={job.service_type} icon={<lucide_react_1.Wrench className="h-4 w-4"/>}/>
              <Detail label="Customer Phone" value={job.customer_phone} icon={<lucide_react_1.PhoneCall className="h-4 w-4"/>}/>
              <Detail label="Address" value={[job.address, job.city, job.state, job.postal_code].filter(Boolean).join(", ")}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Estimated value</span>
                  <input_1.Input type="number" value={valueDraft} onChange={(e) => setValueDraft(Number(e.target.value || 0))}/>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Assigned tech</span>
                  <input_1.Input value={assignedDraft} onChange={(e) => setAssignedDraft(e.target.value)} placeholder="Nate (Roof Crew)"/>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Scheduled for</span>
                  <input_1.Input type="datetime-local" value={scheduleDraft} onChange={(e) => setScheduleDraft(e.target.value)}/>
                </label>
                <button_1.Button size="lg" className="self-end" onClick={() => update({
            estimated_value: valueDraft,
            assigned_tech_name: assignedDraft || null,
            scheduled_for: scheduleDraft ? new Date(scheduleDraft).toISOString() : null
        }, "Job details saved")}>
                  <lucide_react_1.Save className="h-4 w-4"/>
                  Save
                </button_1.Button>
              </div>
            </card_1.CardBody>
          </card_1.Card>

          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Notes</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              <textarea_1.Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)}/>
              <button_1.Button size="lg" onClick={() => update({ notes }, "Notes saved")}>
                <lucide_react_1.Save className="h-4 w-4"/>
                Save Notes
              </button_1.Button>
            </card_1.CardBody>
          </card_1.Card>

          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Insurance</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Carrier</span>
                  <input_1.Input value={insuranceCarrier} onChange={(e) => setInsuranceCarrier(e.target.value)} placeholder="State Farm"/>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Claim #</span>
                  <input_1.Input value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} placeholder="CLM-12345"/>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Adjuster Name</span>
                  <input_1.Input value={adjusterName} onChange={(e) => setAdjusterName(e.target.value)} placeholder="Jamie Rivera"/>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Adjuster Phone</span>
                  <input_1.Input value={adjusterPhone} onChange={(e) => setAdjusterPhone(e.target.value)} placeholder="+1..."/>
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">Stage</span>
                <select_1.Select value={insuranceStage} onChange={(e) => setInsuranceStage(e.target.value)}>
                  <option value="Filed">Filed</option>
                  <option value="Adjuster Scheduled">Adjuster Scheduled</option>
                  <option value="Approved">Approved</option>
                  <option value="Denied">Denied</option>
                </select_1.Select>
              </label>
              <button_1.Button size="lg" onClick={() => {
            const mergedNotes = mergeInsuranceBlock(notes, {
                carrier: insuranceCarrier,
                claimNumber,
                adjusterName,
                adjusterPhone,
                stage: insuranceStage
            });
            setNotes(mergedNotes);
            update({ notes: mergedNotes }, "Insurance saved");
        }}>
                <lucide_react_1.Save className="h-4 w-4"/>
                Save Insurance
              </button_1.Button>
            </card_1.CardBody>
          </card_1.Card>
        </div>

        <div className="space-y-5">
          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Revenue Snapshot</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-2">
              <p className="inline-flex items-center gap-2 text-2xl font-semibold text-semantic-text">
                <lucide_react_1.DollarSign className="h-5 w-5"/>
                {Number(job.estimated_value || 0).toLocaleString()}
              </p>
              <p className="text-sm text-semantic-muted">Estimated revenue for this job.</p>
            </card_1.CardBody>
          </card_1.Card>

          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Lead Origin & Intent</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              {signals.length === 0 && <p className="text-sm text-semantic-muted">No signals found for origin lead.</p>}
              {signals.slice(0, 5).map((signal) => (<div key={signal.id} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-semantic-text">{signal.title}</p>
                    <badge_1.Badge variant={signal.score >= 75 ? "success" : signal.score >= 60 ? "warning" : "default"}>{signal.score}</badge_1.Badge>
                  </div>
                  <p className="mt-1 text-sm text-semantic-muted">{signal.detail}</p>
                </div>))}
            </card_1.CardBody>
          </card_1.Card>
        </div>
      </section>

      <link_1.default href="/dashboard/pipeline">
        <button_1.Button variant="ghost">Back to Pipeline</button_1.Button>
      </link_1.default>
    </div>);
}
function Detail({ label, value, icon }) {
    return (<div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-semantic-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-semantic-text">{value || "-"}</p>
    </div>);
}
function toDatetimeLocal(iso) {
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}
function parseInsurance(notes) {
    const match = notes.match(/\[INSURANCE\]([\s\S]*?)\[\/INSURANCE\]/);
    if (!match)
        return {};
    const lines = match[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const obj = {};
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
function mergeInsuranceBlock(notes, values) {
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
