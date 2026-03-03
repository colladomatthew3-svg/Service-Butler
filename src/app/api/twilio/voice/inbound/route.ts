import { NextRequest, NextResponse } from "next/server";
import { validateTwilioRequest, parseTwilioRawForm } from "@/lib/services/twilio-validate";
import { markWebhookProcessing } from "@/lib/services/webhook-idempotency";
import { findOrCreateLeadByPhone, resolveAccountByTwilioNumber } from "@/lib/services/leads";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { twimlResponse } from "@/lib/services/twiml";
import { getPublicRequestUrl } from "@/lib/services/http";
import { logEvent } from "@/lib/services/logger";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const payload = parseTwilioRawForm(rawBody);
  const publicUrl = getPublicRequestUrl(req);

  const valid = validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl, payload);
  if (!valid) {
    logEvent("warn", "webhook.twilio.voice.signature_invalid", { url: publicUrl });
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  logEvent("info", "webhook.twilio.voice.received", { callSid: payload.CallSid || null });

  const callSid = payload.CallSid;
  if (!callSid) return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });

  const accountId = await resolveAccountByTwilioNumber(payload.To);
  const idem = await markWebhookProcessing("twilio", callSid, payload, accountId);
  if (!idem.duplicate) {
    const { leadId, contactId } = await findOrCreateLeadByPhone(accountId, payload.From);
    const supabase = getSupabaseAdminClient();

    await supabase.from("calls").insert({
      account_id: accountId,
      lead_id: leadId,
      contact_id: contactId,
      direction: "INBOUND",
      from_phone: payload.From,
      to_phone: payload.To,
      provider_call_id: callSid,
      status: payload.CallStatus || "ringing"
    });

    logEvent("info", "lead.call.recorded", { accountId, leadId, callSid });
  }

  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. We will text you shortly.</Say>
  <Hangup/>
</Response>`);
}
