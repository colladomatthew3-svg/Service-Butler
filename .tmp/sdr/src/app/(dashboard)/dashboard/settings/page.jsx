"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardSettingsPage;
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const input_1 = require("@/components/ui/input");
const select_1 = require("@/components/ui/select");
const textarea_1 = require("@/components/ui/textarea");
const button_1 = require("@/components/ui/button");
const weather_settings_form_1 = require("@/components/dashboard/weather-settings-form");
const integrations_coming_soon_1 = require("@/components/dashboard/integrations-coming-soon");
function DashboardSettingsPage() {
    return (<div className="space-y-6">
      <page_header_1.PageHeader title="Settings" subtitle="Set defaults once so dispatch and follow-up run faster every day."/>

      <section className="grid gap-5 xl:grid-cols-2">
        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Business Profile</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-4">
            <Field label="Business name">
              <input_1.Input defaultValue="ServiceButler Demo Plumbing"/>
            </Field>
            <Field label="Primary phone">
              <input_1.Input defaultValue="+1 (813) 555-0182"/>
            </Field>
            <Field label="Review link">
              <input_1.Input defaultValue="https://g.page/r/example/review"/>
            </Field>
          </card_1.CardBody>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Dispatch Rules</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quiet hours start">
                <input_1.Input type="time" defaultValue="20:00"/>
              </Field>
              <Field label="Quiet hours end">
                <input_1.Input type="time" defaultValue="07:00"/>
              </Field>
            </div>
            <Field label="Default response channel">
              <select_1.Select defaultValue="SMS">
                <option value="SMS">SMS first</option>
                <option value="EMAIL">Email first</option>
              </select_1.Select>
            </Field>
            <Field label="Dispatcher notes template">
              <textarea_1.Textarea rows={5} defaultValue={"Issue:\nUrgency:\nBest arrival window:\nSpecial access instructions:"}/>
            </Field>
          </card_1.CardBody>
        </card_1.Card>
      </section>

      <card_1.Card>
        <card_1.CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Weather Preferences</h2>
          <p className="mt-1 text-sm text-semantic-muted">Forecast data drives urgency and demand signals on lead records.</p>
        </card_1.CardHeader>
        <card_1.CardBody>
          <weather_settings_form_1.WeatherSettingsForm />
        </card_1.CardBody>
      </card_1.Card>

      <integrations_coming_soon_1.IntegrationsComingSoon />

      <div className="flex flex-wrap gap-3">
        <button_1.Button size="lg">Save Changes</button_1.Button>
        <button_1.Button variant="secondary" size="lg">
          Test Auto Follow-Up
        </button_1.Button>
      </div>
    </div>);
}
function Field({ label, children }) {
    return (<label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">{label}</span>
      {children}
    </label>);
}
