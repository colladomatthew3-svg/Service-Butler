"use client";

import Link from "next/link";
import { CalendarPlus, Copy, MessageSquare, PhoneCall, StickyNote } from "lucide-react";
import type { Lead } from "@/lib/mock/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export function LeadDetailView({ lead }: { lead: Lead }) {
  const { showToast } = useToast();

  const callAction = () => showToast(`Calling ${lead.name}...`);
  const textAction = () => showToast(`Text composer opened for ${lead.name}`);
  const scheduleAction = () => showToast(`Scheduling ${lead.name}`);
  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(lead.phone);
      showToast("Phone number copied");
    } catch {
      showToast("Could not copy phone number");
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title={lead.name}
        subtitle={`${lead.serviceType} · ${lead.location}`}
        actions={
          <div className="hidden flex-wrap gap-2 md:flex">
            <Button size="lg" onClick={callAction}>
              <PhoneCall className="h-4 w-4" />
              Call Lead
            </Button>
            <Button size="lg" variant="secondary" onClick={textAction}>
              <MessageSquare className="h-4 w-4" />
              Send SMS
            </Button>
            <Button size="lg" variant="secondary" onClick={scheduleAction}>
              <CalendarPlus className="h-4 w-4" />
              Schedule Job
            </Button>
          </div>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-semantic-text">Timeline</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {lead.timeline.map((item) => (
              <div key={`${item.time}-${item.label}`} className="rounded-xl border border-semantic-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-semantic-text">{item.label}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-semantic-muted">{item.time}</p>
                </div>
                <p className="mt-2 text-sm text-semantic-muted">{item.detail}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-semantic-text">Lead Snapshot</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-semantic-muted">
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
                <button
                  type="button"
                  onClick={copyPhone}
                  className="inline-flex items-center gap-1 font-medium text-semantic-text hover:text-brand-700"
                >
                  {lead.phone}
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Last contact</span>
                <span className="font-medium text-semantic-text">{lead.lastContact}</span>
              </div>
              <div className="rounded-xl bg-semantic-surface2 p-3">
                <p className="text-xs uppercase tracking-wide text-semantic-muted">Next step</p>
                <p className="mt-1 font-semibold text-semantic-text">{lead.nextStep}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-semantic-text">Notes</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <ul className="space-y-2">
                {lead.notes.map((note) => (
                  <li key={note} className="rounded-lg border border-semantic-border bg-semantic-surface2 px-3 py-2 text-sm text-semantic-muted">
                    {note}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <label className="text-sm font-medium text-semantic-muted">Add note</label>
                <Textarea rows={4} placeholder="Type important details for dispatch or tech..." />
                <Button fullWidth variant="secondary" onClick={() => showToast("Note saved")}>
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

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-semantic-border bg-semantic-surface/95 p-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-3 gap-2">
          <Button size="lg" onClick={callAction}>
            <PhoneCall className="h-4 w-4" />
            Call
          </Button>
          <Button size="lg" variant="secondary" onClick={textAction}>
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
          <Button size="lg" variant="secondary" onClick={scheduleAction}>
            <CalendarPlus className="h-4 w-4" />
            Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}
