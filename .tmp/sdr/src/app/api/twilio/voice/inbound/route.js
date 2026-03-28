"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const twilio_validate_1 = require("@/lib/services/twilio-validate");
const webhook_idempotency_1 = require("@/lib/services/webhook-idempotency");
const leads_1 = require("@/lib/services/leads");
const admin_1 = require("@/lib/supabase/admin");
const twiml_1 = require("@/lib/services/twiml");
const http_1 = require("@/lib/services/http");
const logger_1 = require("@/lib/services/logger");
async function POST(req) {
    const rawBody = await req.text();
    const payload = (0, twilio_validate_1.parseTwilioRawForm)(rawBody);
    const publicUrl = (0, http_1.getPublicRequestUrl)(req);
    const valid = (0, twilio_validate_1.validateTwilioRequest)(req.headers.get("x-twilio-signature"), publicUrl, payload);
    if (!valid) {
        (0, logger_1.logEvent)("warn", "webhook.twilio.voice.signature_invalid", { url: publicUrl });
        return server_1.NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }
    (0, logger_1.logEvent)("info", "webhook.twilio.voice.received", { callSid: payload.CallSid || null });
    const callSid = payload.CallSid;
    if (!callSid)
        return server_1.NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    const accountId = await (0, leads_1.resolveAccountByTwilioNumber)(payload.To);
    const idem = await (0, webhook_idempotency_1.markWebhookProcessing)("twilio", callSid, payload, accountId);
    if (!idem.duplicate) {
        const { leadId, contactId } = await (0, leads_1.findOrCreateLeadByPhone)(accountId, payload.From);
        const supabase = (0, admin_1.getSupabaseAdminClient)();
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
        (0, logger_1.logEvent)("info", "lead.call.recorded", { accountId, leadId, callSid });
    }
    return (0, twiml_1.twimlResponse)(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. We will text you shortly.</Say>
  <Hangup/>
</Response>`);
}
