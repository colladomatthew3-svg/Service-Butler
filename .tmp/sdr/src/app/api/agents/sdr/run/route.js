"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const feature_flags_1 = require("@/lib/config/feature-flags");
const review_mode_1 = require("@/lib/services/review-mode");
const context_1 = require("@/lib/v2/context");
const sdr_agent_1 = require("@/lib/v2/sdr-agent");
async function POST(req) {
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Writes) {
        return server_1.NextResponse.json({
            ok: false,
            mode: "compat",
            reason: "Enable SB_USE_V2_WRITES to run SDR agent in v2 mode"
        }, { status: 202 });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (0, rbac_1.assertRole)(context.role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const body = (await req.json().catch(() => ({})));
    try {
        const result = await (0, sdr_agent_1.runSdrAgentV2)({
            supabase: context.supabase,
            tenantId: context.franchiseTenantId,
            enterpriseTenantId: context.enterpriseTenantId,
            actorUserId: context.userId,
            sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : undefined,
            maxSources: body.maxSources,
            maxOpportunities: body.maxOpportunities,
            maxLeadsToCreate: body.maxLeadsToCreate,
            minJobLikelihood: body.minJobLikelihood,
            minUrgency: body.minUrgency,
            minSourceReliability: body.minSourceReliability,
            minVerificationScore: body.minVerificationScore,
            runConnectors: body.runConnectors ?? true,
            autoRoute: body.autoRoute ?? true,
            autoOutreach: body.autoOutreach ?? false,
            enableEnrichment: body.enableEnrichment ?? true,
            dryRun: body.dryRun ?? false,
            dualWriteLegacy: body.dualWriteLegacy ?? true
        });
        return server_1.NextResponse.json({ ok: true, result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "SDR agent failed";
        return server_1.NextResponse.json({ error: message }, { status: 400 });
    }
}
