"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReviewMode = isReviewMode;
exports.isDemoMode = isDemoMode;
exports.isLocalBypassMode = isLocalBypassMode;
exports.resolveReviewAccountId = resolveReviewAccountId;
exports.getReviewUserId = getReviewUserId;
exports.getReviewEmail = getReviewEmail;
const admin_1 = require("@/lib/supabase/admin");
const FALLBACK_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000001";
function flagEnabled(value) {
    return typeof value === "string" && ["1", "true", "on", "yes"].includes(value.toLowerCase());
}
function allowNonDevDemoMode() {
    return flagEnabled(process.env.ALLOW_NON_DEV_DEMO_MODE);
}
function isReviewMode() {
    return process.env.NODE_ENV === "development" && flagEnabled(process.env.REVIEW_MODE);
}
function isDemoMode() {
    if (!flagEnabled(process.env.DEMO_MODE))
        return false;
    return process.env.NODE_ENV === "development" || allowNonDevDemoMode();
}
function isLocalBypassMode() {
    return isReviewMode() || isDemoMode();
}
async function resolveReviewAccountId() {
    if (!isLocalBypassMode())
        return FALLBACK_ACCOUNT_ID;
    if (isDemoMode())
        return FALLBACK_ACCOUNT_ID;
    try {
        const admin = (0, admin_1.getSupabaseAdminClient)();
        const { data } = await admin.from("accounts").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
        return data?.id || FALLBACK_ACCOUNT_ID;
    }
    catch {
        return FALLBACK_ACCOUNT_ID;
    }
}
function getReviewUserId() {
    return FALLBACK_USER_ID;
}
function getReviewEmail() {
    return "owner@servicebutler.local";
}
