import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logV2AuditEvent } from "@/lib/v2/audit";
import { extractLeadChannelDestination, normalizeDestinationForChannel } from "@/lib/v2/contact-destinations";
import { verifySharedSecretWebhook } from "@/lib/v2/webhook-auth";

export async function POST(req: NextRequest) {
  const auth = verifySharedSecretWebhook(req, "outbound.reply");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    leadId?: string;
    channel?: "sms" | "email" | "voice" | "crm_task";
    providerMessageId?: string | null;
    message?: string | null;
    sequenceId?: string | null;
    assignmentId?: string | null;
    to?: string | null;
  };

  if (!body.tenantId || !body.leadId || !body.channel) {
    return NextResponse.json({ error: "tenantId, leadId, and channel are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const message = String(body.message || "");
  const optedOut = /\b(stop|unsubscribe|do not contact|quit)\b/i.test(message);
  let normalizedDestination = normalizeDestinationForChannel(body.channel, body.to || null);

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
    if (!normalizedDestination) {
      const { data: lead } = await supabase
        .from("v2_leads")
        .select("contact_channels_json")
        .eq("tenant_id", body.tenantId)
        .eq("id", body.leadId)
        .maybeSingle();

      normalizedDestination = extractLeadChannelDestination(
        body.channel,
        (lead?.contact_channels_json || {}) as Record<string, unknown>
      );
    }

    await supabase
      .from("v2_leads")
      .update({ do_not_contact: true })
      .eq("tenant_id", body.tenantId)
      .eq("id", body.leadId);

    if (normalizedDestination) {
      await supabase.from("v2_suppression_list").upsert(
        {
          tenant_id: body.tenantId,
          channel: body.channel,
          value: normalizedDestination,
          reason: "Opt-out via inbound reply"
        },
        { onConflict: "tenant_id,channel,value" }
      );
    }
  }

  await logV2AuditEvent({
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
      message,
      normalized_destination: normalizedDestination
    }
  });

  return NextResponse.json({ received: true, optedOut });
}
