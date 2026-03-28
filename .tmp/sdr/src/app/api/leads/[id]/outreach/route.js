"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const review_mode_1 = require("@/lib/services/review-mode");
const feature_flags_1 = require("@/lib/config/feature-flags");
const context_1 = require("@/lib/v2/context");
const outreach_orchestrator_1 = require("@/lib/v2/outreach-orchestrator");
async function POST(req, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)() || !feature_flags_1.featureFlags.useV2Writes) {
        return server_1.NextResponse.json({
            ok: false,
            mode: "compat",
            reason: "Enable SB_USE_V2_WRITES to dispatch outreach through v2"
        }, { status: 202 });
    }
    const context = await (0, context_1.getV2TenantContext)();
    if (!context)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    (0, rbac_1.assertRole)(context.role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const body = (await req.json().catch(() => ({})));
    if (!body.channel || !body.to || !body.message) {
        return server_1.NextResponse.json({ error: "channel, to, and message are required" }, { status: 400 });
    }
    try {
        const result = await (0, outreach_orchestrator_1.dispatchOutreach)({
            supabase: context.supabase,
            tenantId: context.franchiseTenantId,
            leadId: id,
            assignmentId: body.assignmentId || null,
            sequenceId: body.sequenceId || null,
            actorUserId: context.userId,
            channel: body.channel,
            to: body.to,
            body: body.message,
            subject: body.subject || null,
            coolingWindowMinutes: body.coolingWindowMinutes
        });
        return server_1.NextResponse.json({ ok: true, result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Outreach dispatch failed";
        return server_1.NextResponse.json({ error: message }, { status: 400 });
    }
}
