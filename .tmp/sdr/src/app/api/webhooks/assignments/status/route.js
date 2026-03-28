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
    if (!body.tenantId || !body.assignmentId || !body.status) {
        return server_1.NextResponse.json({ error: "tenantId, assignmentId, and status are required" }, { status: 400 });
    }
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const patch = {};
    if (body.status === "accepted") {
        patch.status = "accepted";
        patch.accepted_at = new Date().toISOString();
    }
    else if (body.status === "rejected") {
        patch.status = "rejected";
        patch.escalated_at = new Date().toISOString();
    }
    else {
        patch.status = "complete";
        patch.completed_at = new Date().toISOString();
    }
    const { data: updated, error } = await supabase
        .from("v2_assignments")
        .update(patch)
        .eq("tenant_id", body.tenantId)
        .eq("id", body.assignmentId)
        .select("id,status,opportunity_id")
        .single();
    if (error || !updated)
        return server_1.NextResponse.json({ error: error?.message || "Assignment not found" }, { status: 404 });
    await supabase
        .from("v2_opportunities")
        .update({ routing_status: body.status === "rejected" ? "escalated" : body.status === "complete" ? "complete" : "routed" })
        .eq("id", updated.opportunity_id)
        .eq("tenant_id", body.tenantId);
    await (0, audit_1.logV2AuditEvent)({
        tenantId: body.tenantId,
        actorType: "webhook",
        actorId: "assignment.status",
        entityType: "assignment",
        entityId: body.assignmentId,
        action: `assignment_${body.status}`,
        before: null,
        after: { status: body.status }
    });
    return server_1.NextResponse.json({ received: true, assignment: updated });
}
