import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, MessageSquare, PhoneCall, StickyNote } from "lucide-react";
import { findLeadById } from "@/lib/mock/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default async function LeadDetailMockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = findLeadById(id);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        subtitle={`${lead.serviceType} · ${lead.location}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="lg">
              <PhoneCall className="h-4 w-4" />
              Call Lead
            </Button>
            <Button size="lg" variant="secondary">
              <MessageSquare className="h-4 w-4" />
              Send SMS
            </Button>
            <Button size="lg" variant="secondary">
              <CalendarPlus className="h-4 w-4" />
              Schedule Job
            </Button>
          </div>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900">Timeline</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {lead.timeline.map((item) => (
              <div key={`${item.time}-${item.label}`} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-neutral-900">{item.label}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{item.time}</p>
                </div>
                <p className="mt-2 text-sm text-neutral-700">{item.detail}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-neutral-900">Lead Snapshot</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-neutral-700">
              <div className="flex items-center justify-between gap-2">
                <span>Status</span>
                <Badge variant="brand">{lead.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Urgency</span>
                <Badge variant={lead.urgency === "HIGH" ? "danger" : lead.urgency === "MEDIUM" ? "warning" : "default"}>
                  {lead.urgency}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Phone</span>
                <span className="font-medium text-neutral-900">{lead.phone}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Last contact</span>
                <span className="font-medium text-neutral-900">{lead.lastContact}</span>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Next step</p>
                <p className="mt-1 font-semibold text-neutral-900">{lead.nextStep}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-neutral-900">Notes</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <ul className="space-y-2">
                {lead.notes.map((note) => (
                  <li key={note} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    {note}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">Add note</label>
                <Textarea rows={4} placeholder="Type important details for dispatch or tech..." />
                <Button fullWidth variant="secondary">
                  <StickyNote className="h-4 w-4" />
                  Save Note
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>

      <Link href="/dashboard/leads" className="inline-block">
        <Button variant="ghost">Back to Lead Inbox</Button>
      </Link>
    </div>
  );
}
