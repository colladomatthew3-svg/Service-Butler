import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/services/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { markWebhookProcessing } from "@/lib/services/webhook-idempotency";
import { logEvent } from "@/lib/services/logger";
import { isBillingDisabled } from "@/lib/services/billing-mode";

export async function POST(req: NextRequest) {
  if (isBillingDisabled()) {
    logEvent("info", "webhook.stripe.ignored", { reason: "billing disabled" });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (error) {
    logEvent("error", "webhook.stripe.signature_invalid", { message: (error as Error).message });
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  logEvent("info", "webhook.stripe.received", { eventId: event.id, eventType: event.type });

  const idem = await markWebhookProcessing("stripe", event.id, event);
  if (idem.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  const supabase = getSupabaseAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const accountId = session.metadata?.account_id;
    const customerId = typeof session.customer === "string" ? session.customer : null;

    if (accountId && customerId) {
      await supabase.from("stripe_customers").upsert(
        { account_id: accountId, stripe_customer_id: customerId },
        { onConflict: "stripe_customer_id" }
      );
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number | null };
    const stripeSubscriptionId = subscription.id;
    const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : null;

    if (stripeCustomerId) {
      const { data: customerMap } = await supabase
        .from("stripe_customers")
        .select("account_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

      if (customerMap?.account_id) {
        await supabase.from("stripe_subscriptions").upsert(
          {
            account_id: customerMap.account_id,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id: stripeCustomerId,
            status: subscription.status,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: !!subscription.cancel_at_period_end
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
