import Stripe from "stripe";

let stripeClient: Stripe | null = null;

const graceDays = Number(process.env.SUBSCRIPTION_GRACE_DAYS || "3");

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil"
    });
  }

  return stripeClient;
}

export function isSubscriptionAllowed(status: string, currentPeriodEnd: string | null, now = new Date()) {
  if (status === "active" || status === "trialing") return true;

  if (status === "past_due" && currentPeriodEnd) {
    const end = new Date(currentPeriodEnd);
    const graceEnd = new Date(end.getTime() + graceDays * 24 * 60 * 60 * 1000);
    return now <= graceEnd;
  }

  return false;
}
