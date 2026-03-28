"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountBillingState = getAccountBillingState;
const server_1 = require("@/lib/supabase/server");
const stripe_1 = require("@/lib/services/stripe");
const billing_mode_1 = require("@/lib/services/billing-mode");
const review_mode_1 = require("@/lib/services/review-mode");
async function getAccountBillingState(accountId) {
    if ((0, review_mode_1.isDemoMode)()) {
        return {
            status: "demo",
            allowed: true,
            allowedReason: "dev_override"
        };
    }
    if ((0, billing_mode_1.isBillingDisabled)()) {
        return {
            status: "disabled",
            allowed: true,
            allowedReason: "billing_disabled"
        };
    }
    const supabase = await (0, server_1.getSupabaseServerClient)();
    const { data } = await supabase
        .from("stripe_subscriptions")
        .select("status, current_period_end")
        .eq("account_id", accountId)
        .maybeSingle();
    const allowWithoutStripe = process.env.ALLOW_OUTBOUND_WITHOUT_STRIPE === "true";
    if (!data) {
        return {
            status: "missing",
            allowed: allowWithoutStripe,
            allowedReason: allowWithoutStripe ? "dev_override" : "missing_subscription"
        };
    }
    const allowed = (0, stripe_1.isSubscriptionAllowed)(data.status, data.current_period_end);
    return {
        status: data.status,
        allowed,
        allowedReason: allowed ? "subscription_ok" : "inactive_subscription"
    };
}
