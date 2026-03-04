import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WeatherSettingsForm } from "@/components/dashboard/weather-settings-form";
import type { ReactNode } from "react";

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Set defaults once so dispatch and follow-up run faster every day." />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-semantic-text">Business Profile</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Business name">
              <Input defaultValue="ServiceButler Demo Plumbing" />
            </Field>
            <Field label="Primary phone">
              <Input defaultValue="+1 (813) 555-0182" />
            </Field>
            <Field label="Review link">
              <Input defaultValue="https://g.page/r/example/review" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-semantic-text">Dispatch Rules</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quiet hours start">
                <Input type="time" defaultValue="20:00" />
              </Field>
              <Field label="Quiet hours end">
                <Input type="time" defaultValue="07:00" />
              </Field>
            </div>
            <Field label="Default response channel">
              <Select defaultValue="SMS">
                <option value="SMS">SMS first</option>
                <option value="EMAIL">Email first</option>
              </Select>
            </Field>
            <Field label="Dispatcher notes template">
              <Textarea rows={5} defaultValue={"Issue:\nUrgency:\nBest arrival window:\nSpecial access instructions:"} />
            </Field>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-semantic-text">Weather Preferences</h2>
          <p className="mt-1 text-sm text-semantic-muted">Forecast data drives urgency and demand signals on lead records.</p>
        </CardHeader>
        <CardBody>
          <WeatherSettingsForm />
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button size="lg">Save Changes</Button>
        <Button variant="secondary" size="lg">
          Test Auto Follow-Up
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">{label}</span>
      {children}
    </label>
  );
}
