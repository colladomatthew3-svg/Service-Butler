import { featureFlags } from "@/lib/config/feature-flags";
import type { V2AssignmentDecision } from "@/lib/v2/types";
import { logV2AuditEvent } from "@/lib/v2/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

function parsePostalCode(text?: string | null) {
  const match = String(text || "").match(/\b\d{5}\b/);
  return match?.[0] || null;
}

function toMinutes(value: unknown, fallback = 60) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(24 * 60, Math.round(n)));
}

function pickFirstStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((value) => String(value || "").trim()).filter(Boolean);
}

async function estimateCapacityPressure({
  supabase,
  assignedTenantId
}: {
  supabase: SupabaseClient;
  assignedTenantId: string;
}) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("v2_assignments")
    .select("id", { count: "exact", head: true })
    .eq("assigned_tenant_id", assignedTenantId)
    .gte("assigned_at", oneHourAgo);

  return Number(count || 0);
}

function selectEnterpriseOverrideRule(rules: Array<Record<string, unknown>>) {
  return rules.find((rule) => {
    const cfg = (rule.rule_json || {}) as Record<string, unknown>;
    return cfg.kind === "enterprise_override";
  }) || null;
}

function selectCatastropheOverrideRule({
  rules,
  catastropheLinkageScore
}: {
  rules: Array<Record<string, unknown>>;
  catastropheLinkageScore: number;
}) {
  return (
    rules.find((rule) => {
      const cfg = (rule.rule_json || {}) as Record<string, unknown>;
      if (cfg.kind !== "catastrophe_override") return false;
      const threshold = Number(cfg.threshold || 70);
      return catastropheLinkageScore >= threshold;
    }) || null
  );
}

