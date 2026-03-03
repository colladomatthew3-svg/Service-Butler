"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MessageSquare, PhoneCall, Trophy, XCircle } from "lucide-react";
import { mockLeads, serviceTypes, statusFilters, urgencyFilters } from "@/lib/mock/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

export function LeadInboxView() {
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");
  const [urgency, setUrgency] = useState<(typeof urgencyFilters)[number]>("All");
  const [service, setService] = useState<(typeof serviceTypes)[number]>("All");
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(
    () =>
      mockLeads.filter((lead) => {
        if (status !== "All" && lead.status !== status) return false;
        if (urgency !== "All" && lead.urgency !== urgency) return false;
        if (service !== "All" && lead.serviceType !== service) return false;
        return true;
      }),
    [status, urgency, service]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Inbox"
        subtitle="Sort high-priority leads first and take action in one tap."
        actions={
          <Link href="/dashboard">
            <Button variant="secondary">Back to Overview</Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <FilterChips label="Status" options={statusFilters} value={status} onChange={setStatus} />
          <FilterChips label="Urgency" options={urgencyFilters} value={urgency} onChange={setUrgency} />
          <FilterChips label="Service" options={serviceTypes} value={service} onChange={setService} />
        </CardBody>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardBody>
          </Card>
        </div>
      ) : (
        <>
          <div className="space-y-4 lg:hidden">
            {filtered.map((lead) => (
              <Card key={lead.id}>
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-semantic-text">{lead.name}</p>
                      <p className="text-sm text-semantic-muted">{lead.phone}</p>
                      <p className="text-sm text-semantic-muted">
                        {lead.serviceType} · {lead.location}
                      </p>
                    </div>
                    <div className="space-y-2 text-right">
                      <Badge variant="brand">{lead.status}</Badge>
                      <Badge variant={lead.urgency === "HIGH" ? "danger" : lead.urgency === "MEDIUM" ? "warning" : "default"}>
                        {lead.urgency}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                    <p className="text-xs uppercase tracking-wide text-semantic-muted">Next step</p>
                    <p className="mt-1 text-sm font-semibold text-semantic-text">{lead.nextStep}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="lg" onClick={() => showToast(`Calling ${lead.name}...`)}>
                      <PhoneCall className="h-4 w-4" /> Call
                    </Button>
                    <Button size="lg" variant="secondary" onClick={() => showToast(`Text composer opened for ${lead.name}`)}>
                      <MessageSquare className="h-4 w-4" /> Text
                    </Button>
                    <Button size="lg" variant="secondary" onClick={() => showToast(`Scheduling flow opened for ${lead.name}`)}>
                      <CalendarPlus className="h-4 w-4" /> Schedule
                    </Button>
                    <Link href={`/dashboard/leads/${lead.id}`}>
                      <Button size="lg" variant="ghost" fullWidth>
                        Open
                      </Button>
                    </Link>
                    <Button size="lg" variant="secondary" onClick={() => showToast(`${lead.name} marked won`)}>
                      <Trophy className="h-4 w-4" /> Won
                    </Button>
                    <Button size="lg" variant="danger" onClick={() => showToast(`${lead.name} marked lost`)}>
                      <XCircle className="h-4 w-4" /> Lost
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TH>Lead</TH>
                    <TH>Service</TH>
                    <TH>Status</TH>
                    <TH>Next Step</TH>
                    <TH>Actions</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {filtered.map((lead) => (
                    <tr key={lead.id}>
                      <TD>
                        <Link href={`/dashboard/leads/${lead.id}`} className="font-semibold text-semantic-text hover:text-brand-700">
                          {lead.name}
                        </Link>
                        <div className="text-xs text-semantic-muted">{lead.phone}</div>
                      </TD>
                      <TD>
                        <p className="font-medium text-semantic-text">{lead.serviceType}</p>
                        <p className="text-xs text-semantic-muted">{lead.location}</p>
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <Badge variant="brand">{lead.status}</Badge>
                          <Badge variant={lead.urgency === "HIGH" ? "danger" : lead.urgency === "MEDIUM" ? "warning" : "default"}>
                            {lead.urgency}
                          </Badge>
                        </div>
                      </TD>
                      <TD>{lead.nextStep}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => showToast(`Calling ${lead.name}...`)}>
                            <PhoneCall className="h-4 w-4" />
                            Call
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => showToast(`Text composer opened for ${lead.name}`)}>
                            <MessageSquare className="h-4 w-4" />
                            Text
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => showToast(`Scheduling flow opened for ${lead.name}`)}>
                            <CalendarPlus className="h-4 w-4" />
                            Schedule
                          </Button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-semantic-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-semibold transition",
                active
                  ? "bg-semantic-brand text-white shadow-sm"
                  : "bg-semantic-surface2 text-semantic-muted ring-1 ring-inset ring-semantic-border hover:bg-semantic-surface"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
