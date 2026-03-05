import Link from "next/link";
import {
  CalendarCheck,
  Gauge,
  PhoneCall,
  MessageSquare,
  ClipboardCheck,
  ChevronRight,
  DollarSign,
  KanbanSquare,
  TriangleAlert
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { WeatherTicker } from "@/components/dashboard/weather-ticker";
import { getForecastByLatLng } from "@/lib/services/weather";

const pipelineColumns = ["NEW", "CONTACTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "WON", "LOST"] as const;

export default async function DashboardOverviewPage() {
  const { accountId, supabase } = await getCurrentUserContext();

  const [{ data: leads }, { data: settings }, { data: jobs }] = await Promise.all([
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
  ]);

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id,category,title,location_text,intent_score,confidence,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(30);

  const leadRows = leads || [];
  const jobRows = jobs || [];

  const leadIds = leadRows.map((l) => l.id as string);
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

  const enrichedLeads = leadRows.map((lead) => {
    const values = scoreMap[String(lead.id)] || [];
    const intent = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    return { ...lead, intent };
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const newToday = enrichedLeads.filter((l) => new Date(l.created_at as string) >= startOfDay).length;
  const highIntent = enrichedLeads.filter((l) => l.intent >= 75 && l.status !== "won" && l.status !== "lost").length;
  const scheduledToday = jobRows.filter((j) => j.scheduled_for && new Date(j.scheduled_for as string) >= startOfDay).length;
  const jobsNextSeven = jobRows.filter(
    (j) => j.scheduled_for && new Date(j.scheduled_for as string) >= new Date() && new Date(j.scheduled_for as string) <= nextWeek
  ).length;

  const weeklyRevenue = jobRows
    .filter((j) => j.scheduled_for && new Date(j.scheduled_for as string) >= new Date() && new Date(j.scheduled_for as string) <= nextWeek)
    .reduce((sum, j) => sum + Number(j.estimated_value || 0), 0);

  const won = jobRows.filter((j) => j.pipeline_status === "WON").length;
  const lost = jobRows.filter((j) => j.pipeline_status === "LOST").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

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

  const pipelineCounts = pipelineColumns.reduce<Record<string, number>>((acc, col) => {
    acc[col] = jobRows.filter((job) => job.pipeline_status === col).length;
    return acc;
  }, {});

  const zipDemand = (opportunities || []).reduce<Record<string, { count: number; avgIntent: number }>>((acc, row) => {
    const match = String(row.location_text || "").match(/\b\d{5}\b/);
    const zip = match?.[0] || "Unknown";
    if (!acc[zip]) acc[zip] = { count: 0, avgIntent: 0 };
    acc[zip].count += 1;
    acc[zip].avgIntent += Number(row.intent_score || 0);
    return acc;
  }, {});
  const heatRows = Object.entries(zipDemand)
    .map(([zip, value]) => ({
      zip,
      count: value.count,
      avgIntent: Math.round(value.avgIntent / Math.max(1, value.count))
    }))
    .sort((a, b) => b.count - a.count || b.avgIntent - a.avgIntent)
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <Card className="border-brand-500/25 bg-brand-50/50">
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Opportunities Near You</p>
            <h1 className="dashboard-page-title mt-1 text-semantic-text">Find and claim jobs before your competitors.</h1>
            <p className="mt-2 text-sm text-semantic-muted">
              Scanner intelligence across Long Island and NYC. Focus zip seeds: 11705, 11788, 10019.
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
          subtitle="Where are the jobs, what to do next, and who to contact first."
          actions={<Badge variant="brand">Live ops view</Badge>}
        />
        <div className="lg:pt-1">
          <WeatherTicker lat={lat} lng={lng} compact locationLabel={weatherLabel} />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Open Jobs" value={jobRows.filter((j) => !["WON", "LOST", "COMPLETED"].includes(String(j.pipeline_status))).length} icon={<KanbanSquare className="h-5 w-5" />} tone="brand" />
        <StatTile label="Scheduled Today" value={scheduledToday} icon={<CalendarCheck className="h-5 w-5" />} tone="success" />
        <StatTile label="Revenue This Week" value={`$${Math.round(weeklyRevenue).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} tone="warning" />
        <StatTile label="Win Rate" value={`${winRate}%`} icon={<Gauge className="h-5 w-5" />} />
      </section>

      <Card>
        <CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Quick Actions</h2>
        </CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/scanner">
            <Button size="lg" fullWidth>Claim Opportunity</Button>
          </Link>
          <Link href="/dashboard/leads">
            <Button size="lg" variant="secondary" fullWidth>Call New Leads</Button>
          </Link>
          <Link href="/dashboard/pipeline">
            <Button size="lg" variant="secondary" fullWidth>Move Pipeline</Button>
          </Link>
          <Link href="/dashboard/schedule">
            <Button size="lg" variant="secondary" fullWidth>Review Schedule</Button>
          </Link>
        </CardBody>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Pipeline Snapshot</h2>
          </CardHeader>
          <CardBody>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pipelineColumns.map((col) => (
                <Link key={col} href="/dashboard/pipeline" className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3 transition hover:border-brand-300">
                  <p className="text-xs font-semibold uppercase tracking-wide text-semantic-muted">{col === "IN_PROGRESS" ? "In Progress" : col.toLowerCase()}</p>
                  <p className="mt-1 text-xl font-semibold text-semantic-text">{pipelineCounts[col]}</p>
                </Link>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/dashboard/pipeline">
                <Button variant="secondary">Open full pipeline</Button>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card className={weatherHighRisk ? "border-warning-500/30" : ""}>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Weather Impact</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-semantic-text">
              <TriangleAlert className={`h-4 w-4 ${weatherHighRisk ? "text-warning-500" : "text-brand-600"}`} />
              {weatherHighRisk ? "High weather pressure" : "Normal pressure"}
            </p>
            <p className="text-sm text-semantic-muted">{weatherActionText}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/scanner${weatherLabel ? `?location=${encodeURIComponent(weatherLabel)}` : ""}`}>
                <Button size="sm">Generate Leads</Button>
              </Link>
              <Link href="/campaigns">
                <Button size="sm" variant="secondary">Storm Response Campaign</Button>
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
              <Link key={item.id} href="/dashboard/scanner" className="block rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-semantic-text">{item.title}</p>
                    <p className="text-sm text-semantic-muted">{item.category} · {item.location_text || "Service area"}</p>
                  </div>
                  <Badge variant={Number(item.intent_score) >= 75 ? "warning" : "default"}>
                    {Number(item.intent_score) || 0}
                  </Badge>
                </div>
              </Link>
            ))}
            {(opportunities || []).length === 0 && (
              <p className="text-sm text-semantic-muted">No opportunities yet. Run a scanner sweep to detect jobs.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Demand Heat Map</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {heatRows.map((row) => (
              <div key={row.zip} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-semantic-text">ZIP {row.zip}</p>
                  <span className="text-sm font-semibold text-semantic-text">{row.count} signals</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-semantic-border">
                  <div
                    className="h-2 rounded-full bg-semantic-brand"
                    style={{ width: `${Math.max(12, Math.min(100, row.avgIntent))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-semantic-muted">Avg intent {row.avgIntent}</p>
              </div>
            ))}
            {heatRows.length === 0 && (
              <p className="text-sm text-semantic-muted">Heat map will populate after opportunities are captured.</p>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Next Actions</h2>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="justify-start">
              <PhoneCall className="h-5 w-5" />
              Return missed calls
            </Button>
            <Button size="lg" variant="secondary" className="justify-start">
              <MessageSquare className="h-5 w-5" />
              Send follow-ups
            </Button>
            <Link href="/dashboard/schedule">
              <Button size="lg" variant="secondary" className="w-full justify-start">
                <CalendarCheck className="h-5 w-5" />
                Confirm tomorrow jobs
              </Button>
            </Link>
            <Button size="lg" variant="secondary" className="justify-start">
              <ClipboardCheck className="h-5 w-5" />
              Request reviews
            </Button>
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
            {nextUp.length === 0 && <p className="text-sm text-semantic-muted">No jobs scheduled. Convert a lead and set a slot.</p>}
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

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-semantic-muted">New leads today</p>
            <p className="mt-1 text-2xl font-semibold text-semantic-text">{newToday}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-semantic-muted">High intent leads</p>
            <p className="mt-1 text-2xl font-semibold text-semantic-text">{highIntent}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-semantic-muted">Jobs next 7 days</p>
            <p className="mt-1 text-2xl font-semibold text-semantic-text">{jobsNextSeven}</p>
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
