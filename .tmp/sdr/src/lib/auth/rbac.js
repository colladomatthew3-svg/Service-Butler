"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUserContext = getCurrentUserContext;
exports.assertRole = assertRole;
const server_1 = require("@/lib/supabase/server");
const admin_1 = require("@/lib/supabase/admin");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
async function getCurrentUserContext() {
    if ((0, review_mode_1.isDemoMode)()) {
        const demo = (0, store_1.getDemoAccountContext)();
        return {
            userId: demo.userId,
            email: demo.email,
            accountId: demo.accountId,
            role: "ACCOUNT_OWNER",
            supabase: null
        };
    }
    if ((0, review_mode_1.isLocalBypassMode)()) {
        const accountId = await (0, review_mode_1.resolveReviewAccountId)();
        return {
            userId: (0, review_mode_1.getReviewUserId)(),
            email: (0, review_mode_1.getReviewEmail)(),
            accountId,
            role: "ACCOUNT_OWNER",
            supabase: (0, admin_1.getSupabaseAdminClient)()
        };
    }
    const supabase = await (0, server_1.getSupabaseServerClient)();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user)
        throw new Error("Unauthorized");
    const { data: membership, error } = await supabase
        .from("account_roles")
        .select("account_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
    if (error || !membership)
        throw new Error("No active account membership");
    return {
        userId: user.id,
        email: user.email || null,
        accountId: membership.account_id,
        role: membership.role,
        supabase
    };
}
function assertRole(current, allowed) {
    if (!allowed.includes(current))
        throw new Error("Insufficient role");
}
