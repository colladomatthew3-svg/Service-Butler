"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const admin_1 = require("@/lib/supabase/admin");
const booked_job_webhook_1 = require("@/lib/v2/booked-job-webhook");
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
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const body = (await req.json().catch(() => ({})));
    try {
        const result = await (0, booked_job_webhook_1.processBookedJobWebhook)({
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
        return server_1.NextResponse.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Webhook processing failed";
        return server_1.NextResponse.json({ error: message }, { status: 400 });
    }
}
