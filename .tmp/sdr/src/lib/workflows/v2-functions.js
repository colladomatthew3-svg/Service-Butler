"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v2AssignmentSlaWatch = exports.v2ConnectorRunRequested = void 0;
const client_1 = require("@/lib/workflows/client");
const admin_1 = require("@/lib/supabase/admin");
const registry_1 = require("@/lib/v2/connectors/registry");
const runner_1 = require("@/lib/v2/connectors/runner");
const audit_1 = require("@/lib/v2/audit");
exports.v2ConnectorRunRequested = client_1.inngest.createFunction({ id: "v2_connector_run_requested" }, { event: "v2/connector.run.requested" }, async ({ event, step }) => {
    const { tenantId, sourceId, connectorKey, actorUserId } = event.data;
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const source = await step.run("load-source", async () => {
        const { data } = await supabase
            .from("v2_data_sources")
            .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags")
            .eq("tenant_id", tenantId)
            .eq("id", sourceId)
            .maybeSingle();
        return data;
    });
    if (!source)
        return { ok: false, reason: "source_not_found" };
    const key = String(connectorKey || "") ||
        (String(source.source_type || "").toLowerCase().includes("weather")
            ? "weather.noaa"
            : String(source.source_type || "").toLowerCase().includes("permit")
                ? "permits.placeholder"
                : String(source.source_type || "").toLowerCase().includes("social")
                    ? "social.intent.placeholder"
                    : "incidents.generic");
    const connector = (0, registry_1.getConnectorByKey)(key);
    if (!connector)
        return { ok: false, reason: `connector_not_found:${key}` };
    const result = await step.run("run-connector", async () => (0, runner_1.runConnectorForSource)({
        supabase,
        tenantId,
        sourceId: String(source.id),
        sourceType: String(source.source_type || "unknown"),
        sourceConfig: {
            connector_name: source.name,
            rate_limit_policy: source.rate_limit_policy,
            compliance_flags: source.compliance_flags,
            config_encrypted: source.config_encrypted
        },
        actorUserId: actorUserId || "system",
        connector
    }));
    return {
        ok: result.status !== "failed",
        ...result,
        connectorKey: key
    };
});
exports.v2AssignmentSlaWatch = client_1.inngest.createFunction({ id: "v2_assignment_sla_watch" }, { event: "v2/assignment.created" }, async ({ event, step }) => {
    const { tenantId, assignmentId, opportunityId, slaDueAt } = event.data;
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const target = slaDueAt ? new Date(slaDueAt) : new Date(Date.now() + 30 * 60 * 1000);
    const msUntil = Math.max(0, target.getTime() - Date.now());
    const seconds = Math.ceil(msUntil / 1000);
    if (seconds > 0) {
        await step.sleep("wait-sla-window", `${seconds}s`);
    }
    const assignment = await step.run("load-assignment", async () => {
        const { data } = await supabase
            .from("v2_assignments")
            .select("id,status,tenant_id,assigned_tenant_id,backup_tenant_id,escalation_tenant_id")
            .eq("id", assignmentId)
            .maybeSingle();
        return data;
    });
    if (!assignment)
        return { ok: false, reason: "assignment_not_found" };
    if (assignment.status !== "pending_acceptance") {
        return { ok: true, skipped: true, reason: `assignment_status:${assignment.status}` };
    }
    const nextTenant = assignment.backup_tenant_id || assignment.escalation_tenant_id || assignment.assigned_tenant_id;
    const updated = await step.run("escalate-assignment", async () => {
        const { data } = await supabase
            .from("v2_assignments")
            .update({
            status: "escalated",
            assigned_tenant_id: nextTenant,
            escalated_at: new Date().toISOString()
        })
            .eq("id", assignmentId)
            .select("id,status,assigned_tenant_id,escalated_at")
            .single();
        return data;
    });
    await step.run("update-opportunity-routing-status", async () => {
        await supabase
            .from("v2_opportunities")
            .update({ routing_status: "escalated" })
            .eq("id", opportunityId)
            .eq("tenant_id", tenantId);
    });
    await step.run("log-audit", async () => {
        await (0, audit_1.logV2AuditEvent)({
            tenantId,
            actorType: "system",
            actorId: "inngest",
            entityType: "assignment",
            entityId: assignmentId,
            action: "sla_auto_escalated",
            before: { status: "pending_acceptance", assigned_tenant_id: assignment.assigned_tenant_id },
            after: { status: "escalated", assigned_tenant_id: nextTenant }
        });
    });
    return {
        ok: true,
        assignment: updated
    };
});
