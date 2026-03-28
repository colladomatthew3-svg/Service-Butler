"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const billing_1 = require("@/lib/services/billing");
const billing_mode_1 = require("@/lib/services/billing-mode");
async function POST() {
    if ((0, billing_mode_1.isBillingDisabled)()) {
        return server_1.NextResponse.json({ disabled: true });
    }
    const { accountId, role } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`;
    const url = await (0, billing_1.createBillingPortalSession)(accountId, returnUrl);
    if (!url) {
        return server_1.NextResponse.json({
            error: "No Stripe customer found for this account. Subscribe first via Billing > Start Subscription."
        }, { status: 400 });
    }
    return server_1.NextResponse.redirect(url, 303);
}
