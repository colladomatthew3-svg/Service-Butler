import { createHubSpotTask } from "@/lib/v2/hubspot";
import { queueTwilioVoiceTask, sendTwilioMessage } from "@/lib/v2/twilio";
import { logV2AuditEvent } from "@/lib/v2/audit";
import { normalizeDestinationForChannel } from "@/lib/v2/contact-destinations";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_COOLING_WINDOW_MINUTES = 240;

type DispatchInput = {
  supabase: SupabaseClient;
  tenantId: string;
  leadId: string;
  assignmentId?: string | null;
  sequenceId?: string | null;
  actorUserId: string;
  channel: "sms" | "email" | "voice" | "crm_task";
  to: string;
  body: string;
  subject?: string | null;
  coolingWindowMinutes?: number;
};

async function isSuppressed({
  supabase,
  tenantId,
  channel,
  value
}: {
  supabase: SupabaseClient;
  tenantId: string;
  channel: string;
  value: string;
}) {
  const normalizedValue = normalizeDestinationForChannel(channel, value) || String(value || "").trim();
  const { data } = await supabase
    .from("v2_suppression_list")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("value", normalizedValue)
    .maybeSingle();

  return Boolean(data?.id);
}

async function recentlySent({
  supabase,
  tenantId,
  leadId,
  channel,
  coolingWindowMinutes
}: {
  supabase: SupabaseClient;
  tenantId: string;
  leadId: string;
  channel: string;
  coolingWindowMinutes: number;
}) {
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

async function leadIsDoNotContact({ supabase, tenantId, leadId }: { supabase: SupabaseClient; tenantId: string; leadId: string }) {
  const { data } = await supabase
    .from("v2_leads")
    .select("do_not_contact")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();

  return Boolean(data?.do_not_contact);
}

async function insertOutreachEvent(input: {
  supabase: SupabaseClient;
  tenantId: string;
  leadId: string;
  assignmentId?: string | null;
  sequenceId?: string | null;
  channel: string;
  eventType: "queued" | "sent" | "delivered" | "replied" | "failed" | "skipped";
  outcome?: string;
  providerMessageId?: string | null;
  metadata?: Record<string, unknown>;
}) {
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

export async function dispatchOutreach(input: DispatchInput) {
  const coolingWindowMinutes = Math.max(5, Number(input.coolingWindowMinutes || DEFAULT_COOLING_WINDOW_MINUTES));
  const destination = normalizeDestinationForChannel(input.channel, input.to) || input.to;

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
    value: destination
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
    let providerMessageId: string | null = null;
    let outcome = "queued";

    if (input.channel === "sms") {
      const sent = await sendTwilioMessage({ to: input.to, body: input.body });
      providerMessageId = sent.providerId;
      if (sent.skipped) {
        outcome = String(sent.reason || "skipped");
      } else if (sent.mode === "safe") {
        outcome = "sent_via_twilio_safe_mode";
      } else {
        outcome = "sent_via_twilio";
      }
    } else if (input.channel === "voice") {
      const voice = await queueTwilioVoiceTask({ to: input.to, note: input.body });
      providerMessageId = voice.providerId;
      if (voice.skipped) {
        outcome = String(voice.reason || "skipped");
      } else if (voice.mode === "safe") {
        outcome = "voice_task_safe_mode";
      } else {
        outcome = "voice_task_created";
      }
    } else if (input.channel === "crm_task") {
      const task = await createHubSpotTask({
        title: input.subject || "Service Butler follow-up",
        body: input.body,
        dueAtIso: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
      providerMessageId = task.providerId;
      if (task.skipped) {
        outcome = String(task.reason || "skipped");
      } else if (task.mode === "safe") {
        outcome = "hubspot_task_safe_mode";
      } else {
        outcome = "hubspot_task_created";
      }
    } else if (input.channel === "email") {
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

    await logV2AuditEvent({
      tenantId: input.tenantId,
      actorType: "user",
      actorId: input.actorUserId,
      entityType: "lead",
      entityId: input.leadId,
      action: "outreach_dispatched",
      before: null,
      after: {
        channel: input.channel,
        to: destination,
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
  } catch (error) {
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

    await logV2AuditEvent({
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
