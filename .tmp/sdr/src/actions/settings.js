"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = updateSettings;
const cache_1 = require("next/cache");
const rbac_1 = require("@/lib/auth/rbac");
const phone_1 = require("@/lib/validators/phone");
async function updateSettings(formData) {
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const twilioPhone = String(formData.get("twilio_phone_number") || "");
    const reviewLink = String(formData.get("review_link") || "");
    const quietStart = String(formData.get("quiet_hours_start") || "");
    const quietEnd = String(formData.get("quiet_hours_end") || "");
    const businessHours = String(formData.get("business_hours") || "{}");
    const { error } = await supabase.from("account_settings").upsert({
        account_id: accountId,
        twilio_phone_number: twilioPhone ? (0, phone_1.normalizeToE164)(twilioPhone) : null,
        review_link: reviewLink || null,
        quiet_hours_start: quietStart || null,
        quiet_hours_end: quietEnd || null,
        business_hours: JSON.parse(businessHours)
    });
    if (error)
        throw new Error(error.message);
    (0, cache_1.revalidatePath)("/settings");
}
