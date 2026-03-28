"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertOutboundAllowed = assertOutboundAllowed;
const stripe_1 = require("@/lib/services/stripe");
const admin_1 = require("@/lib/supabase/admin");
const billing_mode_1 = require("@/lib/services/billing-mode");
async function assertOutboundAllowed(accountId) {
    if ((0, billing_mode_1.isBillingDisabled)())
        return;
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const { data, error } = await supabase
        .from("stripe_subscriptions")
        .select("status, current_period_end")
        .eq("account_id", accountId)
        .maybeSingle();
    if (error)
        throw new Error("Account billing state unavailable");
    const allowWithoutStripe = process.env.ALLOW_OUTBOUND_WITHOUT_STRIPE === "true";
    if (!data) {
        if (allowWithoutStripe)
            return;
        throw new Error("Outbound messaging blocked: no active subscription record");
    }
    const allowed = (0, stripe_1.isSubscriptionAllowed)(data.status || "incomplete", data.current_period_end);
    if (!allowed)
        throw new Error("Outbound messaging blocked: subscription inactive");
}
