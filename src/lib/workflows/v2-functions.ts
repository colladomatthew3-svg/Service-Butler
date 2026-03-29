import { inngest } from "@/lib/workflows/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getConnectorByKey } from "@/lib/v2/connectors/registry";
import { runConnectorForSource } from "@/lib/v2/connectors/runner";
import { inferConnectorKey } from "@/lib/v2/connectors/source-type-map";
import { logV2AuditEvent } from "@/lib/v2/audit";

export const v2ConnectorRunRequested = inngest.createFunction(
  { id: "v2_connector_run_requested" },
  { event: "v2/connector.run.requested" },
  async ({ event, step }) => {
    const { tenantId, sourceId, connectorKey, actorUserId } = event.data as {
      tenantId: string;
      sourceId: string;
      connectorKey?: string;
      actorUserId?: string;
    };

    const supabase = getSupabaseAdminClient();

    const source = await step.run("load-source", async () => {
      const { data } = await supabase
        .from("v2_data_sources")
        .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags")
        .eq("tenant_id", tenantId)
        .eq("id", sourceId)
        .maybeSingle();
      return data;
    });

    if (!source) return { ok: false, reason: "source_not_found" };

    const key = String(connectorKey || "").trim() || inferConnectorKey(String(source.source_type || ""));

    const connector = getConnectorByKey(key);
    if (!connector) return { ok: false, reason: `connector_not_found:${key}` };

    const result = await step.run("run-connector", async () =>
      runConnectorForSource({
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
      })
    );

    return {
      ok: result.status !== "failed",
      ...result,
      connectorKey: key
    };
  }
);

export const v2AssignmentSlaWatch = inngest.createFunction(
  { id: "v2_assignment_sla_watch" },
  { event: "v2/assignment.created" },
  async ({ event, step }) => {
    const { tenantId, assignmentId, opportunityId, slaDueAt } = event.data as {
      tenantId: string;
      assignmentId: string;
      opportunityId: string;
      slaDueAt?: string;
    };

    const supabase = getSupabaseAdminClient();

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

    if (!assignment) return { ok: false, reason: "assignment_not_found" };
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
      await logV2AuditEvent({
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
  }
);
