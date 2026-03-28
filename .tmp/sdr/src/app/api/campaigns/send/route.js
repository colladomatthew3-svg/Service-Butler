"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const client_1 = require("@/lib/workflows/client");
async function parseBody(req) {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json"))
        return req.json();
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}
async function POST(req) {
    const { accountId, role, userId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const { campaignId } = await parseBody(req);
    if (!campaignId)
        return server_1.NextResponse.json({ error: "campaignId required" }, { status: 400 });
    const { data: campaign, error } = await supabase
        .from("campaigns")
        .select("id")
        .eq("account_id", accountId)
        .eq("id", campaignId)
        .single();
    if (error || !campaign)
        return server_1.NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    await supabase.from("campaigns").update({ status: "SCHEDULED" }).eq("id", campaign.id).eq("account_id", accountId);
    await client_1.inngest.send({
        name: "campaign/send",
        data: { accountId, campaignId: campaign.id, actorUserId: userId }
    });
    return server_1.NextResponse.json({ ok: true });
}
