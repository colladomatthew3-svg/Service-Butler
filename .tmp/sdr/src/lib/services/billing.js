"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripeCustomerId = getStripeCustomerId;
exports.ensureStripeCustomer = ensureStripeCustomer;
exports.createCheckoutSession = createCheckoutSession;
exports.createBillingPortalSession = createBillingPortalSession;
const stripe_1 = require("@/lib/services/stripe");
const admin_1 = require("@/lib/supabase/admin");
async function getStripeCustomerId(accountId) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const { data } = await supabase
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("account_id", accountId)
        .maybeSingle();
    return data?.stripe_customer_id || null;
}
async function ensureStripeCustomer(accountId) {
    const existingCustomerId = await getStripeCustomerId(accountId);
    if (existingCustomerId)
        return existingCustomerId;
    const stripe = (0, stripe_1.getStripeClient)();
    const customer = await stripe.customers.create({ metadata: { account_id: accountId } });
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    await supabase.from("stripe_customers").upsert({
        account_id: accountId,
        stripe_customer_id: customer.id
    });
    return customer.id;
}
async function createCheckoutSession(accountId, appUrl) {
    const stripe = (0, stripe_1.getStripeClient)();
    const customerId = await ensureStripeCustomer(accountId);
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId)
        throw new Error("STRIPE_PRICE_ID is not configured");
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { account_id: accountId },
        subscription_data: {
            metadata: { account_id: accountId }
        },
        success_url: `${appUrl}/billing?success=1`,
        cancel_url: `${appUrl}/billing?canceled=1`
    });
    if (!session.url)
        throw new Error("Stripe checkout session missing URL");
    return session.url;
}
async function createBillingPortalSession(accountId, returnUrl) {
    const stripe = (0, stripe_1.getStripeClient)();
    const customerId = await getStripeCustomerId(accountId);
    if (!customerId) {
        return null;
    }
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
    });
    return session.url;
}
