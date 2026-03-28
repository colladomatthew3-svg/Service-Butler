"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const outbound_engine_1 = require("@/lib/services/outbound-engine");
const smartlead_1 = require("@/lib/services/smartlead");
const review_mode_1 = require("@/lib/services/review-mode");
async function POST(req, { params }) {
    const { id } = await params;
    const body = (await req.json().catch(() => ({})));
    if ((0, review_mode_1.isDemoMode)()) {
        const list = (0, store_1.syncDemoOutboundList)(id, body.smartleadCampaignId);
        if (!list)
            return server_1.NextResponse.json({ error: "Outbound list not found" }, { status: 404 });
        return server_1.NextResponse.json({ outboundList: list, mode: "demo" });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const { list, prospects, partners } = await (0, outbound_engine_1.fetchOutboundListRecords)({ supabase, accountId, listId: id });
    const campaignId = body.smartleadCampaignId || list.smartlead_campaign_id;
    if (!campaignId) {
        return server_1.NextResponse.json({ error: "No Smartlead campaign ID supplied" }, { status: 400 });
    }
    if (!(0, smartlead_1.isSmartleadConfigured)()) {
        await supabase.from("smartlead_sync_logs").insert({
            account_id: accountId,
            outbound_list_id: id,
            smartlead_campaign_id: campaignId,
            action_type: "push_leads",
            status: "skipped_missing_config",
            request_payload_json: { campaign_id: campaignId },
            response_payload_json: { reason: "SMARTLEAD_API_KEY missing" }
        });
        await supabase.from("outbound_lists").update({
            export_status: "csv_ready",
            smartlead_campaign_id: campaignId
        }).eq("account_id", accountId).eq("id", id);
        return server_1.NextResponse.json({ synced: false, fallback: "csv_ready" });
    }
    const payload = [
        ...prospects.map((row) => (0, smartlead_1.mapOutboundRecordToSmartleadLead)({ ...row, kind: "prospect" })),
        ...partners.map((row) => (0, smartlead_1.mapOutboundRecordToSmartleadLead)({ ...row, kind: "referral_partner" }))
    ];
    const response = await (0, smartlead_1.addLeadsToSmartleadCampaign)(String(campaignId), payload);
    await supabase.from("smartlead_sync_logs").insert({
        account_id: accountId,
        outbound_list_id: id,
        smartlead_campaign_id: campaignId,
        action_type: "push_leads",
        status: "synced",
        request_payload_json: { lead_count: payload.length },
        response_payload_json: response
    });
    await supabase.from("outbound_lists").update({
        export_status: "synced",
        smartlead_campaign_id: campaignId
    }).eq("account_id", accountId).eq("id", id);
    return server_1.NextResponse.json({ synced: true, smartleadCampaignId: campaignId });
}
