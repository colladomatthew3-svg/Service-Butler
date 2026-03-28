"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const postmark_1 = require("postmark");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const subscription_gate_1 = require("@/lib/services/subscription-gate");
const audit_1 = require("@/lib/services/audit");
const admin_1 = require("@/lib/supabase/admin");
const postmarkClient = process.env.POSTMARK_SERVER_TOKEN
    ? new postmark_1.ServerClient(process.env.POSTMARK_SERVER_TOKEN)
    : null;
if (process.env.SENDGRID_API_KEY)
    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
async function sendEmail(input) {
    await (0, subscription_gate_1.assertOutboundAllowed)(input.accountId);
    const from = process.env.FROM_EMAIL;
    if (!from)
        throw new Error("FROM_EMAIL missing");
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    if (input.dedupeKey) {
        const { data: existing } = await supabase
            .from("messages")
            .select("id, provider_message_id")
            .eq("account_id", input.accountId)
            .eq("channel", "EMAIL")
            .eq("direction", "OUTBOUND")
            .eq("metadata->>dedupe_key", input.dedupeKey)
            .maybeSingle();
        if (existing) {
            return { id: existing.id, providerId: String(existing.provider_message_id || "existing") };
        }
    }
    let providerMessageId = "";
    if (postmarkClient) {
        const res = await postmarkClient.sendEmail({
            From: from,
            To: input.to,
            Subject: input.subject,
            HtmlBody: input.htmlBody,
            TextBody: input.textBody
        });
        providerMessageId = String(res.MessageID);
    }
    else if (process.env.SENDGRID_API_KEY) {
        const [res] = await mail_1.default.send({
            from,
            to: input.to,
            subject: input.subject,
            html: input.htmlBody,
            text: input.textBody
        });
        providerMessageId = String(res.headers["x-message-id"] || "sendgrid-no-id");
    }
    else {
        throw new Error("No email provider configured");
    }
    const { data, error } = await supabase
        .from("messages")
        .insert({
        account_id: input.accountId,
        lead_id: input.leadId ?? null,
        channel: "EMAIL",
        direction: "OUTBOUND",
        body: input.htmlBody,
        to_email: input.to,
        from_email: from,
        subject: input.subject,
        provider_message_id: providerMessageId,
        status: "sent",
        metadata: input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}
    })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    await (0, audit_1.logAuditEvent)({
        accountId: input.accountId,
        actorUserId: input.actorUserId,
        eventType: "outbound_email_sent",
        entityType: "message",
        entityId: data.id,
        metadata: { providerId: providerMessageId }
    });
    return { id: data.id, providerId: providerMessageId };
}
