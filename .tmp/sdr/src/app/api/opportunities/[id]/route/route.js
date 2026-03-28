"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const review_mode_1 = require("@/lib/services/review-mode");
const feature_flags_1 = require("@/lib/config/feature-flags");
const context_1 = require("@/lib/v2/context");
const routing_engine_1 = require("@/lib/v2/routing-engine");
const client_1 = require("@/lib/workflows/client");
async function POST(_req, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Writes) {
        return server_1.NextResponse.json({
            routed: false,
            mode: "compat",
            reason: "Enable SB_USE_V2_WRITES to route opportunities with v2 engine"
        }, { status: 202 });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (0, rbac_1.assertRole)(context.role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    try {
        const result = await (0, routing_engine_1.routeOpportunityV2)({
            supabase: context.supabase,
            tenantId: context.franchiseTenantId,
            enterpriseTenantId: context.enterpriseTenantId,
            opportunityId: id,
            actorUserId: context.userId
        });
        await client_1.inngest.send({
            name: "v2/assignment.created",
            data: {
                tenantId: context.franchiseTenantId,
                enterpriseTenantId: context.enterpriseTenantId,
                assignmentId: result.assignment.id,
                opportunityId: id,
                slaDueAt: result.assignment.sla_due_at
            }
        });
        return server_1.NextResponse.json({
            routed: true,
            decision: result.decision,
            assignment: result.assignment
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Routing failed";
        return server_1.NextResponse.json({ error: message }, { status: 400 });
    }
}
