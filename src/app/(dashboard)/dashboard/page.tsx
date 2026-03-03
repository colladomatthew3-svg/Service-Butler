import Link from "next/link";
import { BellRing, CalendarCheck, MessageSquareWarning, Star, PhoneCall, MessageSquare, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockLeads } from "@/lib/mock/dashboard";

export default function DashboardOverviewPage() {
  const preview = mockLeads.slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Start with the highest-value actions and keep your team moving."
        actions={<Badge variant="brand">Live mock workspace</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="New Leads Today" value={12} icon={<BellRing className="h-5 w-5" />} tone="brand" />
        <StatTile label="Jobs Scheduled" value={9} icon={<CalendarCheck className="h-5 w-5" />} tone="success" />
        <StatTile label="Unanswered Messages" value={5} icon={<MessageSquareWarning className="h-5 w-5" />} tone="warning" />
        <StatTile label="Reviews Needed" value={3} icon={<Star className="h-5 w-5" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900">Next Actions</h2>
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
            <Button size="lg" variant="secondary" className="justify-start">
              <CalendarCheck className="h-5 w-5" />
              Confirm tomorrow jobs
            </Button>
            <Button size="lg" variant="secondary" className="justify-start">
              <ClipboardCheck className="h-5 w-5" />
              Request reviews
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900">Lead Queue Preview</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {preview.map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="block rounded-xl border border-semantic-border p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-semantic-text">{lead.name}</p>
                    <p className="text-sm text-semantic-muted">
                      {lead.serviceType} · {lead.location}
                    </p>
                  </div>
                  <Badge variant={lead.urgency === "HIGH" ? "danger" : lead.urgency === "MEDIUM" ? "warning" : "default"}>
                    {lead.urgency}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-semantic-muted">Next: {lead.nextStep}</p>
              </Link>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
