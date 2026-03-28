"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSms = sendSms;
const twilio_1 = __importDefault(require("twilio"));
const subscription_gate_1 = require("@/lib/services/subscription-gate");
const audit_1 = require("@/lib/services/audit");
const admin_1 = require("@/lib/supabase/admin");
const phone_1 = require("@/lib/validators/phone");
const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
async function sendSms(input) {
    await (0, subscription_gate_1.assertOutboundAllowed)(input.accountId);
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from)
        throw new Error("TWILIO_PHONE_NUMBER missing");
    const to = (0, phone_1.normalizeToE164)(input.to);
    const supabase = (0, admin_1.getSupabaseAdminClient)();
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
            return { id: existing.id, providerId: String(existing.provider_message_id || "existing") };
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
    if (error)
        throw new Error(error.message);
    await (0, audit_1.logAuditEvent)({
        accountId: input.accountId,
        actorUserId: input.actorUserId,
        eventType: "outbound_sms_sent",
        entityType: "message",
        entityId: data.id,
        metadata: { providerId: message.sid }
    });
    return { id: data.id, providerId: message.sid };
}
