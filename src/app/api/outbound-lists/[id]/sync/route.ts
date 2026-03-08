import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { syncDemoOutboundList } from "@/lib/demo/store";
import { fetchOutboundListRecords } from "@/lib/services/outbound-engine";
import { addLeadsToSmartleadCampaign, isSmartleadConfigured, mapOutboundRecordToSmartleadLead } from "@/lib/services/smartlead";
import { isDemoMode } from "@/lib/services/review-mode";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { smartleadCampaignId?: string | null };

  if (isDemoMode()) {
    const list = syncDemoOutboundList(id, body.smartleadCampaignId);
    if (!list) return NextResponse.json({ error: "Outbound list not found" }, { status: 404 });
    return NextResponse.json({ outboundList: list, mode: "demo" });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const { list, prospects, partners } = await fetchOutboundListRecords({ supabase, accountId, listId: id });
  const campaignId = body.smartleadCampaignId || list.smartlead_campaign_id;

  if (!campaignId) {
    return NextResponse.json({ error: "No Smartlead campaign ID supplied" }, { status: 400 });
  }

  if (!isSmartleadConfigured()) {
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

    return NextResponse.json({ synced: false, fallback: "csv_ready" });
  }

  const payload = [
    ...prospects.map((row) => mapOutboundRecordToSmartleadLead({ ...row, kind: "prospect" })),
    ...partners.map((row) => mapOutboundRecordToSmartleadLead({ ...row, kind: "referral_partner" }))
  ];

  const response = await addLeadsToSmartleadCampaign(String(campaignId), payload);

  await supabase.from("smartlead_sync_logs").insert({
    account_id: accountId,
    outbound_list_id: id,
    smartlead_campaign_id: campaignId,
    action_type: "push_leads",
    status: "synced",
    request_payload_json: { lead_count: payload.length },
    response_payload_json: response as Record<string, unknown>
  });

  await supabase.from("outbound_lists").update({
    export_status: "synced",
    smartlead_campaign_id: campaignId
  }).eq("account_id", accountId).eq("id", id);

  return NextResponse.json({ synced: true, smartleadCampaignId: campaignId });
}