async function findTerritory({
  supabase,
  tenantId,
  postalCode,
  serviceLine
}: {
  supabase: SupabaseClient;
  tenantId: string;
  postalCode: string | null;
  serviceLine: string;
}) {
  let query = supabase
    .from("v2_territories")
    .select("id,tenant_id,zip_codes,service_lines,capacity_json,hours_json")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .limit(20);

  if (postalCode) {
    query = query.contains("zip_codes", [postalCode]);
  }

  const { data } = await query;
  const rows = (data || []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;

  const matched = rows.find((row) => {
    const lines = pickFirstStringArray(row.service_lines);
    return lines.length === 0 || lines.includes(serviceLine) || lines.includes("general");
  });

  if (matched) return matched;

  // Polygon routing flag is ready for future SQL/RPC spatial matching. Zip routing remains primary baseline.
  if (featureFlags.usePolygonRouting) {
    return rows[0] || null;
  }

  return rows[0] || null;
}

async function findBackupTenant({
  supabase,
  enterpriseTenantId,
  currentAssignedTenantId
}: {
  supabase: SupabaseClient;
  enterpriseTenantId: string;
  currentAssignedTenantId: string;
}) {
  const { data } = await supabase
    .from("v2_tenants")
    .select("id")
    .eq("parent_tenant_id", enterpriseTenantId)
    .eq("type", "franchise")
    .neq("id", currentAssignedTenantId)
    .limit(1);

  return data?.[0]?.id ? String(data[0].id) : null;
}

async function computeDecision({
  supabase,
  tenantId,
  enterpriseTenantId,
  opportunity
}: {
  supabase: SupabaseClient;
  tenantId: string;
  enterpriseTenantId: string;
  opportunity: Record<string, unknown>;
}): Promise<V2AssignmentDecision> {
  const serviceLine = String(opportunity.service_line || opportunity.opportunity_type || "general");
  const catastrophe = Number(opportunity.catastrophe_linkage_score || 0);
  const postalCode = String(opportunity.postal_code || parsePostalCode(String(opportunity.location_text || "")) || "") || null;

  const { data: candidateRules } = await supabase
    .from("v2_routing_rules")
    .select("id,tenant_id,territory_id,service_line,priority,rule_json,active")
    .in("tenant_id", [tenantId, enterpriseTenantId])
    .eq("active", true)
    .order("priority", { ascending: true });

  const rules = (candidateRules || []) as Array<Record<string, unknown>>;

  const enterpriseOverride = selectEnterpriseOverrideRule(rules);
  if (enterpriseOverride) {
    const cfg = (enterpriseOverride.rule_json || {}) as Record<string, unknown>;
    return {
      assignedTenantId: String(cfg.assignee_tenant_id || tenantId),
      backupTenantId: cfg.backup_tenant_id ? String(cfg.backup_tenant_id) : null,
      escalationTenantId: cfg.escalation_tenant_id ? String(cfg.escalation_tenant_id) : enterpriseTenantId,
      reason: "enterprise_override",
      slaMinutes: toMinutes(cfg.sla_minutes, 30)
    };
  }

  const catastropheOverride = selectCatastropheOverrideRule({ rules, catastropheLinkageScore: catastrophe });
  if (catastropheOverride) {
    const cfg = (catastropheOverride.rule_json || {}) as Record<string, unknown>;
    return {
      assignedTenantId: String(cfg.assignee_tenant_id || tenantId),
      backupTenantId: cfg.backup_tenant_id ? String(cfg.backup_tenant_id) : null,
      escalationTenantId: cfg.escalation_tenant_id ? String(cfg.escalation_tenant_id) : enterpriseTenantId,
      reason: "catastrophe_override",
      slaMinutes: toMinutes(cfg.sla_minutes, 20)
    };
  }

  const territory = await findTerritory({
    supabase,
    tenantId,
    postalCode,
    serviceLine
  });

  if (territory) {
    const pressure = await estimateCapacityPressure({
      supabase,
      assignedTenantId: tenantId
    });

    const underPressure = pressure >= 20;
    const backupTenant = await findBackupTenant({
      supabase,
      enterpriseTenantId,
      currentAssignedTenantId: tenantId
    });

    if (underPressure && backupTenant) {
      return {
        assignedTenantId: backupTenant,
        backupTenantId: tenantId,
        escalationTenantId: enterpriseTenantId,
        reason: "capacity_override",
        slaMinutes: 20
      };
    }

    return {
      assignedTenantId: tenantId,
      backupTenantId: backupTenant,
      escalationTenantId: enterpriseTenantId,
      reason: "territory_match",
      slaMinutes: 45
    };
  }

  const fallbackBackup = await findBackupTenant({
    supabase,
    enterpriseTenantId,
    currentAssignedTenantId: tenantId
  });

  return {
    assignedTenantId: tenantId,
    backupTenantId: fallbackBackup,
    escalationTenantId: enterpriseTenantId,
    reason: "fallback",
    slaMinutes: 60
  };
}

export async function routeOpportunityV2({
  supabase,
  tenantId,
  enterpriseTenantId,
  opportunityId,
  actorUserId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  enterpriseTenantId: string;
  opportunityId: string;
  actorUserId: string;
}) {
  const { data: opportunity, error: oppError } = await supabase
    .from("v2_opportunities")
    .select("id,tenant_id,service_line,opportunity_type,postal_code,location_text,catastrophe_linkage_score,routing_status")
    .eq("id", opportunityId)
    .eq("tenant_id", tenantId)
    .single();

  if (oppError || !opportunity) throw new Error(oppError?.message || "Opportunity not found");

  const decision = await computeDecision({
    supabase,
    tenantId,
    enterpriseTenantId,
    opportunity
  });

  const slaDueAt = new Date(Date.now() + decision.slaMinutes * 60_000).toISOString();

  const { data: assignment, error: assignmentError } = await supabase
    .from("v2_assignments")
    .insert({
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      assigned_tenant_id: decision.assignedTenantId,
      backup_tenant_id: decision.backupTenantId,
      escalation_tenant_id: decision.escalationTenantId,
      assignment_reason: decision.reason,
      status: "pending_acceptance",
      assigned_at: new Date().toISOString(),
      sla_due_at: slaDueAt,
      metadata: {
        precedence_reason: decision.reason,
        use_polygon_routing: featureFlags.usePolygonRouting
      }
    })
    .select("id,status,sla_due_at,assigned_tenant_id,backup_tenant_id,escalation_tenant_id")
    .single();

  if (assignmentError || !assignment) throw new Error(assignmentError?.message || "Failed to create assignment");

  await supabase
    .from("v2_opportunities")
    .update({
      routing_status: decision.reason.includes("override") ? "escalated" : "routed",
      lifecycle_status: "assigned"
    })
    .eq("id", opportunityId);

  await logV2AuditEvent({
    tenantId,
    actorType: "user",
    actorId: actorUserId,
    entityType: "opportunity",
    entityId: opportunityId,
    action: "routed",
    before: null,
    after: {
      assignment_id: assignment.id,
      assigned_tenant_id: assignment.assigned_tenant_id,
      backup_tenant_id: assignment.backup_tenant_id,
      escalation_tenant_id: assignment.escalation_tenant_id,
      sla_due_at: assignment.sla_due_at,
      reason: decision.reason
    }
  });

  return {
    assignment,
    decision
  };
}

export async function transitionAssignmentV2({
  supabase,
  tenantId,
  assignmentId,
  action,
  actorUserId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  assignmentId: string;
  action: "accept" | "reject";
  actorUserId: string;
}) {
  const { data: assignment, error } = await supabase
    .from("v2_assignments")
    .select("id,tenant_id,opportunity_id,status,backup_tenant_id,escalation_tenant_id")
    .eq("id", assignmentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !assignment) throw new Error(error?.message || "Assignment not found");

  if (action === "accept") {
    const { data: updated, error: updateError } = await supabase
      .from("v2_assignments")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString()
      })
      .eq("id", assignmentId)
      .select("id,status,accepted_at")
      .single();

    if (updateError || !updated) throw new Error(updateError?.message || "Could not accept assignment");

    await supabase
      .from("v2_opportunities")
      .update({ routing_status: "routed" })
      .eq("id", assignment.opportunity_id);

    await logV2AuditEvent({
      tenantId,
      actorType: "user",
      actorId: actorUserId,
      entityType: "assignment",
      entityId: assignmentId,
      action: "assignment_accepted",
      before: { status: assignment.status },
      after: { status: "accepted" }
    });

    return updated;
  }

  const escalatedTenant = String(assignment.backup_tenant_id || assignment.escalation_tenant_id || tenantId);
  const { data: updated, error: updateError } = await supabase
    .from("v2_assignments")
    .update({
      status: "escalated",
      escalated_at: new Date().toISOString(),
      assigned_tenant_id: escalatedTenant
    })
    .eq("id", assignmentId)
    .select("id,status,escalated_at,assigned_tenant_id")
    .single();

  if (updateError || !updated) throw new Error(updateError?.message || "Could not escalate assignment");

  await supabase
    .from("v2_opportunities")
    .update({ routing_status: "escalated" })
    .eq("id", assignment.opportunity_id);

  await logV2AuditEvent({
    tenantId,
    actorType: "user",
    actorId: actorUserId,
    entityType: "assignment",
    entityId: assignmentId,
    action: "assignment_escalated",
    before: { status: assignment.status },
    after: { status: "escalated", assigned_tenant_id: escalatedTenant }
  });

  return updated;
}
