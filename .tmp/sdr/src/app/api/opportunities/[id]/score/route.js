"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const review_mode_1 = require("@/lib/services/review-mode");
const feature_flags_1 = require("@/lib/config/feature-flags");
const context_1 = require("@/lib/v2/context");
const opportunities_1 = require("@/lib/v2/opportunities");
async function POST(_req, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Writes) {
        return server_1.NextResponse.json({
            scored: false,
            mode: "compat",
            reason: "Enable SB_USE_V2_WRITES to score opportunities with v2 engine"
        }, { status: 202 });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (0, rbac_1.assertRole)(context.role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    try {
        const scored = await (0, opportunities_1.rescoreOpportunityV2)({
            supabase: context.supabase,
            tenantId: context.franchiseTenantId,
            opportunityId: id,
            actorUserId: context.userId
        });
        return server_1.NextResponse.json({ scored: true, opportunity: scored });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Score operation failed";
        return server_1.NextResponse.json({ error: message }, { status: 400 });
    }
}
