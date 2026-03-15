import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logV2AuditEvent } from "@/lib/v2/audit";

function authorized(req: NextRequest) {
  const expected = process.env.WEBHOOK_SHARED_SECRET;
  if (!expected) return true;
  const received = req.headers.get("x-servicebutler-signature") || "";
  return received === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    leadId?: string;
    channel?: "sms" | "email" | "voice" | "crm_task";
    providerMessageId?: string | null;
    message?: string | null;
    sequenceId?: string | null;
    assignmentId?: string | null;
  };

  if (!body.tenantId || !body.leadId || !body.channel) {
    return NextResponse.json({ error: "tenantId, leadId, and channel are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
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

    await supabase.from("v2_suppression_list").upsert(
      {
        tenant_id: body.tenantId,
        channel: body.channel,
        value: body.providerMessageId || body.leadId,
        reason: "Opt-out via inbound reply"
      },
      { onConflict: "tenant_id,channel,value" }
    );
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
      message
    }
  });

  return NextResponse.json({ received: true, optedOut });
}
