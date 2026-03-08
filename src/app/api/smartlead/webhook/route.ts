import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/services/review-mode";

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (isDemoMode()) {
    return NextResponse.json({ received: true, mode: "demo" });
  }

  const admin = getSupabaseAdminClient();
  const accountId = typeof payload.account_id === "string" ? payload.account_id : null;
  const webhookType = typeof payload.event_type === "string" ? payload.event_type : "unknown";
  const smartleadCampaignId =
    typeof payload.campaign_id === "string" || typeof payload.campaign_id === "number"
      ? String(payload.campaign_id)
      : null;

  const { error } = await admin.from("smartlead_webhook_events").insert({
    account_id: accountId,
    webhook_type: webhookType,
    smartlead_campaign_id: smartleadCampaignId,
    payload_json: payload
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ received: true });
}
