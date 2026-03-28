"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const stripe_1 = require("@/lib/services/stripe");
const admin_1 = require("@/lib/supabase/admin");
const webhook_idempotency_1 = require("@/lib/services/webhook-idempotency");
const logger_1 = require("@/lib/services/logger");
const billing_mode_1 = require("@/lib/services/billing-mode");
async function POST(req) {
    if ((0, billing_mode_1.isBillingDisabled)()) {
        (0, logger_1.logEvent)("info", "webhook.stripe.ignored", { reason: "billing disabled" });
        return server_1.NextResponse.json({ ok: true, ignored: true });
    }
    const signature = req.headers.get("stripe-signature");
    if (!signature)
        return server_1.NextResponse.json({ error: "Missing signature" }, { status: 400 });
    const rawBody = await req.text();
    const stripe = (0, stripe_1.getStripeClient)();
    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
    }
    catch (error) {
        (0, logger_1.logEvent)("error", "webhook.stripe.signature_invalid", { message: error.message });
        return server_1.NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
    }
    (0, logger_1.logEvent)("info", "webhook.stripe.received", { eventId: event.id, eventType: event.type });
    const idem = await (0, webhook_idempotency_1.markWebhookProcessing)("stripe", event.id, event);
    if (idem.duplicate)
        return server_1.NextResponse.json({ ok: true, duplicate: true });
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const accountId = session.metadata?.account_id;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        if (accountId && customerId) {
            await supabase.from("stripe_customers").upsert({ account_id: accountId, stripe_customer_id: customerId }, { onConflict: "stripe_customer_id" });
        }
    }
    if (event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const stripeSubscriptionId = subscription.id;
        const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : null;
        if (stripeCustomerId) {
            const { data: customerMap } = await supabase
                .from("stripe_customers")
                .select("account_id")
                .eq("stripe_customer_id", stripeCustomerId)
                .maybeSingle();
            if (customerMap?.account_id) {
                await supabase.from("stripe_subscriptions").upsert({
                    account_id: customerMap.account_id,
                    stripe_subscription_id: stripeSubscriptionId,
                    stripe_customer_id: stripeCustomerId,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                        ? new Date(subscription.current_period_end * 1000).toISOString()
                        : null,
                    cancel_at_period_end: !!subscription.cancel_at_period_end
                }, { onConflict: "stripe_subscription_id" });
            }
        }
    }
    return server_1.NextResponse.json({ ok: true });
}
