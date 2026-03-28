"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadDetailView = LeadDetailView;
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const select_1 = require("@/components/ui/select");
const textarea_1 = require("@/components/ui/textarea");
const skeleton_1 = require("@/components/ui/skeleton");
const toast_1 = require("@/components/ui/toast");
const cn_1 = require("@/lib/utils/cn");
function LeadDetailView({ leadId }) {
    const [lead, setLead] = (0, react_1.useState)(null);
    const [signals, setSignals] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [signalsLoading, setSignalsLoading] = (0, react_1.useState)(false);
    const [notesDraft, setNotesDraft] = (0, react_1.useState)("");
    const [statusDraft, setStatusDraft] = (0, react_1.useState)("new");
    const [customSchedule, setCustomSchedule] = (0, react_1.useState)("");
    const scheduleSectionRef = (0, react_1.useRef)(null);
    const { showToast } = (0, toast_1.useToast)();
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    async function load() {
        setLoading(true);
        const res = await fetch(`/api/leads/${leadId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.lead) {
            showToast(data.error || "Could not load lead");
            setLoading(false);
            return;
        }
        const payload = data;
        setLead(payload.lead);
        setSignals(payload.signals || []);
        setNotesDraft(payload.lead.notes || "");
        setStatusDraft(payload.lead.status || "new");
        setLoading(false);
    }
    (0, react_1.useEffect)(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadId]);
    const intentAverage = (0, react_1.useMemo)(() => {
        if (signals.length === 0)
            return 0;
        return Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length);
    }, [signals]);
    const groupedSignals = (0, react_1.useMemo)(() => {
        const groups = {
            Urgency: [],
            Demand: [],
            "Weather impact": []
        };
        for (const signal of signals) {
            if (signal.signal_type === "urgency")
                groups.Urgency.push(signal);
            else if (signal.signal_type === "weather")
                groups["Weather impact"].push(signal);
            else
                groups.Demand.push(signal);
        }
        return groups;
    }, [signals]);
    const timeline = (0, react_1.useMemo)(() => {
        if (!lead)
            return [];
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
    async function patch(values) {
        const res = await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || "Update failed");
            return;
        }
        setLead((prev) => (prev ? { ...prev, ...data.lead } : prev));
    }
    async function refreshSignals() {
        setSignalsLoading(true);
        const wait = new Promise((resolve) => setTimeout(resolve, 600));
        const req = fetch(`/api/leads/${leadId}/signals`, { method: "POST" });
        const [res] = await Promise.all([req, wait]);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setSignalsLoading(false);
            showToast(data.error || "Could not refresh signals");
            return;
        }
        const leadRes = await fetch(`/api/leads/${leadId}`);
        const leadData = await leadRes.json().catch(() => ({}));
        if (leadRes.ok) {
            setSignals(leadData.signals || []);
        }
        setSignalsLoading(false);
        showToast("Signals updated");
    }
    async function applyQuickSchedule(type) {
        const now = new Date();
        const d = new Date(now);
        if (type === "today2") {
            d.setHours(14, 0, 0, 0);
        }
        else if (type === "tomorrow9") {
            d.setDate(d.getDate() + 1);
            d.setHours(9, 0, 0, 0);
        }
        else {
            const daysToThursday = (4 - d.getDay() + 7) % 7 || 3;
            d.setDate(d.getDate() + daysToThursday);
            d.setHours(11, 0, 0, 0);
        }
        await patch({ status: "scheduled", scheduled_for: d.toISOString() });
        showToast("Scheduled");
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
        }
        catch {
            showToast("Unable to copy template");
        }
    }
    async function convertToJob() {
        if (!lead)
            return;
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
    const scrollToSchedule = () => scheduleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (loading || !lead) {
        return (<div className="space-y-4">
        <skeleton_1.Skeleton className="h-10 w-72"/>
        <skeleton_1.Skeleton className="h-64 w-full"/>
        <skeleton_1.Skeleton className="h-80 w-full"/>
      </div>);
    }
    return (<div className="space-y-6 pb-40 md:pb-0">
      <page_header_1.PageHeader title={lead.name || "Lead"} subtitle={`${lead.service_type || "Service"} · ${[lead.city, lead.state].filter(Boolean).join(", ") || "Location pending"}`} actions={<div className="hidden flex-wrap items-center gap-2 md:flex">
            <badge_1.Badge variant="default">{lead.service_type || "Service"}</badge_1.Badge>
            <badge_1.Badge variant={statusBadge(statusDraft)}>{statusDraft}</badge_1.Badge>
            <IntentChip score={intentAverage}/>
          </div>}/>

      <card_1.Card>
        <card_1.CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-semantic-surface2 p-2 text-brand-700">
              <lucide_react_1.Gauge className="h-5 w-5"/>
            </div>
            <div>
              <p className="text-sm text-semantic-muted">Intent score</p>
              <p className="text-2xl font-semibold text-semantic-text">
                {intentAverage}% <span className="text-base font-medium text-semantic-muted">{intentLabel(intentAverage)} priority</span>
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[180px_auto_auto_auto]">
            <select_1.Select value={statusDraft} onChange={async (e) => {
            setStatusDraft(e.target.value);
            await patch({ status: e.target.value });
            showToast("Status updated");
        }}>
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="scheduled">scheduled</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select_1.Select>
            {missingPhone ? (<button_1.Button size="lg" disabled title="No phone on file">
                <lucide_react_1.PhoneCall className="h-4 w-4"/>
                Call
              </button_1.Button>) : (<a href={`tel:${lead.phone}`}>
                <button_1.Button size="lg" fullWidth>
                  <lucide_react_1.PhoneCall className="h-4 w-4"/>
                  Call
                </button_1.Button>
              </a>)}
            <button_1.Button size="lg" variant="secondary" disabled={missingPhone} onClick={handleTextLead}>
              <lucide_react_1.MessageSquare className="h-4 w-4"/>
              Text
            </button_1.Button>
            <button_1.Button size="lg" variant="secondary" onClick={scrollToSchedule}>
              <lucide_react_1.CalendarPlus className="h-4 w-4"/>
              Schedule
            </button_1.Button>
            <button_1.Button size="lg" variant="secondary" onClick={convertToJob}>
              {lead.converted_job_id ? "Open Job" : "Convert to Job"}
            </button_1.Button>
          </div>
        </card_1.CardBody>
      </card_1.Card>

      {lead.enrichment && (<section className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Property Snapshot</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-4">
              <div className="overflow-hidden rounded-[1.4rem] border border-semantic-border bg-[linear-gradient(160deg,rgba(33,43,38,0.96),rgba(91,108,100,0.86))] p-4 text-white">
                <div className="relative h-44 overflow-hidden rounded-[1.1rem]">
                  {lead.enrichment.propertyImageUrl ? (<image_1.default src={lead.enrichment.propertyImageUrl} alt={lead.enrichment.propertyImageSource || "Property aerial image"} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 420px" unoptimized/>) : (<image_1.default src="/marketing/property-preview.svg" alt="Property preview" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 420px"/>)}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,29,26,0.04),rgba(22,29,26,0.26))]"/>
                  <div className="absolute left-3 top-3 rounded-full bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/88">
                    {lead.enrichment.propertyImageLabel}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/88">
                    {lead.enrichment.simulated ? "Demo record" : "Public record"}
                  </span>
                  <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/88">
                    {lead.enrichment.propertyAddress === lead.address ? "Exact address" : "Normalized address"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard label="Address" value={lead.enrichment.propertyAddress}/>
                <DetailCard label="Neighborhood" value={lead.enrichment.neighborhood}/>
                <DetailCard label="Image source" value={lead.enrichment.propertyImageSource || "Placeholder"}/>
                <DetailCard label="Property value" value={lead.enrichment.propertyValueEstimate || "Unavailable"}/>
                <DetailCard label="Value status" value={formatVerification(lead.enrichment.propertyValueVerification)}/>
              </div>
            </card_1.CardBody>
          </card_1.Card>

          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Contact And Verification</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-4">
              <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Enrichment source</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-semantic-text">
                    <lucide_react_1.BadgeCheck className="h-4 w-4 text-brand-700"/>
                    {lead.enrichment.provider}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-semantic-muted">
                    {lead.enrichment.simulated ? "Demo placeholder, not verified" : "Production enrichment"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-semantic-muted">
                    Lead source: {lead.source || "manual"}
                  </span>
                </div>
              </div>

              {lead.enrichment.ownerContact ? (<div className="grid gap-3 sm:grid-cols-2">
                  <DetailCard label={lead.enrichment.simulated ? "Owner / contact (demo)" : "Owner / contact"} value={lead.enrichment.ownerContact.name}/>
                  <DetailCard label="Verification" value={formatVerification(lead.enrichment.ownerContact.verification)}/>
                  <DetailCard label="Phone" value={lead.enrichment.ownerContact.phone || "Unavailable"}/>
                  <DetailCard label="Email" value={lead.enrichment.ownerContact.email || "Unavailable"}/>
                </div>) : (<div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4 text-sm text-semantic-muted">
                  No verified contact data is currently available for this lead.
                </div>)}

              <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Notes</p>
                <ul className="mt-3 space-y-2 text-sm text-semantic-text">
                  {lead.enrichment.notes.map((note) => (<li key={note} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-700"/>
                      <span>{note}</span>
                    </li>))}
                </ul>
              </div>
            </card_1.CardBody>
          </card_1.Card>
        </section>)}

      {missingPhone && (<div className="rounded-xl border border-warning-500/20 bg-warning-100 px-4 py-3 text-sm text-warning-700">
          Add a phone number to enable Call and Text actions.
        </div>)}

      {lead.scheduled_for && (<div className="rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Next scheduled time: <span className="font-semibold">{formatDateLong(lead.scheduled_for)}</span>
        </div>)}

      <div className="rounded-xl border border-semantic-border bg-semantic-surface2 px-4 py-3 text-sm text-semantic-muted">
        <span className="font-semibold text-semantic-text">Next best action:</span>{" "}
        {lead.status === "new"
            ? "Call now, confirm urgency, and lock a time before competitors respond."
            : lead.status === "contacted"
                ? "Send confirmation text and secure a schedule window."
                : lead.status === "scheduled"
                    ? "Prepare dispatch notes and confirm crew assignment."
                    : "Review notes and move the lead to won/lost quickly."}
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Customer & Job Details</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="grid gap-3 sm:grid-cols-2">
              <Detail label="Phone" value={lead.phone || "-"} icon={<lucide_react_1.PhoneCall className="h-4 w-4"/>}/>
              <Detail label="Service" value={lead.service_type || "-"} icon={<lucide_react_1.Wrench className="h-4 w-4"/>}/>
              <Detail label="Lead source" value={formatLeadSource(lead.source)}/>
              <Detail label="Address" value={[lead.address, lead.city, lead.state, lead.postal_code].filter(Boolean).join(", ") || "-"} className="sm:col-span-2"/>
              <Detail label="Requested timeframe" value={lead.requested_timeframe || "-"} icon={<lucide_react_1.Clock3 className="h-4 w-4"/>}/>
              <Detail label="Scheduled" value={lead.scheduled_for ? formatDateLong(lead.scheduled_for) : "Not scheduled yet"} className={(0, cn_1.cn)(lead.scheduled_for && "ring-1 ring-inset ring-brand-500/30")}/>
            </card_1.CardBody>
          </card_1.Card>

          <div ref={scheduleSectionRef}>
            <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Scheduling</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button_1.Button variant="secondary" onClick={() => applyQuickSchedule("today2")}>Today 2pm</button_1.Button>
                <button_1.Button variant="secondary" onClick={() => applyQuickSchedule("tomorrow9")}>Tomorrow 9am</button_1.Button>
                <button_1.Button variant="secondary" onClick={() => applyQuickSchedule("thisWeek")}>This week</button_1.Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="datetime-local" className="h-12 rounded-xl border border-semantic-border bg-semantic-surface px-4 text-sm" value={customSchedule} onChange={(e) => setCustomSchedule(e.target.value)}/>
                <button_1.Button onClick={async () => {
            if (!customSchedule)
                return;
            await patch({ status: "scheduled", scheduled_for: new Date(customSchedule).toISOString() });
            showToast("Custom schedule saved");
        }}>
                  Save
                </button_1.Button>
              </div>
            </card_1.CardBody>
            </card_1.Card>
          </div>

          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Notes</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              <textarea_1.Textarea rows={6} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Capture key details for dispatch and tech handoff."/>
              <button_1.Button size="lg" onClick={async () => {
            await patch({ notes: notesDraft });
            showToast("Notes saved");
        }}>
                <lucide_react_1.Save className="h-4 w-4"/>
                Save Notes
              </button_1.Button>
            </card_1.CardBody>
          </card_1.Card>

          <card_1.Card>
            <card_1.CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Recent Activity</h2>
            </card_1.CardHeader>
            <card_1.CardBody className="space-y-3">
              {timeline.map((entry, idx) => (<div key={`${entry.title}-${idx}`} className="grid grid-cols-[22px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500"/>
                    {idx < timeline.length - 1 && <span className="mt-1 h-full w-px bg-semantic-border"/>}
                  </div>
                  <div className="pb-3">
                    <p className="font-medium text-semantic-text">{entry.title}</p>
                    <p className="text-sm text-semantic-muted">{entry.detail}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-semantic-muted">{entry.time}</p>
                  </div>
                </div>))}
            </card_1.CardBody>
          </card_1.Card>
        </div>

        <card_1.Card>
          <card_1.CardHeader>
            <div className="flex items-center justify-between gap-2">
              <h2 className="dashboard-section-title text-semantic-text">Intent Signals</h2>
              <button_1.Button variant="secondary" size="sm" onClick={refreshSignals}>
                <lucide_react_1.RefreshCw className={(0, cn_1.cn)("h-4 w-4", signalsLoading && "animate-spin")}/>
                Refresh Signals
              </button_1.Button>
            </div>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-4">
            {signalsLoading ? (<div className="space-y-3">
                <skeleton_1.Skeleton className="h-20 w-full"/>
                <skeleton_1.Skeleton className="h-20 w-full"/>
                <skeleton_1.Skeleton className="h-20 w-full"/>
              </div>) : signals.length === 0 ? (<p className="text-sm text-semantic-muted">No signals yet. Refresh to regenerate signal analysis.</p>) : (["Urgency", "Demand", "Weather impact"].map((group) => (<div key={group} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{group}</p>
                  {groupedSignals[group].length === 0 ? (<div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3 text-sm text-semantic-muted">
                      No {group.toLowerCase()} signals right now.
                    </div>) : (groupedSignals[group].map((signal) => (<div key={signal.id} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-semantic-text">{signal.title}</p>
                          <badge_1.Badge variant={scoreBadge(signal.score)}>{signal.score}</badge_1.Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-semantic-muted">{signal.detail}</p>
                      </div>)))}
                </div>)))}
          </card_1.CardBody>
        </card_1.Card>
      </section>

      <link_1.default href="/dashboard/leads" className="inline-block">
        <button_1.Button variant="ghost">Back to Lead Inbox</button_1.Button>
      </link_1.default>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-semantic-border bg-semantic-surface/95 p-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="grid grid-cols-3 gap-2">
          {missingPhone ? (<button_1.Button size="lg" disabled title="No phone on file">
              <lucide_react_1.PhoneCall className="h-4 w-4"/>
              Call
            </button_1.Button>) : (<a href={`tel:${lead.phone}`}>
              <button_1.Button size="lg" fullWidth>
                <lucide_react_1.PhoneCall className="h-4 w-4"/>
                Call
              </button_1.Button>
            </a>)}
          <button_1.Button size="lg" variant="secondary" disabled={missingPhone} onClick={handleTextLead}>
            <lucide_react_1.MessageSquare className="h-4 w-4"/>
            Text
          </button_1.Button>
          <button_1.Button size="lg" variant="secondary" onClick={scrollToSchedule}>
            <lucide_react_1.CalendarPlus className="h-4 w-4"/>
            Schedule
          </button_1.Button>
        </div>
      </div>
    </div>);
}
function DetailCard({ label, value }) {
    return (<div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-semantic-text">{value}</p>
    </div>);
}
function formatVerification(value) {
    if (value === "demo")
        return "Demo placeholder";
    if (value === "estimated")
        return "Estimated";
    if (value === "public-record")
        return "Public record";
    if (value === "verified")
        return "Verified";
    return value;
}
function formatLeadSource(value) {
    const normalized = String(value || "manual").toLowerCase();
    if (normalized === "scanner")
        return "Scanner";
    if (normalized === "imported" || normalized === "import")
        return "Imported";
    if (normalized === "manual")
        return "Manual";
    return normalized.replace(/_/g, " ");
}
function Detail({ label, value, icon, className }) {
    return (<div className={(0, cn_1.cn)("rounded-xl border border-semantic-border bg-semantic-surface2 p-3", className)}>
      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-semantic-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-semantic-text">{value || "-"}</p>
    </div>);
}
function formatDateLong(dateString) {
    return new Date(dateString).toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}
function formatTime(dateString) {
    return new Date(dateString).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function scoreBadge(score) {
    if (score >= 75)
        return "success";
    if (score >= 60)
        return "warning";
    return "default";
}
function statusBadge(status) {
    if (status === "new")
        return "warning";
    if (status === "won")
        return "success";
    if (status === "lost")
        return "danger";
    if (status === "scheduled")
        return "brand";
    return "default";
}
function intentLabel(score) {
    if (score >= 75)
        return "High";
    if (score >= 60)
        return "Medium";
    return "Low";
}
function IntentChip({ score }) {
    const tone = score >= 75 ? "success" : score >= 60 ? "warning" : "default";
    return <badge_1.Badge variant={tone}>Intent {score}%</badge_1.Badge>;
}
