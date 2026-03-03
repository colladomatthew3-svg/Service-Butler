import { NextRequest, NextResponse } from "next/server";
import { validateTwilioRequest, parseTwilioRawForm } from "@/lib/services/twilio-validate";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { markWebhookProcessing } from "@/lib/services/webhook-idempotency";
import { inngest } from "@/lib/workflows/client";
import { getPublicRequestUrl } from "@/lib/services/http";
import { logEvent } from "@/lib/services/logger";

const MISSED_STATUSES = ["no-answer", "busy", "failed", "canceled"];

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const payload = parseTwilioRawForm(rawBody);
  const publicUrl = getPublicRequestUrl(req);

  const valid = validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl, payload);
  if (!valid) {
    logEvent("warn", "webhook.twilio.status.signature_invalid", { url: publicUrl });
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const twilioSid = payload.CallSid || payload.MessageSid;
  if (!twilioSid) return NextResponse.json({ error: "Missing Twilio SID" }, { status: 400 });

  logEvent("info", "webhook.twilio.status.received", {
    sid: twilioSid,
    callStatus: payload.CallStatus || null,
    messageStatus: payload.MessageStatus || payload.SmsStatus || null
  });

  const idem = await markWebhookProcessing(
    "twilio",
    `status:${twilioSid}:${payload.CallStatus || payload.MessageStatus || payload.SmsStatus || "unknown"}`,
    payload
  );
  if (idem.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  const supabase = getSupabaseAdminClient();

  if (payload.CallSid) {
    const { data: row } = await supabase
      .from("calls")
      .select("id, account_id, lead_id")
      .eq("provider_call_id", payload.CallSid)
      .maybeSingle();

    if (row) {
      await supabase
        .from("calls")
        .update({ status: payload.CallStatus, duration_seconds: payload.CallDuration ? Number(payload.CallDuration) : null })
        .eq("id", row.id);

      const isMissed = MISSED_STATUSES.includes((payload.CallStatus || "").toLowerCase());
      if (isMissed) {
        const missedIdem = await markWebhookProcessing("twilio", `missed_followup:${payload.CallSid}`, payload, row.account_id);
        if (!missedIdem.duplicate) {
          await inngest.send({
            name: "call/missed",
            data: { accountId: row.account_id, leadId: row.lead_id, callSid: payload.CallSid }
          });
          logEvent("info", "workflow.triggered", { name: "call/missed", accountId: row.account_id, leadId: row.lead_id });
        }
      }
    }
  }

  if (payload.MessageSid) {
    await supabase
      .from("messages")
      .update({ status: payload.MessageStatus || payload.SmsStatus || "unknown" })
      .eq("provider_message_id", payload.MessageSid);
  }

  return NextResponse.json({ ok: true });
}
