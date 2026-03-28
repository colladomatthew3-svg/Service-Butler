"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchOutreach = dispatchOutreach;
const hubspot_1 = require("@/lib/v2/hubspot");
const twilio_1 = require("@/lib/v2/twilio");
const audit_1 = require("@/lib/v2/audit");
const DEFAULT_COOLING_WINDOW_MINUTES = 240;
async function isSuppressed({ supabase, tenantId, channel, value }) {
    const { data } = await supabase
        .from("v2_suppression_list")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("channel", channel)
        .eq("value", value)
        .maybeSingle();
    return Boolean(data?.id);
}
async function recentlySent({ supabase, tenantId, leadId, channel, coolingWindowMinutes }) {
    const since = new Date(Date.now() - coolingWindowMinutes * 60_000).toISOString();
    const { count } = await supabase
        .from("v2_outreach_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("lead_id", leadId)
        .eq("channel", channel)
        .in("event_type", ["sent", "delivered"])
        .gte("created_at", since);
    return Number(count || 0) > 0;
}
async function leadIsDoNotContact({ supabase, tenantId, leadId }) {
    const { data } = await supabase
        .from("v2_leads")
        .select("do_not_contact")
        .eq("tenant_id", tenantId)
        .eq("id", leadId)
        .maybeSingle();
    return Boolean(data?.do_not_contact);
}
async function insertOutreachEvent(input) {
    await input.supabase.from("v2_outreach_events").insert({
        tenant_id: input.tenantId,
        lead_id: input.leadId,
        assignment_id: input.assignmentId || null,
        sequence_id: input.sequenceId || null,
        channel: input.channel,
        event_type: input.eventType,
        sent_at: input.eventType === "sent" || input.eventType === "delivered" ? new Date().toISOString() : null,
        provider_message_id: input.providerMessageId || null,
        outcome: input.outcome || null,
        metadata: input.metadata || {}
    });
}
async function dispatchOutreach(input) {
    const coolingWindowMinutes = Math.max(5, Number(input.coolingWindowMinutes || DEFAULT_COOLING_WINDOW_MINUTES));
    const blockedByLead = await leadIsDoNotContact({
        supabase: input.supabase,
        tenantId: input.tenantId,
        leadId: input.leadId
    });
    if (blockedByLead) {
        await insertOutreachEvent({
            supabase: input.supabase,
            tenantId: input.tenantId,
            leadId: input.leadId,
            assignmentId: input.assignmentId,
            sequenceId: input.sequenceId,
            channel: input.channel,
            eventType: "skipped",
            outcome: "lead_marked_do_not_contact"
        });
        return { sent: false, skipped: true, reason: "lead_marked_do_not_contact" };
    }
    const suppressed = await isSuppressed({
        supabase: input.supabase,
        tenantId: input.tenantId,
        channel: input.channel,
        value: input.to
    });
    if (suppressed) {
        await insertOutreachEvent({
            supabase: input.supabase,
            tenantId: input.tenantId,
            leadId: input.leadId,
            assignmentId: input.assignmentId,
            sequenceId: input.sequenceId,
            channel: input.channel,
            eventType: "skipped",
            outcome: "suppressed"
        });
        return { sent: false, skipped: true, reason: "suppressed" };
    }
    const cooled = await recentlySent({
        supabase: input.supabase,
        tenantId: input.tenantId,
        leadId: input.leadId,
        channel: input.channel,
        coolingWindowMinutes
    });
    if (cooled) {
        await insertOutreachEvent({
            supabase: input.supabase,
            tenantId: input.tenantId,
            leadId: input.leadId,
            assignmentId: input.assignmentId,
            sequenceId: input.sequenceId,
            channel: input.channel,
            eventType: "skipped",
            outcome: "cooling_window"
        });
        return { sent: false, skipped: true, reason: "cooling_window" };
    }
    await insertOutreachEvent({
        supabase: input.supabase,
        tenantId: input.tenantId,
        leadId: input.leadId,
        assignmentId: input.assignmentId,
        sequenceId: input.sequenceId,
        channel: input.channel,
        eventType: "queued"
    });
    try {
        let providerMessageId = null;
        let outcome = "queued";
        if (input.channel === "sms") {
            const sent = await (0, twilio_1.sendTwilioMessage)({ to: input.to, body: input.body });
            providerMessageId = sent.providerId;
            if (sent.skipped) {
                outcome = String(sent.reason || "skipped");
            }
            else if (sent.mode === "safe") {
                outcome = "sent_via_twilio_safe_mode";
            }
            else {
                outcome = "sent_via_twilio";
            }
        }
        else if (input.channel === "voice") {
            const voice = await (0, twilio_1.queueTwilioVoiceTask)({ to: input.to, note: input.body });
            providerMessageId = voice.providerId;
            if (voice.skipped) {
                outcome = String(voice.reason || "skipped");
            }
            else if (voice.mode === "safe") {
                outcome = "voice_task_safe_mode";
            }
            else {
                outcome = "voice_task_created";
            }
        }
        else if (input.channel === "crm_task") {
            const task = await (0, hubspot_1.createHubSpotTask)({
                title: input.subject || "Service Butler follow-up",
                body: input.body,
                dueAtIso: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });
            providerMessageId = task.providerId;
            if (task.skipped) {
                outcome = String(task.reason || "skipped");
            }
            else if (task.mode === "safe") {
                outcome = "hubspot_task_safe_mode";
            }
            else {
                outcome = "hubspot_task_created";
            }
        }
        else if (input.channel === "email") {
            outcome = "email_template_queued";
        }
        await insertOutreachEvent({
            supabase: input.supabase,
            tenantId: input.tenantId,
            leadId: input.leadId,
            assignmentId: input.assignmentId,
            sequenceId: input.sequenceId,
            channel: input.channel,
            eventType: "sent",
            providerMessageId,
            outcome,
            metadata: {
                cooling_window_minutes: coolingWindowMinutes
            }
        });
        await (0, audit_1.logV2AuditEvent)({
            tenantId: input.tenantId,
            actorType: "user",
            actorId: input.actorUserId,
            entityType: "lead",
            entityId: input.leadId,
            action: "outreach_dispatched",
            before: null,
            after: {
                channel: input.channel,
                to: input.to,
                outcome,
                provider_message_id: providerMessageId
            }
        });
        return {
            sent: true,
            skipped: false,
            providerMessageId,
            outcome
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "outreach_failed";
        await insertOutreachEvent({
            supabase: input.supabase,
            tenantId: input.tenantId,
            leadId: input.leadId,
            assignmentId: input.assignmentId,
            sequenceId: input.sequenceId,
            channel: input.channel,
            eventType: "failed",
            outcome: message
        });
        await (0, audit_1.logV2AuditEvent)({
            tenantId: input.tenantId,
            actorType: "user",
            actorId: input.actorUserId,
            entityType: "lead",
            entityId: input.leadId,
            action: "outreach_failed",
            before: null,
            after: {
                channel: input.channel,
                error: message
            }
        });
        throw error;
    }
}
