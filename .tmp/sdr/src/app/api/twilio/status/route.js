"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const twilio_validate_1 = require("@/lib/services/twilio-validate");
const admin_1 = require("@/lib/supabase/admin");
const webhook_idempotency_1 = require("@/lib/services/webhook-idempotency");
const client_1 = require("@/lib/workflows/client");
const http_1 = require("@/lib/services/http");
const logger_1 = require("@/lib/services/logger");
const MISSED_STATUSES = ["no-answer", "busy", "failed", "canceled"];
async function POST(req) {
    const rawBody = await req.text();
    const payload = (0, twilio_validate_1.parseTwilioRawForm)(rawBody);
    const publicUrl = (0, http_1.getPublicRequestUrl)(req);
    const valid = (0, twilio_validate_1.validateTwilioRequest)(req.headers.get("x-twilio-signature"), publicUrl, payload);
    if (!valid) {
        (0, logger_1.logEvent)("warn", "webhook.twilio.status.signature_invalid", { url: publicUrl });
        return server_1.NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }
    const twilioSid = payload.CallSid || payload.MessageSid;
    if (!twilioSid)
        return server_1.NextResponse.json({ error: "Missing Twilio SID" }, { status: 400 });
    (0, logger_1.logEvent)("info", "webhook.twilio.status.received", {
        sid: twilioSid,
        callStatus: payload.CallStatus || null,
        messageStatus: payload.MessageStatus || payload.SmsStatus || null
    });
    const idem = await (0, webhook_idempotency_1.markWebhookProcessing)("twilio", `status:${twilioSid}:${payload.CallStatus || payload.MessageStatus || payload.SmsStatus || "unknown"}`, payload);
    if (idem.duplicate)
        return server_1.NextResponse.json({ ok: true, duplicate: true });
    const supabase = (0, admin_1.getSupabaseAdminClient)();
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
                const missedIdem = await (0, webhook_idempotency_1.markWebhookProcessing)("twilio", `missed_followup:${payload.CallSid}`, payload, row.account_id);
                if (!missedIdem.duplicate) {
                    await client_1.inngest.send({
                        name: "call/missed",
                        data: { accountId: row.account_id, leadId: row.lead_id, callSid: payload.CallSid }
                    });
                    (0, logger_1.logEvent)("info", "workflow.triggered", { name: "call/missed", accountId: row.account_id, leadId: row.lead_id });
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
    return server_1.NextResponse.json({ ok: true });
}
