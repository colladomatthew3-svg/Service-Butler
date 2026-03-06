import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSubscriptionAllowed } from "@/lib/services/stripe";
import { isBillingDisabled } from "@/lib/services/billing-mode";
import { isDemoMode } from "@/lib/services/review-mode";

export async function getAccountBillingState(accountId: string) {
  if (isDemoMode()) {
    return {
      status: "demo",
      allowed: true,
      allowedReason: "dev_override"
    };
  }

  if (isBillingDisabled()) {
    return {
      status: "disabled",
      allowed: true,
      allowedReason: "billing_disabled"
    };
  }

  const supabase = await getSupabaseServerClient();
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

  const allowed = isSubscriptionAllowed(data.status, data.current_period_end);
  return {
    status: data.status,
    allowed,
    allowedReason: allowed ? "subscription_ok" : "inactive_subscription"
  };
}
