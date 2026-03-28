"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const admin_1 = require("@/lib/supabase/admin");
const review_mode_1 = require("@/lib/services/review-mode");
async function POST(req) {
    const payload = (await req.json().catch(() => ({})));
    if ((0, review_mode_1.isDemoMode)()) {
        return server_1.NextResponse.json({ received: true, mode: "demo" });
    }
    const admin = (0, admin_1.getSupabaseAdminClient)();
    const accountId = typeof payload.account_id === "string" ? payload.account_id : null;
    const webhookType = typeof payload.event_type === "string" ? payload.event_type : "unknown";
    const smartleadCampaignId = typeof payload.campaign_id === "string" || typeof payload.campaign_id === "number"
        ? String(payload.campaign_id)
        : null;
    const { error } = await admin.from("smartlead_webhook_events").insert({
        account_id: accountId,
        webhook_type: webhookType,
        smartlead_campaign_id: smartleadCampaignId,
        payload_json: payload
    });
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ received: true });
}
