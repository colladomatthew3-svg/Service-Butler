"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const sms_1 = require("@/lib/services/sms");
const email_1 = require("@/lib/services/email");
async function parseBody(req) {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json"))
        return req.json();
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}
async function POST(req) {
    const { accountId, role, userId } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const body = await parseBody(req);
    const { leadId, channel, to, message, subject } = body;
    if (!leadId || !channel || !to || !message) {
        return server_1.NextResponse.json({ error: "leadId, channel, to, message are required" }, { status: 400 });
    }
    if (channel === "SMS") {
        const result = await (0, sms_1.sendSms)({ accountId, leadId, to, body: message, actorUserId: userId });
        return server_1.NextResponse.json({ ok: true, messageId: result.id });
    }
    if (channel === "EMAIL") {
        const result = await (0, email_1.sendEmail)({
            accountId,
            leadId,
            to,
            subject: subject || "Message from ServiceButler.ai",
            htmlBody: message,
            textBody: message.replace(/<[^>]+>/g, ""),
            actorUserId: userId
        });
        return server_1.NextResponse.json({ ok: true, messageId: result.id });
    }
    return server_1.NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
}
