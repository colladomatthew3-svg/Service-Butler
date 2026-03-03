import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/services/logger";

export async function markWebhookProcessing(
  provider: "stripe" | "twilio",
  eventId: string,
  payload: unknown,
  accountId?: string | null
) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      payload,
      account_id: accountId ?? null,
      processed_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (!error && data) {
    logEvent("info", "webhook.idempotency.miss", { provider, eventId, accountId: accountId ?? null });
    return { duplicate: false, id: data.id as string };
  }

  if (error && error.code === "23505") {
    logEvent("info", "webhook.idempotency.hit", { provider, eventId, accountId: accountId ?? null });
    return { duplicate: true, id: null };
  }

  throw new Error(error?.message || "Webhook idempotency failed");
}
