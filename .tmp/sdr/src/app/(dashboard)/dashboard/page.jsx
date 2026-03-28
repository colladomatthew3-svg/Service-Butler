"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardOverviewPage;
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const rbac_1 = require("@/lib/auth/rbac");
const weather_ticker_1 = require("@/components/dashboard/weather-ticker");
const weather_1 = require("@/lib/services/weather");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
async function DashboardOverviewPage() {
    const demoMode = (0, review_mode_1.isDemoMode)();
    let leadRows = [];
    let jobRows = [];
    let opportunities = [];
    let prospects = [];
    let referralPartners = [];
    let outboundLists = [];
    let enrichedLeads = [];
    let settings = null;
    if (demoMode) {
        const snapshot = (0, store_1.getDemoDashboardSnapshot)();
        const weather = await (0, store_1.getDemoWeatherSettings)();
        leadRows = snapshot.leads;
        jobRows = snapshot.jobs;
        opportunities = snapshot.opportunities;
        prospects = snapshot.prospects;
        referralPartners = snapshot.referralPartners;
        outboundLists = snapshot.outboundLists;
        enrichedLeads = snapshot.leads.map((lead) => ({
            ...lead,
            intent: Number(lead.intentScore || 0)
        }));
        settings = {
            weather_lat: weather.weather_lat,
            weather_lng: weather.weather_lng,
            weather_location_label: weather.weather_location_label,
            home_base_city: weather.home_base_city,
            home_base_state: weather.home_base_state
        };
    }
    else {
        const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
        const [{ data: leads }, { data: loadedSettings }, { data: jobs }, { data: loadedProspects }, { data: loadedPartners }, { data: loadedLists }] = await Promise.all([
            supabase
                .from("leads")
                .select("id,name,service_type,city,state,status,requested_timeframe,created_at,scheduled_for")
                .eq("account_id", accountId)
                .order("created_at", { ascending: false }),
            supabase
                .from("account_settings")
                .select("weather_lat,weather_lng,weather_location_label,home_base_city,home_base_state")
                .eq("account_id", accountId)
                .maybeSingle(),
            supabase
                .from("jobs")
                .select("id,pipeline_status,scheduled_for,estimated_value,service_type,customer_name,city,state,intent_score")
                .eq("account_id", accountId)
                .order("scheduled_for", { ascending: true, nullsFirst: false }),
            supabase.from("prospects").select("id").eq("account_id", accountId).limit(300),
            supabase.from("referral_partners").select("id").eq("account_id", accountId).limit(300),
            supabase.from("outbound_lists").select("id,name,list_type,export_status").eq("account_id", accountId).order("created_at", { ascending: false }).limit(12)
        ]);
        const { data: loadedOpportunities } = await supabase
            .from("opportunities")
            .select("id,category,title,location_text,intent_score,confidence,created_at")
            .eq("account_id", accountId)
            .order("created_at", { ascending: false })
            .limit(30);
        leadRows = leads || [];
        jobRows = jobs || [];
        opportunities = loadedOpportunities || [];
        prospects = loadedProspects || [];
        referralPartners = loadedPartners || [];
        outboundLists = loadedLists || [];
        settings = loadedSettings;
        const leadIds = leadRows.map((l) => String(l.id));
        let scoreMap = {};
        if (leadIds.length > 0) {
            const { data: signals } = await supabase.from("lead_intent_signals").select("lead_id,score").in("lead_id", leadIds);
            scoreMap = (signals || []).reduce((acc, row) => {
                const key = String(row.lead_id);
                if (!acc[key])
                    acc[key] = [];
                acc[key].push(Number(row.score) || 0);
                return acc;
            }, {});
        }
        enrichedLeads = leadRows.map((lead) => {
            const values = scoreMap[String(lead.id)] || [];
            const intent = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
            return { ...lead, intent };
        });
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const highIntent = enrichedLeads.filter((l) => l.intent >= 75 && l.status !== "won" && l.status !== "lost").length;
    const scheduledToday = jobRows.filter((j) => j.scheduled_for && new Date(j.scheduled_for) >= startOfDay).length;
    const jobsNextSeven = jobRows.filter((j) => j.scheduled_for && new Date(j.scheduled_for) >= new Date() && new Date(j.scheduled_for) <= nextWeek).length;
    const weeklyRevenue = jobRows
        .filter((j) => j.scheduled_for && new Date(j.scheduled_for) >= new Date() && new Date(j.scheduled_for) <= nextWeek)
        .reduce((sum, j) => sum + Number(j.estimated_value || 0), 0);
    const nextUp = jobRows
        .filter((j) => j.scheduled_for && new Date(j.scheduled_for) >= new Date())
        .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
        .slice(0, 5);
    const lat = settings?.weather_lat != null ? Number(settings.weather_lat) : null;
    const lng = settings?.weather_lng != null ? Number(settings.weather_lng) : null;
    const weatherLabel = settings?.weather_location_label
        ? String(settings.weather_location_label)
        : [settings?.home_base_city, settings?.home_base_state].filter(Boolean).join(", ");
    let weatherHighRisk = false;
    let weatherActionText = "Conditions stable. Focus on scheduled jobs and high-intent callbacks.";
    if (lat != null && lng != null) {
        try {
            const forecast = await (0, weather_1.getForecastByLatLng)(lat, lng);
            const precip = forecast.current.precipitationChance ?? 0;
            const wind = forecast.current.windKph ?? 0;
            const nextWet = forecast.next6Hours.some((h) => h.precipChance >= 45);
            weatherHighRisk = precip >= 55 || wind >= 30 || nextWet;
            if (weatherHighRisk) {
                weatherActionText = "Storm/high-wind pressure expected. Launch Storm Response scan and pre-book emergency slots.";
            }
        }
        catch {
            weatherHighRisk = false;
        }
    }
    const openJobs = jobRows.filter((j) => !["WON", "LOST", "COMPLETED"].includes(String(j.pipeline_status))).length;
    const syncedLists = outboundLists.filter((item) => String(item.export_status) === "synced").length;
    const priorityLeads = [...enrichedLeads]
        .filter((lead) => !["won", "lost"].includes(String(lead.status || "").toLowerCase()))
        .sort((a, b) => Number(b.intent || 0) - Number(a.intent || 0))
        .slice(0, 5);
    return (<div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-brand-500/25 bg-[linear-gradient(120deg,rgba(216,239,229,0.85),rgba(255,255,255,0.9))] px-5 py-6 shadow-[0_24px_64px_rgba(25,112,77,0.12)] sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-100/65 blur-3xl"/>
        <div className="relative grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Opportunities Near You</p>
            <h1 className="dashboard-page-title mt-2 text-semantic-text">Find and claim jobs before your competitors.</h1>
            <p className="mt-3 text-base text-semantic-muted">
              {demoMode
            ? "Demo-ready Scanner and Weather signals using saved service-area data. Try storm response in Brentwood, Hauppauge, or Midtown."
            : "Scanner intelligence aligned to your saved service area. Run weather-led scans and route urgent opportunities first."}
            </p>
            <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <link_1.default href="/dashboard/scanner">
                <button_1.Button size="lg" fullWidth>Run Scanner</button_1.Button>
              </link_1.default>
              <link_1.default href="/dashboard/leads">
                <button_1.Button size="lg" variant="secondary" fullWidth>Open Leads</button_1.Button>
              </link_1.default>
              <link_1.default href="/dashboard/pipeline">
                <button_1.Button size="lg" variant="secondary" fullWidth>Open Pipeline</button_1.Button>
              </link_1.default>
            </div>
          </div>

          <div className="space-y-3 rounded-[1.4rem] border border-semantic-border/65 bg-white/75 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Dispatch Focus</p>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-semantic-text">
              <lucide_react_1.TriangleAlert className={`h-4 w-4 ${weatherHighRisk ? "text-warning-500" : "text-brand-600"}`}/>
              {weatherHighRisk ? "Weather pressure is building" : "Normal operating window"}
            </p>
            <p className="text-sm text-semantic-muted">{weatherActionText}</p>
            <div className="flex flex-wrap gap-2">
              <link_1.default href="/dashboard/scanner">
                <button_1.Button size="sm">Start high-priority scan</button_1.Button>
              </link_1.default>
              <link_1.default href="/dashboard/schedule">
                <button_1.Button size="sm" variant="secondary">Open schedule</button_1.Button>
              </link_1.default>
            </div>
            <div className="pt-2">
              <weather_ticker_1.WeatherTicker lat={lat} lng={lng} compact locationLabel={weatherLabel}/>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <page_header_1.PageHeader title="Dispatch Dashboard" subtitle="See the jobs, know the pressure, and move the next call forward." actions={<badge_1.Badge variant="brand">Booked-job focus</badge_1.Badge>}/>
      </div>

      <section className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SnapshotStat label="Open jobs" value={String(openJobs)} helper="Jobs still in play"/>
        <SnapshotStat label="Scheduled today" value={String(scheduledToday)} helper="Visits on the board"/>
        <SnapshotStat label="High intent" value={String(highIntent)} helper="Leads to call first"/>
        <SnapshotStat label="Week revenue" value={`$${Math.round(weeklyRevenue).toLocaleString()}`} helper="Booked this week"/>
        <SnapshotStat label="Next 7 days" value={String(jobsNextSeven)} helper="Jobs scheduled ahead"/>
        <SnapshotStat label="Prospects" value={String(prospects.length)} helper="Outbound-ready records"/>
        <SnapshotStat label="Partners" value={String(referralPartners.length)} helper="Referral relationships"/>
        <SnapshotStat label="Lists" value={String(outboundLists.length)} helper="Target lists built"/>
        <SnapshotStat label="Synced lists" value={String(syncedLists)} helper="Automation health"/>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <card_1.Card className="flex-1">
          <card_1.CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="dashboard-section-title text-semantic-text">Opportunity Feed</h2>
              <link_1.default href="/dashboard/scanner">
                <button_1.Button size="sm" variant="secondary">Open Scanner</button_1.Button>
              </link_1.default>
            </div>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-3">
            {(opportunities || []).slice(0, 6).map((item) => (<link_1.default key={item.id} href="/dashboard/scanner" className="block rounded-[1.2rem] border border-semantic-border/65 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-semantic-text">{item.title}</p>
                    <p className="mt-1 text-sm text-semantic-muted">{item.location_text || "Service area"}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                      {item.category} opportunity
                    </p>
                    <p className="mt-1 text-xs text-semantic-muted">Open Scanner to create a lead, assign follow-up, or schedule the inspection.</p>
                  </div>
                  <badge_1.Badge variant={Number(item.intent_score) >= 75 ? "warning" : "default"}>
                    {Number(item.intent_score) || 0}
                  </badge_1.Badge>
                </div>
              </link_1.default>))}
            {(opportunities || []).length === 0 && (<div className="rounded-xl border border-dashed border-semantic-border bg-semantic-surface2/70 p-4">
                <p className="text-sm font-semibold text-semantic-text">Run the Lead Scanner to generate opportunities.</p>
                <p className="mt-1 text-sm text-semantic-muted">Weather and service-demand signals will appear here once the first scan is complete.</p>
              </div>)}
          </card_1.CardBody>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="dashboard-section-title text-semantic-text">Priority Queue</h2>
              <link_1.default href="/dashboard/leads" className="text-sm font-semibold text-brand-700">
                Open leads
              </link_1.default>
            </div>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-3">
            {priorityLeads.length === 0 && (<div className="rounded-xl border border-dashed border-semantic-border bg-semantic-surface2/70 p-4">
                <p className="text-sm font-semibold text-semantic-text">No active lead queue yet.</p>
                <p className="mt-1 text-sm text-semantic-muted">Run the scanner and claim opportunities to fill your call list.</p>
              </div>)}
            {priorityLeads.map((lead) => (<link_1.default key={lead.id} href={`/dashboard/leads/${lead.id}`} className="block rounded-xl border border-semantic-border/70 p-4 transition hover:border-brand-300 hover:bg-brand-50/35">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-semantic-text">{lead.name || "Unknown lead"}</p>
                    <p className="text-sm text-semantic-muted">
                      {lead.service_type || "Service"} · {[lead.city, lead.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <badge_1.Badge variant={Number(lead.intent || 0) >= 75 ? "warning" : "default"}>{Number(lead.intent || 0)}%</badge_1.Badge>
                </div>
                <p className="mt-2 text-sm text-semantic-muted">{lead.scheduled_for ? `Scheduled ${formatScheduled(lead.scheduled_for)}` : "Needs first contact"}</p>
              </link_1.default>))}

            <div className="rounded-xl border border-semantic-border/65 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Next scheduled jobs</p>
              <div className="mt-2 space-y-2">
                {nextUp.length === 0 && <p className="text-sm text-semantic-muted">No booked visits yet for the next window.</p>}
                {nextUp.map((job) => (<link_1.default key={job.id} href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-semantic-surface2">
                    <span className="text-sm font-medium text-semantic-text">{job.customer_name || "Unknown customer"}</span>
                    <span className="inline-flex items-center text-xs text-semantic-muted">
                      {formatScheduled(job.scheduled_for)}
                      <lucide_react_1.ChevronRight className="ml-1 h-4 w-4"/>
                    </span>
                  </link_1.default>))}
              </div>
            </div>
          </card_1.CardBody>
        </card_1.Card>
      </section>
    </div>);
}
function formatScheduled(date) {
    return new Date(date).toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}
function SnapshotStat({ label, value, helper }) {
    return (<div className="min-w-[188px] shrink-0 rounded-[1.1rem] border border-semantic-border/70 bg-white/72 px-4 py-3 shadow-[0_10px_26px_rgba(31,42,36,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-semantic-text">{value}</p>
      <p className="text-xs text-semantic-muted">{helper}</p>
    </div>);
}
