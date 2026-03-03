import { isSubscriptionAllowed } from "@/lib/services/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isBillingDisabled } from "@/lib/services/billing-mode";

export async function assertOutboundAllowed(accountId: string) {
  if (isBillingDisabled()) return;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("status, current_period_end")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new Error("Account billing state unavailable");

  const allowWithoutStripe = process.env.ALLOW_OUTBOUND_WITHOUT_STRIPE === "true";
  if (!data) {
    if (allowWithoutStripe) return;
    throw new Error("Outbound messaging blocked: no active subscription record");
  }

  const allowed = isSubscriptionAllowed(data.status || "incomplete", data.current_period_end);
  if (!allowed) throw new Error("Outbound messaging blocked: subscription inactive");
}
