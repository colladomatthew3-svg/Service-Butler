import Link from "next/link";
import { PhoneCall, MessageSquare, CalendarPlus, Trophy, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { mockLeads, serviceTypes, statusFilters, urgencyFilters } from "@/lib/mock/dashboard";

type Search = {
  status?: string;
  urgency?: string;
  service?: string;
};

export default async function LeadInboxPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const status = params.status || "All";
  const urgency = params.urgency || "All";
  const service = params.service || "All";

  const filtered = mockLeads.filter((lead) => {
    if (status !== "All" && lead.status !== status) return false;
    if (urgency !== "All" && lead.urgency !== urgency) return false;
    if (service !== "All" && lead.serviceType !== service) return false;
    return true;
  });

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
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</label>
              <Select name="status" defaultValue={status}>
                {statusFilters.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Urgency</label>
              <Select name="urgency" defaultValue={urgency}>
                {urgencyFilters.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Service</label>
              <Select name="service" defaultValue={service}>
                {serviceTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Apply Filters</Button>
          </form>
        </CardBody>
      </Card>

      <div className="space-y-4 lg:hidden">
        {filtered.map((lead) => (
          <Card key={lead.id}>
            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-neutral-900">{lead.name}</p>
                  <p className="text-sm text-neutral-600">{lead.phone}</p>
                  <p className="text-sm text-neutral-600">
                    {lead.serviceType} · {lead.location}
                  </p>
                </div>
                <Badge variant={lead.urgency === "HIGH" ? "danger" : lead.urgency === "MEDIUM" ? "warning" : "default"}>
                  {lead.urgency}
                </Badge>
              </div>
              <p className="text-sm text-neutral-700">Next step: {lead.nextStep}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg">
                  <PhoneCall className="h-4 w-4" /> Call
                </Button>
                <Button size="lg" variant="secondary">
                  <MessageSquare className="h-4 w-4" /> Text
                </Button>
                <Button size="lg" variant="secondary">
                  <CalendarPlus className="h-4 w-4" /> Schedule
                </Button>
                <Link href={`/dashboard/leads/${lead.id}`}>
                  <Button size="lg" variant="ghost" fullWidth>
                    Open
                  </Button>
                </Link>
                <Button size="lg" variant="secondary">
                  <Trophy className="h-4 w-4" /> Won
                </Button>
                <Button size="lg" variant="danger">
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
                    <Link href={`/dashboard/leads/${lead.id}`} className="font-semibold text-neutral-900 hover:text-brand-700">
                      {lead.name}
                    </Link>
                    <div className="text-xs text-neutral-500">{lead.phone}</div>
                  </TD>
                  <TD>
                    <p className="font-medium text-neutral-800">{lead.serviceType}</p>
                    <p className="text-xs text-neutral-500">{lead.location}</p>
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
                      <Button size="sm">
                        <PhoneCall className="h-4 w-4" />
                        Call
                      </Button>
                      <Button size="sm" variant="secondary">
                        <MessageSquare className="h-4 w-4" />
                        Text
                      </Button>
                      <Button size="sm" variant="secondary">
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
    </div>
  );
}
