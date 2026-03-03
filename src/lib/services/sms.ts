import twilio from "twilio";
import { assertOutboundAllowed } from "@/lib/services/subscription-gate";
import { logAuditEvent } from "@/lib/services/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeToE164 } from "@/lib/validators/phone";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

type SendSmsInput = {
  accountId: string;
  leadId?: string | null;
  to: string;
  body: string;
  actorUserId?: string | null;
  dedupeKey?: string;
};

export async function sendSms(input: SendSmsInput) {
  await assertOutboundAllowed(input.accountId);

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER missing");

  const to = normalizeToE164(input.to);
  const supabase = getSupabaseAdminClient();

  if (input.dedupeKey) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id, provider_message_id")
      .eq("account_id", input.accountId)
      .eq("channel", "SMS")
      .eq("direction", "OUTBOUND")
      .eq("metadata->>dedupe_key", input.dedupeKey)
      .maybeSingle();

    if (existing) {
      return { id: existing.id as string, providerId: String(existing.provider_message_id || "existing") };
    }
  }

  const message = await client.messages.create({ to, from, body: input.body });

  const { data, error } = await supabase
    .from("messages")
    .insert({
      account_id: input.accountId,
      lead_id: input.leadId ?? null,
      channel: "SMS",
      direction: "OUTBOUND",
      body: input.body,
      to_phone: to,
      from_phone: from,
      provider_message_id: message.sid,
      status: message.status ?? "queued",
      metadata: input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    eventType: "outbound_sms_sent",
    entityType: "message",
    entityId: data.id,
    metadata: { providerId: message.sid }
  });

  return { id: data.id, providerId: message.sid };
}
