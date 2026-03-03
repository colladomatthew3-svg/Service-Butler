import { CalendarClock, Truck } from "lucide-react";
import { mockJobs } from "@/lib/mock/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";

export default function SchedulePage() {
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
          <h2 className="text-lg font-semibold text-semantic-text">Today & Tomorrow Jobs</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {mockJobs.map((job) => (
            <article key={job.id} className="rounded-xl border border-semantic-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-semantic-text">{job.customer}</p>
                  <p className="text-sm text-semantic-muted">{job.serviceType}</p>
                </div>
                <Badge variant={job.status === "Completed" ? "success" : job.status === "In Progress" ? "warning" : "brand"}>
                  {job.status}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-semantic-muted sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-semantic-muted" />
                  {job.startWindow}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Truck className="h-4 w-4 text-semantic-muted" />
                  Tech: {job.tech}
                </p>
              </div>
              <p className="mt-2 text-sm text-semantic-muted">{job.location}</p>
            </article>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
