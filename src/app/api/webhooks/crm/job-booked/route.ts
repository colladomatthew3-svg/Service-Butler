import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { processBookedJobWebhook } from "@/lib/v2/booked-job-webhook";

function authorized(req: NextRequest) {
  const expected = process.env.WEBHOOK_SHARED_SECRET;
  if (!expected) return true;
  const received = req.headers.get("x-servicebutler-signature") || "";
  return received === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const result = await processBookedJobWebhook({
      supabase,
      payload: {
        tenantId: typeof body.tenantId === "string" ? body.tenantId : undefined,
        jobId: typeof body.jobId === "string" ? body.jobId : undefined,
        webhookEventId: typeof body.webhookEventId === "string" ? body.webhookEventId : null,
        leadId: typeof body.leadId === "string" ? body.leadId : null,
        externalCrmId: typeof body.externalCrmId === "string" ? body.externalCrmId : null,
        jobType: typeof body.jobType === "string" ? body.jobType : null,
        bookedAt: typeof body.bookedAt === "string" ? body.bookedAt : null,
        scheduledAt: typeof body.scheduledAt === "string" ? body.scheduledAt : null,
        revenueAmount: Number.isFinite(body.revenueAmount) ? Number(body.revenueAmount) : null,
        status: typeof body.status === "string" ? body.status : null,
        primaryOpportunityId: typeof body.primaryOpportunityId === "string" ? body.primaryOpportunityId : null,
        sourceEventId: typeof body.sourceEventId === "string" ? body.sourceEventId : null,
        campaignId: typeof body.campaignId === "string" ? body.campaignId : null
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
