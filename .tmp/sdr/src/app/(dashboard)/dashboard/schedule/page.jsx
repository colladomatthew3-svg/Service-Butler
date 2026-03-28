"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SchedulePage;
const lucide_react_1 = require("lucide-react");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const tabs_1 = require("@/components/ui/tabs");
const empty_state_1 = require("@/components/ui/empty-state");
const rbac_1 = require("@/lib/auth/rbac");
async function SchedulePage() {
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: leads } = await supabase
        .from("leads")
        .select("id,name,service_type,city,state,scheduled_for,status")
        .eq("account_id", accountId)
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true });
    const groups = (leads || []).reduce((acc, lead) => {
        const day = new Date(lead.scheduled_for).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric"
        });
        if (!acc[day])
            acc[day] = [];
        acc[day].push(lead);
        return acc;
    }, {});
    return (<div className="space-y-6">
      <page_header_1.PageHeader title="Schedule" subtitle="Keep your crew booked, visible, and on time."/>
      <tabs_1.Tabs items={[
            { href: "/dashboard/schedule", label: "List View", active: true },
            { href: "/dashboard/schedule?view=calendar", label: "Calendar View" }
        ]}/>

      <card_1.Card>
        <card_1.CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Upcoming Scheduled Leads</h2>
        </card_1.CardHeader>
        <card_1.CardBody className="space-y-4">
          {Object.keys(groups).length === 0 && (<empty_state_1.EmptyState icon={<lucide_react_1.CalendarClock className="h-5 w-5"/>} title="No scheduled jobs yet" description="Convert a lead into a job to populate your calendar and give dispatch a real schedule to work from." ctaLabel="Open Lead Inbox" ctaHref="/dashboard/leads"/>)}
          {Object.entries(groups).map(([day, items]) => (<div key={day} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-semantic-muted">{day}</h3>
              {items.map((lead) => (<article key={lead.id} className="rounded-xl border border-semantic-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-semantic-text">{lead.name || "Unknown lead"}</p>
                      <p className="text-sm text-semantic-muted">{lead.service_type || "Service"}</p>
                    </div>
                    <badge_1.Badge variant={lead.status === "won" ? "success" : lead.status === "lost" ? "danger" : "brand"}>
                      {lead.status}
                    </badge_1.Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-semantic-muted sm:grid-cols-2">
                    <p className="inline-flex items-center gap-2">
                      <lucide_react_1.CalendarClock className="h-4 w-4 text-semantic-muted"/>
                      {new Date(lead.scheduled_for).toLocaleString("en-US", {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit"
                })}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <lucide_react_1.Truck className="h-4 w-4 text-semantic-muted"/>
                      Dispatch ready
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-semantic-muted">{[lead.city, lead.state].filter(Boolean).join(", ")}</p>
                </article>))}
            </div>))}
        </card_1.CardBody>
      </card_1.Card>
    </div>);
}
