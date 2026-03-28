"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsComingSoon = IntegrationsComingSoon;
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const toast_1 = require("@/components/ui/toast");
const integrations = ["HubSpot", "Jobber", "ServiceTitan", "Salesforce", "Clay", "Smudge"];
function IntegrationsComingSoon() {
    const { showToast } = (0, toast_1.useToast)();
    return (<card_1.Card>
      <card_1.CardHeader>
        <h2 className="dashboard-section-title text-semantic-text">Integrations (Coming Soon)</h2>
        <p className="mt-1 text-sm text-semantic-muted">We can run alongside your existing CRM or be your CRM.</p>
      </card_1.CardHeader>
      <card_1.CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((name) => (<div key={name} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
            <p className="font-semibold text-semantic-text">{name}</p>
            <p className="mt-1 text-sm text-semantic-muted">Connect sync and routing workflows.</p>
            <div className="mt-3 flex gap-2">
              <button_1.Button size="sm" variant="secondary" disabled>
                Connect
              </button_1.Button>
              <button_1.Button size="sm" onClick={() => showToast(`${name} waitlist added (demo)`)}>
                Join waitlist
              </button_1.Button>
            </div>
          </div>))}
      </card_1.CardBody>
    </card_1.Card>);
}
