import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext, assertRole } from "@/lib/auth/rbac";
import { inngest } from "@/lib/workflows/client";

async function parseBody(req: NextRequest) {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) return req.json();
  const form = await req.formData();
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export async function POST(req: NextRequest) {
  const { accountId, role, userId, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const { campaignId } = await parseBody(req);
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("account_id", accountId)
    .eq("id", campaignId)
    .single();

  if (error || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await supabase.from("campaigns").update({ status: "SCHEDULED" }).eq("id", campaign.id).eq("account_id", accountId);

  await inngest.send({
    name: "campaign/send",
    data: { accountId, campaignId: campaign.id, actorUserId: userId }
  });

  return NextResponse.json({ ok: true });
}
