"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const admin_1 = require("@/lib/supabase/admin");
const audit_1 = require("@/lib/v2/audit");
function authorized(req) {
    const expected = process.env.WEBHOOK_SHARED_SECRET;
    if (!expected)
        return true;
    const received = req.headers.get("x-servicebutler-signature") || "";
    return received === expected;
}
async function POST(req) {
    if (!authorized(req))
        return server_1.NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    const body = (await req.json().catch(() => ({})));
    if (!body.tenantId || !body.runId || !body.status) {
        return server_1.NextResponse.json({ error: "tenantId, runId, and status are required" }, { status: 400 });
    }
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const { data: updated, error } = await supabase
        .from("v2_connector_runs")
        .update({
        status: body.status,
        completed_at: new Date().toISOString(),
        records_seen: Number.isFinite(body.recordsSeen) ? Number(body.recordsSeen) : 0,
        records_created: Number.isFinite(body.recordsCreated) ? Number(body.recordsCreated) : 0,
        error_summary: body.errorSummary || null
    })
        .eq("tenant_id", body.tenantId)
        .eq("id", body.runId)
        .select("id,status,records_seen,records_created")
        .single();
    if (error || !updated)
        return server_1.NextResponse.json({ error: error?.message || "Connector run not found" }, { status: 404 });
    await (0, audit_1.logV2AuditEvent)({
        tenantId: body.tenantId,
        actorType: "webhook",
        actorId: "connectors.completed",
        entityType: "connector_run",
        entityId: body.runId,
        action: `connector_run_${body.status}`,
        before: null,
        after: {
            records_seen: updated.records_seen,
            records_created: updated.records_created,
            error_summary: body.errorSummary || null
        }
    });
    return server_1.NextResponse.json({ received: true, connectorRun: updated });
}
