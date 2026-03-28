"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReviewHubPage;
const link_1 = __importDefault(require("next/link"));
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const links = [
    { href: "/", label: "Marketing Homepage" },
    { href: "/login", label: "Login" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/leads", label: "Lead Inbox" },
    { href: "/dashboard/scanner", label: "Scanner" },
    { href: "/dashboard/pipeline", label: "Pipeline" },
    { href: "/dashboard/jobs", label: "Jobs" },
    { href: "/dashboard/schedule", label: "Schedule" },
    { href: "/dashboard/settings", label: "Settings" }
];
function ReviewHubPage() {
    return (<main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <card_1.Card>
        <card_1.CardHeader>
          <h1 className="text-2xl font-semibold text-semantic-text">ServiceButler Review Hub</h1>
          <p className="mt-1 text-sm text-semantic-muted">
            One place to click through core demo routes without guessing where to start.
          </p>
        </card_1.CardHeader>
        <card_1.CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (<link_1.default key={link.href} href={link.href}>
              <button_1.Button size="lg" fullWidth>
                {link.label}
              </button_1.Button>
            </link_1.default>))}
        </card_1.CardBody>
      </card_1.Card>

      <card_1.Card>
        <card_1.CardHeader>
          <h2 className="text-lg font-semibold text-semantic-text">Troubleshooting</h2>
        </card_1.CardHeader>
        <card_1.CardBody className="space-y-2 text-sm text-semantic-muted">
          <p>If dashboard routes redirect to login, enable local demo/review mode in <code>.env.local</code> and restart dev server.</p>
          <p>Recommended quick start: <code>npm run review</code>.</p>
        </card_1.CardBody>
      </card_1.Card>
    </main>);
}
