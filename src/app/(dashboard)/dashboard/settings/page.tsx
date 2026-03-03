import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Set quiet hours, routing, and defaults for faster daily ops." />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900">Business Profile</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Business name</label>
              <Input defaultValue="ServiceButler Demo Plumbing" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Primary phone</label>
              <Input defaultValue="+1 (813) 555-0182" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Review link</label>
              <Input defaultValue="https://g.page/r/example/review" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900">Automation Rules</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Quiet hours start</label>
                <Input type="time" defaultValue="20:00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Quiet hours end</label>
                <Input type="time" defaultValue="07:00" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Default response channel</label>
              <Select defaultValue="SMS">
                <option value="SMS">SMS first</option>
                <option value="EMAIL">Email first</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Dispatcher notes template</label>
              <Textarea rows={5} defaultValue={"Issue:\nUrgency:\nBest arrival window:\nSpecial access instructions:"} />
            </div>
          </CardBody>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button size="lg">Save Changes</Button>
        <Button variant="secondary" size="lg">
          Test Auto Follow-Up
        </Button>
      </div>
    </div>
  );
}
