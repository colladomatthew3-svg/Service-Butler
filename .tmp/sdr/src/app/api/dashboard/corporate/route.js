"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const feature_flags_1 = require("@/lib/config/feature-flags");
const review_mode_1 = require("@/lib/services/review-mode");
const context_1 = require("@/lib/v2/context");
const dashboard_read_models_1 = require("@/lib/v2/dashboard-read-models");
async function GET() {
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Reads) {
        return server_1.NextResponse.json({ mode: "compat", metrics: [], byFranchise: [] });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (0, rbac_1.assertRole)(context.role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    try {
        const data = await (0, dashboard_read_models_1.getCorporateDashboardReadModel)({
            supabase: context.supabase,
            enterpriseTenantId: context.enterpriseTenantId
        });
        return server_1.NextResponse.json(data);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Corporate dashboard read model failed";
        return server_1.NextResponse.json({ error: message }, { status: 400 });
    }
}
