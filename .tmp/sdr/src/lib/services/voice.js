"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeVoiceCall = placeVoiceCall;
const twilio_1 = __importDefault(require("twilio"));
const subscription_gate_1 = require("@/lib/services/subscription-gate");
const audit_1 = require("@/lib/services/audit");
const admin_1 = require("@/lib/supabase/admin");
const phone_1 = require("@/lib/validators/phone");
const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
async function placeVoiceCall(input) {
    await (0, subscription_gate_1.assertOutboundAllowed)(input.accountId);
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from)
        throw new Error("TWILIO_PHONE_NUMBER missing");
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    if (input.dedupeKey) {
        const { data: existing } = await supabase
            .from("calls")
            .select("id, provider_call_id")
            .eq("account_id", input.accountId)
            .eq("direction", "OUTBOUND")
            .eq("metadata->>dedupe_key", input.dedupeKey)
            .maybeSingle();
        if (existing)
            return { id: existing.id, providerId: String(existing.provider_call_id || "existing") };
    }
    const to = (0, phone_1.normalizeToE164)(input.to);
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
    if (error)
        throw new Error(error.message);
    await (0, audit_1.logAuditEvent)({
        accountId: input.accountId,
        actorUserId: input.actorUserId,
        eventType: "outbound_call_placed",
        entityType: "call",
        entityId: data.id,
        metadata: { providerId: call.sid }
    });
    return { id: data.id, providerId: call.sid };
}
