import { CalendarClock, Truck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export default async function SchedulePage() {
  const { accountId, supabase } = await getCurrentUserContext();
  const { data: leads } = await supabase
    .from("leads")
    .select("id,name,service_type,city,state,scheduled_for,status")
    .eq("account_id", accountId)
    .not("scheduled_for", "is", null)
    .order("scheduled_for", { ascending: true });

  type ScheduledLead = NonNullable<typeof leads>[number];
  const groups = (leads || []).reduce<Record<string, ScheduledLead[]>>((acc, lead) => {
    const day = new Date(lead.scheduled_for as string).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(lead);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" subtitle="Keep your crew booked, visible, and on time." />
      <Tabs
        items={[
          { href: "/dashboard/schedule", label: "List View", active: true },
          { href: "/dashboard/schedule?view=calendar", label: "Calendar View" }
        ]}
      />

      <Card>
        <CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Upcoming Scheduled Leads</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {Object.keys(groups).length === 0 && (
            <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-5">
              <p className="text-base font-semibold text-semantic-text">No scheduled jobs yet</p>
              <p className="mt-1 text-sm text-semantic-muted">Open a lead and set a visit time to build this calendar.</p>
              <Link href="/dashboard/leads" className="mt-4 inline-block">
                <Button size="sm">Open Lead Inbox</Button>
              </Link>
            </div>
          )}
          {Object.entries(groups).map(([day, items]) => (
            <div key={day} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-semantic-muted">{day}</h3>
              {items.map((lead) => (
                <article key={lead.id} className="rounded-xl border border-semantic-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-semantic-text">{lead.name || "Unknown lead"}</p>
                      <p className="text-sm text-semantic-muted">{lead.service_type || "Service"}</p>
                    </div>
                    <Badge variant={lead.status === "won" ? "success" : lead.status === "lost" ? "danger" : "brand"}>
                      {lead.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-semantic-muted sm:grid-cols-2">
                    <p className="inline-flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-semantic-muted" />
                      {new Date(lead.scheduled_for as string).toLocaleString("en-US", {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Truck className="h-4 w-4 text-semantic-muted" />
                      Dispatch ready
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-semantic-muted">{[lead.city, lead.state].filter(Boolean).join(", ")}</p>
                </article>
              ))}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
