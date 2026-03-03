import { NextRequest, NextResponse } from "next/server";
import { validateTwilioRequest, parseTwilioRawForm } from "@/lib/services/twilio-validate";
import { markWebhookProcessing } from "@/lib/services/webhook-idempotency";
import { findOrCreateLeadByPhone, resolveAccountByTwilioNumber } from "@/lib/services/leads";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/workflows/client";
import { twimlResponse } from "@/lib/services/twiml";
import { getPublicRequestUrl } from "@/lib/services/http";
import { logEvent } from "@/lib/services/logger";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const payload = parseTwilioRawForm(rawBody);
  const publicUrl = getPublicRequestUrl(req);

  const valid = validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl, payload);
  if (!valid) {
    logEvent("warn", "webhook.twilio.sms.signature_invalid", { url: publicUrl });
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  logEvent("info", "webhook.twilio.sms.received", { messageSid: payload.MessageSid || null });

  const messageSid = payload.MessageSid;
  if (!messageSid) return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });

  const accountId = await resolveAccountByTwilioNumber(payload.To);
  const idem = await markWebhookProcessing("twilio", messageSid, payload, accountId);
  if (idem.duplicate) return twimlResponse("<Response></Response>");

  const { leadId, contactId } = await findOrCreateLeadByPhone(accountId, payload.From);
  const supabase = getSupabaseAdminClient();

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("account_id", accountId)
    .eq("lead_id", leadId)
    .maybeSingle();

  let conversationId = existingConversation?.id as string | undefined;
  if (!conversationId) {
    const { data: newConversation, error: convoError } = await supabase
      .from("conversations")
      .insert({ account_id: accountId, lead_id: leadId, contact_id: contactId, subject: "SMS Thread" })
      .select("id")
      .single();
    if (convoError) throw new Error(convoError.message);
    conversationId = newConversation.id as string;
  }

  await supabase.from("messages").insert({
    account_id: accountId,
    lead_id: leadId,
    contact_id: contactId,
    conversation_id: conversationId,
    channel: "SMS",
    direction: "INBOUND",
    body: payload.Body,
    from_phone: payload.From,
    to_phone: payload.To,
    provider_message_id: messageSid,
    status: payload.SmsStatus || "received"
  });

  await supabase
    .from("sequence_enrollments")
    .update({ status: "STOPPED", stopped_reason: "reply_received" })
    .eq("account_id", accountId)
    .eq("lead_id", leadId)
    .eq("status", "ACTIVE");

  await inngest.send({ name: "lead/replied", data: { accountId, leadId, messageSid } });
  logEvent("info", "lead.reply.recorded", { accountId, leadId, messageSid });

  return twimlResponse("<Response></Response>");
}
