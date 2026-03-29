import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarDays, Clock3, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoDashboardSnapshot } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

type ScheduledLeadRow = {
  id: string;
  name?: string | null;
  service_type?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
};

export default async function SchedulePage() {
  const leads: ScheduledLeadRow[] = isDemoMode()
    ? getDemoDashboardSnapshot().leads
        .filter((lead) => Boolean(lead.scheduled_for))
        .map((lead) => ({
          id: lead.id,
          name: lead.name,
          service_type: lead.service_type,
          city: lead.city,
          state: lead.state,
          status: lead.status,
          scheduled_for: lead.scheduled_for
        }))
    : await loadScheduledLeads();

  const groups = leads.reduce<Record<string, ScheduledLeadRow[]>>((acc, lead) => {
    const day = new Date(lead.scheduled_for as string).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(lead);
    return acc;
  }, {});

  const scheduledLeads = leads || [];
  const upcomingDays = Object.keys(groups).length;
  const nextSlot = scheduledLeads[0]?.scheduled_for ? formatScheduleTime(scheduledLeads[0].scheduled_for as string) : null;
  const serviceMix = Array.from(
    new Set(
      scheduledLeads
        .map((lead) => lead.service_type)
        .filter((service): service is string => Boolean(service))
    )
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" subtitle="Keep your crew booked, visible, and on time." />

      <section className="overflow-hidden rounded-[1.75rem] border border-semantic-border/60 bg-white/72 shadow-[0_18px_60px_rgba(31,42,36,0.08)]">
        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1.4fr_1fr] lg:px-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-800">
              <CalendarDays className="h-3.5 w-3.5" />
              Dispatch calendar
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-semantic-text sm:text-3xl">A cleaner view of what is on the board today.</h2>
              <p className="max-w-2xl text-sm text-semantic-muted sm:text-base">
                Track scheduled work, keep the crew aligned, and jump into the right lead before the appointment window closes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/leads">
                <Button size="sm" variant="secondary">
                  Open Lead Inbox
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard/jobs">
                <Button size="sm" variant="secondary">
                  Open Jobs
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard/pipeline">
                <Button size="sm" variant="secondary">
                  Review Pipeline
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <MiniStat label="Scheduled" value={scheduledLeads.length.toString()} helper="Booked visits on the board" />
            <MiniStat label="Days covered" value={upcomingDays.toString()} helper="Distinct dispatch days" />
            <MiniStat
              label="Next slot"
              value={nextSlot || "—"}
              helper={serviceMix.length ? `${serviceMix.slice(0, 2).join(" · ")}${serviceMix.length > 2 ? " +" : ""}` : "No service mix yet"}
            />
          </div>
        </div>
      </section>

      <Tabs
        items={[
          { href: "/dashboard/schedule", label: "List View", active: true },
          { href: "/dashboard/schedule?view=calendar", label: "Calendar View" }
        ]}
      />

      <Card className="overflow-hidden border-semantic-border/60 bg-white/72 shadow-[0_14px_45px_rgba(31,42,36,0.06)]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="dashboard-section-title text-semantic-text">Upcoming Scheduled Leads</h2>
              <p className="mt-1 text-sm text-semantic-muted">Sorted by time so dispatch can stay ahead of the day.</p>
            </div>
            <p className="inline-flex items-center gap-2 rounded-full border border-semantic-border/70 bg-semantic-surface2/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">
              <Clock3 className="h-3.5 w-3.5" />
              {scheduledLeads.length} scheduled
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {Object.keys(groups).length === 0 && (
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title="No scheduled jobs yet"
              description="Convert a lead into a job to populate your calendar and give dispatch a real schedule to work from."
              ctaLabel="Open Lead Inbox"
              ctaHref="/dashboard/leads"
            />
          )}
          {Object.entries(groups).map(([day, items]) => (
            <section key={day} className="space-y-3 rounded-2xl border border-semantic-border/60 bg-semantic-surface2/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-semantic-muted">{day}</h3>
                <Badge variant="default">{items.length}</Badge>
              </div>
              <div className="grid gap-3">
                {items.map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-2xl border border-semantic-border/70 bg-white/80 p-4 shadow-[0_10px_28px_rgba(31,42,36,0.06)] transition hover:border-semantic-border hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/dashboard/leads/${lead.id}`} className="text-base font-semibold text-semantic-text hover:text-brand-700">
                            {lead.name || "Unknown lead"}
                          </Link>
                          <Badge variant={lead.status === "won" ? "success" : lead.status === "lost" ? "danger" : "brand"}>{lead.status}</Badge>
                        </div>
                        <p className="text-sm text-semantic-muted">{lead.service_type || "Service"}</p>
                      </div>
                      <p className="inline-flex items-center gap-2 rounded-full border border-semantic-border/70 bg-semantic-surface2/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Scheduled
                      </p>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-semantic-muted sm:grid-cols-2">
                      <p className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-semantic-muted" />
                        {formatScheduleTime(lead.scheduled_for as string)}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <Truck className="h-4 w-4 text-semantic-muted" />
                        Dispatch ready
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-semantic-muted">{[lead.city, lead.state].filter(Boolean).join(", ")}</p>
                      <Link href={`/dashboard/leads/${lead.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                        Open lead
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {Object.keys(groups).length > 0 && (
            <p className="text-xs text-semantic-muted">
              Calendar order reflects the next booking windows first so dispatch can work top-down on the day.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-semantic-border/60 bg-white/76 p-4 shadow-[0_8px_24px_rgba(31,42,36,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-semantic-text">{value}</p>
      <p className="mt-1 text-xs text-semantic-muted">{helper}</p>
    </div>
  );
}

function formatScheduleTime(input: string) {
  return new Date(input).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function loadScheduledLeads(): Promise<ScheduledLeadRow[]> {
  const { accountId, supabase } = await getCurrentUserContext();
  const { data } = await supabase
    .from("leads")
    .select("id,name,service_type,city,state,scheduled_for,status")
    .eq("account_id", accountId)
    .not("scheduled_for", "is", null)
    .order("scheduled_for", { ascending: true });

  return (data || []) as ScheduledLeadRow[];
}
