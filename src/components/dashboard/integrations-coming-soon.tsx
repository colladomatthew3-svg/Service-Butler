"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const integrations = ["HubSpot", "Jobber", "ServiceTitan", "Salesforce", "Clay", "Smudge"];

export function IntegrationsComingSoon() {
  const { showToast } = useToast();

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-semantic-text">Integrations (Coming Soon)</h2>
        <p className="mt-1 text-sm text-semantic-muted">We can run alongside your existing CRM or be your CRM.</p>
      </CardHeader>
      <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((name) => (
          <div key={name} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
            <p className="font-semibold text-semantic-text">{name}</p>
            <p className="mt-1 text-sm text-semantic-muted">Connect sync and routing workflows.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" disabled>
                Connect
              </Button>
              <Button
                size="sm"
                onClick={() => showToast(`${name} waitlist added (demo)`)}
              >
                Join waitlist
              </Button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
