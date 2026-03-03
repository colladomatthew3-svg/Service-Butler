import twilio from "twilio";
import { assertOutboundAllowed } from "@/lib/services/subscription-gate";
import { logAuditEvent } from "@/lib/services/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeToE164 } from "@/lib/validators/phone";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

type CallInput = {
  accountId: string;
  leadId?: string | null;
  to: string;
  twimlUrl: string;
  actorUserId?: string | null;
  dedupeKey?: string;
};

export async function placeVoiceCall(input: CallInput) {
  await assertOutboundAllowed(input.accountId);

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER missing");

  const supabase = getSupabaseAdminClient();
  if (input.dedupeKey) {
    const { data: existing } = await supabase
      .from("calls")
      .select("id, provider_call_id")
      .eq("account_id", input.accountId)
      .eq("direction", "OUTBOUND")
      .eq("metadata->>dedupe_key", input.dedupeKey)
      .maybeSingle();

    if (existing) return { id: existing.id as string, providerId: String(existing.provider_call_id || "existing") };
  }

  const to = normalizeToE164(input.to);
  const call = await client.calls.create({
    to,
    from,
    url: input.twimlUrl,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`
  });

  const { data, error } = await supabase
    .from("calls")
    .insert({
      account_id: input.accountId,
      lead_id: input.leadId ?? null,
      to_phone: to,
      from_phone: from,
      direction: "OUTBOUND",
      provider_call_id: call.sid,
      status: call.status ?? "queued",
      metadata: input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    eventType: "outbound_call_placed",
    entityType: "call",
    entityId: data.id,
    metadata: { providerId: call.sid }
  });

  return { id: data.id, providerId: call.sid };
}
