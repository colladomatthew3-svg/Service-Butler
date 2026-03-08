import Link from "next/link";
import {
  ChevronRight,
  TriangleAlert
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { WeatherTicker } from "@/components/dashboard/weather-ticker";
import { getForecastByLatLng } from "@/lib/services/weather";
import { getDemoDashboardSnapshot, getDemoWeatherSettings } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

type DashboardLeadRow = {
  id: string;
  name?: string | null;
  service_type?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  requested_timeframe?: string | null;
  created_at: string;
  scheduled_for?: string | null;
  intent?: number;
  intentScore?: number;
};

type DashboardJobRow = {
  id: string;
  pipeline_status?: string | null;
  scheduled_for?: string | null;
  estimated_value?: number | null;
  service_type?: string | null;
  customer_name?: string | null;
  city?: string | null;
  state?: string | null;
  intent_score?: number | null;
};

type DashboardOpportunityRow = {
  id: string;
  category?: string | null;
  title?: string | null;
  location_text?: string | null;
  intent_score?: number | null;
  confidence?: number | null;
  created_at: string;
};

type DashboardOutboundRow = {
  id: string;
  name?: string | null;
  list_type?: string | null;
  export_status?: string | null;
};

export default async function DashboardOverviewPage() {
  const demoMode = isDemoMode();
  let leadRows: DashboardLeadRow[] = [];
  let jobRows: DashboardJobRow[] = [];
  let opportunities: DashboardOpportunityRow[] = [];
  let prospects: Array<{ id: string }> = [];
  let referralPartners: Array<{ id: string }> = [];
  let outboundLists: DashboardOutboundRow[] = [];
  let enrichedLeads: Array<DashboardLeadRow & { intent: number }> = [];
  let settings:
    | {
        weather_lat?: number | null;
        weather_lng?: number | null;
        weather_location_label?: string | null;
        home_base_city?: string | null;
        home_base_state?: string | null;
      }
    | null = null;

  if (demoMode) {
    const snapshot = getDemoDashboardSnapshot();
    const weather = await getDemoWeatherSettings();

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
  } else {
    const { accountId, supabase } = await getCurrentUserContext();

    const [{ data: leads }, { data: loadedSettings }, { data: jobs }, { data: loadedProspects }, { data: loadedPartners }, { data: loadedLists }] =
      await Promise.all([
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
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        ,
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
    let scoreMap: Record<string, number[]> = {};
    if (leadIds.length > 0) {
      const { data: signals } = await supabase.from("lead_intent_signals").select("lead_id,score").in("lead_id", leadIds);
      scoreMap = (signals || []).reduce<Record<string, number[]>>((acc, row) => {
        const key = String(row.lead_id);
        if (!acc[key]) acc[key] = [];
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
  const scheduledToday = jobRows.filter((j) => j.scheduled_for && new Date(j.scheduled_for as string) >= startOfDay).length;
  const jobsNextSeven = jobRows.filter(
    (j) => j.scheduled_for && new Date(j.scheduled_for as string) >= new Date() && new Date(j.scheduled_for as string) <= nextWeek
  ).length;

  const weeklyRevenue = jobRows
    .filter((j) => j.scheduled_for && new Date(j.scheduled_for as string) >= new Date() && new Date(j.scheduled_for as string) <= nextWeek)
    .reduce((sum, j) => sum + Number(j.estimated_value || 0), 0);

  const nextUp = jobRows
    .filter((j) => j.scheduled_for && new Date(j.scheduled_for as string) >= new Date())
    .sort((a, b) => new Date(a.scheduled_for as string).getTime() - new Date(b.scheduled_for as string).getTime())
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
      const forecast = await getForecastByLatLng(lat, lng);
      const precip = forecast.current.precipitationChance ?? 0;
      const wind = forecast.current.windKph ?? 0;
      const nextWet = forecast.next6Hours.some((h) => h.precipChance >= 45);
      weatherHighRisk = precip >= 55 || wind >= 30 || nextWet;
      if (weatherHighRisk) {
        weatherActionText = "Storm/high-wind pressure expected. Launch Storm Response scan and pre-book emergency slots.";
      }
    } catch {
      weatherHighRisk = false;
    }
  }

  const openJobs = jobRows.filter((j) => !["WON", "LOST", "COMPLETED"].includes(String(j.pipeline_status))).length;
  const syncedLists = outboundLists.filter((item) => String(item.export_status) === "synced").length;

  return (
    <div className="space-y-8">
      <Card className="border-brand-500/25 bg-brand-50/50">
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Opportunities Near You</p>
            <h1 className="dashboard-page-title mt-1 text-semantic-text">Find and claim jobs before your competitors.</h1>
            <p className="mt-2 text-sm text-semantic-muted">
              {demoMode
                ? "Demo-ready Scanner and Weather signals using saved service-area data. Try storm response in Brentwood, Hauppauge, or Midtown."
                : "Scanner intelligence across Long Island and NYC. Focus zip seeds: 11705, 11788, 10019."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/scanner">
              <Button size="lg">Run Scanner</Button>
            </Link>
            <Link href="/dashboard/leads">
              <Button size="lg" variant="secondary">Open Leads</Button>
            </Link>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px] lg:items-start">
        <PageHeader
          title="Dispatch Dashboard"
          subtitle="See the jobs, know the pressure, and move the next call forward."
          actions={<Badge variant="brand">Scanner first</Badge>}
        />
        <div className="lg:pt-1">
          <WeatherTicker lat={lat} lng={lng} compact locationLabel={weatherLabel} />
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Today At A Glance</h2>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotStat label="Open jobs" value={String(openJobs)} helper="Jobs still in play" />
            <SnapshotStat label="Scheduled today" value={String(scheduledToday)} helper="Visits on the board" />
            <SnapshotStat label="High intent" value={String(highIntent)} helper="Leads to call first" />
            <SnapshotStat label="Week revenue" value={`$${Math.round(weeklyRevenue).toLocaleString()}`} helper="Booked this week" />
            <SnapshotStat label="Next 7 days" value={String(jobsNextSeven)} helper="Jobs scheduled ahead" />
            <SnapshotStat label="Prospects" value={String(prospects.length)} helper="Outbound-ready records" />
            <SnapshotStat label="Partners" value={String(referralPartners.length)} helper="Referral relationships" />
            <SnapshotStat label="Lists" value={String(outboundLists.length)} helper="Target lists built" />
            <SnapshotStat label="Smartlead synced" value={String(syncedLists)} helper="Lists pushed out" />
          </CardBody>
        </Card>

        <Card className={weatherHighRisk ? "border-warning-500/30" : ""}>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">What To Do Next</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-semantic-text">
              <TriangleAlert className={`h-4 w-4 ${weatherHighRisk ? "text-warning-500" : "text-brand-600"}`} />
              {weatherHighRisk ? "Weather pressure is building" : "Normal operating window"}
            </p>
            <p className="text-sm text-semantic-muted">{weatherActionText}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/scanner${weatherLabel ? `?location=${encodeURIComponent(weatherLabel)}` : ""}`}>
                <Button size="sm">Run scanner now</Button>
              </Link>
              <Link href="/dashboard/leads">
                <Button size="sm" variant="secondary">Work new leads</Button>
              </Link>
              <Link href="/dashboard/schedule">
                <Button size="sm" variant="secondary">Open schedule</Button>
              </Link>
              <Link href="/dashboard/outbound">
                <Button size="sm" variant="secondary">Open outbound</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="dashboard-section-title text-semantic-text">Opportunity Feed</h2>
              <Link href="/dashboard/scanner">
                <Button size="sm" variant="secondary">Open Scanner</Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {(opportunities || []).slice(0, 6).map((item) => (
              <Link key={item.id} href="/dashboard/scanner" className="block rounded-xl border border-semantic-border bg-semantic-surface2 p-4 transition hover:border-brand-300 hover:bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-semantic-text">{item.title}</p>
                    <p className="mt-1 text-sm text-semantic-muted">{item.location_text || "Service area"}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                      {item.category} opportunity
                    </p>
                    <p className="mt-1 text-xs text-semantic-muted">Open Scanner to create a lead, assign follow-up, or schedule the inspection.</p>
                  </div>
                  <Badge variant={Number(item.intent_score) >= 75 ? "warning" : "default"}>
                    {Number(item.intent_score) || 0}
                  </Badge>
                </div>
              </Link>
            ))}
            {(opportunities || []).length === 0 && (
              <div className="rounded-xl border border-dashed border-semantic-border bg-semantic-surface2 p-4">
                <p className="text-sm font-semibold text-semantic-text">Run the Lead Scanner to generate opportunities.</p>
                <p className="mt-1 text-sm text-semantic-muted">Weather and service-demand signals will appear here once the first scan is complete.</p>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="dashboard-section-title text-semantic-text">Next Up</h2>
              <Link href="/dashboard/schedule" className="text-sm font-semibold text-brand-700">
                Open schedule
              </Link>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {nextUp.length === 0 && (
              <div className="rounded-xl border border-dashed border-semantic-border bg-semantic-surface2 p-4">
                <p className="text-sm font-semibold text-semantic-text">Convert a lead into a job to populate your calendar.</p>
                <p className="mt-1 text-sm text-semantic-muted">Once work is booked, the next scheduled visits will show up here for dispatch.</p>
              </div>
            )}
            {nextUp.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="block rounded-xl border border-semantic-border p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-semantic-text">{job.customer_name || "Unknown customer"}</p>
                    <p className="text-sm text-semantic-muted">
                      {job.service_type || "Service"} · {[job.city, job.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <Badge variant={Number(job.intent_score) >= 75 ? "warning" : "default"}>{Number(job.intent_score) || 0}%</Badge>
                </div>
                <p className="mt-2 inline-flex items-center text-sm text-semantic-muted">
                  {formatScheduled(job.scheduled_for as string)}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </p>
              </Link>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function formatScheduled(date: string) {
  return new Date(date).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function SnapshotStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-semantic-text">{value}</p>
      <p className="mt-1 text-sm text-semantic-muted">{helper}</p>
    </div>
  );
}
