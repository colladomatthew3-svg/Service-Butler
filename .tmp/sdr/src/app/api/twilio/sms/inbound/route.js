"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const twilio_validate_1 = require("@/lib/services/twilio-validate");
const webhook_idempotency_1 = require("@/lib/services/webhook-idempotency");
const leads_1 = require("@/lib/services/leads");
const admin_1 = require("@/lib/supabase/admin");
const client_1 = require("@/lib/workflows/client");
const twiml_1 = require("@/lib/services/twiml");
const http_1 = require("@/lib/services/http");
const logger_1 = require("@/lib/services/logger");
async function POST(req) {
    const rawBody = await req.text();
    const payload = (0, twilio_validate_1.parseTwilioRawForm)(rawBody);
    const publicUrl = (0, http_1.getPublicRequestUrl)(req);
    const valid = (0, twilio_validate_1.validateTwilioRequest)(req.headers.get("x-twilio-signature"), publicUrl, payload);
    if (!valid) {
        (0, logger_1.logEvent)("warn", "webhook.twilio.sms.signature_invalid", { url: publicUrl });
        return server_1.NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }
    (0, logger_1.logEvent)("info", "webhook.twilio.sms.received", { messageSid: payload.MessageSid || null });
    const messageSid = payload.MessageSid;
    if (!messageSid)
        return server_1.NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
    const accountId = await (0, leads_1.resolveAccountByTwilioNumber)(payload.To);
    const idem = await (0, webhook_idempotency_1.markWebhookProcessing)("twilio", messageSid, payload, accountId);
    if (idem.duplicate)
        return (0, twiml_1.twimlResponse)("<Response></Response>");
    const { leadId, contactId } = await (0, leads_1.findOrCreateLeadByPhone)(accountId, payload.From);
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const { data: existingConversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("account_id", accountId)
        .eq("lead_id", leadId)
        .maybeSingle();
    let conversationId = existingConversation?.id;
    if (!conversationId) {
        const { data: newConversation, error: convoError } = await supabase
            .from("conversations")
            .insert({ account_id: accountId, lead_id: leadId, contact_id: contactId, subject: "SMS Thread" })
            .select("id")
            .single();
        if (convoError)
            throw new Error(convoError.message);
        conversationId = newConversation.id;
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
    await client_1.inngest.send({ name: "lead/replied", data: { accountId, leadId, messageSid } });
    (0, logger_1.logEvent)("info", "lead.reply.recorded", { accountId, leadId, messageSid });
    return (0, twiml_1.twimlResponse)("<Response></Response>");
}
