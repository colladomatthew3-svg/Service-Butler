"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NotFoundPage;
const link_1 = __importDefault(require("next/link"));
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
function NotFoundPage() {
    return (<main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-6 py-16">
      <card_1.Card className="w-full">
        <card_1.CardBody className="space-y-4 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Page not found</p>
          <h1 className="marketing-hero text-semantic-text">That page is not in your dispatch flow.</h1>
          <p className="mx-auto max-w-xl text-semantic-muted">
            Return to the homepage or open the demo dashboard to continue weather setup, opportunity scanning, and job scheduling.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <link_1.default href="/">
              <button_1.Button size="lg">Back to Homepage</button_1.Button>
            </link_1.default>
            <link_1.default href="/dashboard">
              <button_1.Button size="lg" variant="secondary">Open Dashboard</button_1.Button>
            </link_1.default>
          </div>
        </card_1.CardBody>
      </card_1.Card>
    </main>);
}
