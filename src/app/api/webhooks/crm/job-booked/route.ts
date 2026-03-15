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
    jobId?: string;
    leadId?: string | null;
    externalCrmId?: string | null;
    jobType?: string | null;
    bookedAt?: string | null;
    scheduledAt?: string | null;
    revenueAmount?: number | null;
    status?: string | null;
    primaryOpportunityId?: string | null;
    sourceEventId?: string | null;
    campaignId?: string | null;
  };

  if (!body.tenantId || !body.jobId) {
    return NextResponse.json({ error: "tenantId and jobId are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  const { data: job, error: jobError } = await supabase
    .from("v2_jobs")
    .upsert(
      {
        id: body.jobId,
        tenant_id: body.tenantId,
        lead_id: body.leadId || null,
        external_crm_id: body.externalCrmId || null,
        job_type: body.jobType || null,
        booked_at: body.bookedAt || new Date().toISOString(),
        scheduled_at: body.scheduledAt || null,
        revenue_amount: Number.isFinite(body.revenueAmount) ? Number(body.revenueAmount) : null,
        status: body.status || "booked"
      },
      { onConflict: "id" }
    )
    .select("id,tenant_id,lead_id,status")
    .single();

  if (jobError || !job) return NextResponse.json({ error: jobError?.message || "Failed to upsert job" }, { status: 400 });

  await supabase
    .from("v2_job_attributions")
    .upsert(
      {
        tenant_id: body.tenantId,
        job_id: body.jobId,
        primary_opportunity_id: body.primaryOpportunityId || null,
        source_event_id: body.sourceEventId || null,
        campaign_id: body.campaignId || null,
        attribution_confidence: body.primaryOpportunityId ? 85 : 45,
        locked: true
      },
      { onConflict: "job_id" }
    );

  await logV2AuditEvent({
    tenantId: body.tenantId,
    actorType: "webhook",
    actorId: "crm.job_booked",
    entityType: "job",
    entityId: body.jobId,
    action: "crm_job_booked",
    before: null,
    after: body as unknown as Record<string, unknown>
  });

  return NextResponse.json({ received: true, jobId: body.jobId });
}
