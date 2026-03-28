"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = DashboardLayout;
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const auth_1 = require("@/actions/auth");
const rbac_1 = require("@/lib/auth/rbac");
const account_billing_1 = require("@/lib/services/account-billing");
const review_mode_1 = require("@/lib/services/review-mode");
const app_shell_1 = require("@/components/dashboard/app-shell");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
exports.dynamic = "force-dynamic";
async function DashboardLayout({ children }) {
    const demoMode = (0, review_mode_1.isDemoMode)();
    let accountId;
    try {
        ({ accountId } = await (0, rbac_1.getCurrentUserContext)());
    }
    catch {
        (0, navigation_1.redirect)("/login");
    }
    const billing = await (0, account_billing_1.getAccountBillingState)(accountId);
    const showWarning = !billing.allowed || billing.allowedReason === "dev_override";
    const bannerText = billing.allowedReason === "dev_override"
        ? `Outbound allowed because dev override is enabled. Stripe subscription: ${billing.status}.`
        : billing.allowedReason === "billing_disabled"
            ? "Billing is disabled in MVP mode. Outbound features are available."
            : `Outbound sending is locked. Current subscription status: ${billing.status}.`;
    return (<app_shell_1.DashboardAppShell demoMode={demoMode} onSignOut={<div className="space-y-3">
          <link_1.default href="/billing" className={(0, button_1.buttonStyles)({ variant: "secondary", fullWidth: true })}>
            Billing
          </link_1.default>
          <link_1.default href="/pipeline" className={(0, button_1.buttonStyles)({ variant: "ghost", fullWidth: true })}>
            Legacy Pipeline
          </link_1.default>
          <form action={auth_1.signOut}>
            <button_1.Button variant="danger" fullWidth type="submit">
              Sign out
            </button_1.Button>
          </form>
        </div>}>
      {(showWarning || billing.allowedReason === "billing_disabled") && (<card_1.Card className="mb-6">
          <card_1.CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <badge_1.Badge variant={billing.allowedReason === "billing_disabled"
                ? "brand"
                : billing.allowedReason === "dev_override"
                    ? "success"
                    : "danger"}>
                {billing.allowed ? "Outbound enabled" : "Outbound locked"}
              </badge_1.Badge>
              <p className="mt-2 text-sm text-neutral-700">{bannerText}</p>
            </div>
            <link_1.default href="/billing" className={(0, button_1.buttonStyles)({ variant: "secondary" })}>
              Open Billing
            </link_1.default>
          </card_1.CardBody>
        </card_1.Card>)}
      {children}
    </app_shell_1.DashboardAppShell>);
}
