"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCampaign = createCampaign;
const cache_1 = require("next/cache");
const rbac_1 = require("@/lib/auth/rbac");
async function createCampaign(formData) {
    const { accountId, role, userId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const name = String(formData.get("name") || "");
    const channel = String(formData.get("channel") || "SMS");
    const stage = String(formData.get("stage") || "NEW");
    const subject = String(formData.get("subject") || "");
    const body = String(formData.get("body") || "");
    if (!name || !body)
        throw new Error("Name and body are required");
    const { error } = await supabase.from("campaigns").insert({
        account_id: accountId,
        name,
        channel,
        message_subject: subject || null,
        message_body: body,
        status: "DRAFT",
        segment_filter: { stage },
        created_by_user_id: userId
    });
    if (error)
        throw new Error(error.message);
    (0, cache_1.revalidatePath)("/campaigns");
}
