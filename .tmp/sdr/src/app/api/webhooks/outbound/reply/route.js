"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const admin_1 = require("@/lib/supabase/admin");
const audit_1 = require("@/lib/v2/audit");
function authorized(req) {
    const expected = process.env.WEBHOOK_SHARED_SECRET;
    if (!expected)
        return true;
    const received = req.headers.get("x-servicebutler-signature") || "";
    return received === expected;
}
async function POST(req) {
    if (!authorized(req))
        return server_1.NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    const body = (await req.json().catch(() => ({})));
    if (!body.tenantId || !body.leadId || !body.channel) {
        return server_1.NextResponse.json({ error: "tenantId, leadId, and channel are required" }, { status: 400 });
    }
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const message = String(body.message || "");
    const optedOut = /\b(stop|unsubscribe|do not contact|quit)\b/i.test(message);
    await supabase.from("v2_outreach_events").insert({
        tenant_id: body.tenantId,
        lead_id: body.leadId,
        sequence_id: body.sequenceId || null,
        assignment_id: body.assignmentId || null,
        channel: body.channel,
        event_type: "replied",
        response_at: new Date().toISOString(),
        provider_message_id: body.providerMessageId || null,
        outcome: optedOut ? "opt_out" : "reply_received",
        metadata: {
            message: body.message || null
        }
    });
    if (optedOut) {
        await supabase
            .from("v2_leads")
            .update({ do_not_contact: true })
            .eq("tenant_id", body.tenantId)
            .eq("id", body.leadId);
        await supabase.from("v2_suppression_list").upsert({
            tenant_id: body.tenantId,
            channel: body.channel,
            value: body.providerMessageId || body.leadId,
            reason: "Opt-out via inbound reply"
        }, { onConflict: "tenant_id,channel,value" });
    }
    await (0, audit_1.logV2AuditEvent)({
        tenantId: body.tenantId,
        actorType: "webhook",
        actorId: "outbound.reply",
        entityType: "lead",
        entityId: body.leadId,
        action: optedOut ? "lead_opted_out" : "outbound_reply_received",
        before: null,
        after: {
            channel: body.channel,
            provider_message_id: body.providerMessageId,
            message
        }
    });
    return server_1.NextResponse.json({ received: true, optedOut });
}
