"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routingInternals = void 0;
exports.findTerritoryForOpportunity = findTerritoryForOpportunity;
exports.routeOpportunityV2 = routeOpportunityV2;
exports.transitionAssignmentV2 = transitionAssignmentV2;
const feature_flags_1 = require("@/lib/config/feature-flags");
const audit_1 = require("@/lib/v2/audit");
function parsePostalCode(text) {
    const match = String(text || "").match(/\b\d{5}\b/);
    return match?.[0] || null;
}
function toMinutes(value, fallback = 60) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(5, Math.min(24 * 60, Math.round(n)));
}
function pickFirstStringArray(input) {
    if (!Array.isArray(input))
        return [];
    return input.map((value) => String(value || "").trim()).filter(Boolean);
}
function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function asRecord(value) {
    if (value && typeof value === "object" && !Array.isArray(value))
        return value;
    return {};
}
function parsePointText(pointText) {
    const match = pointText.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (!match)
        return null;
    const lng = toFiniteNumber(match[1]);
    const lat = toFiniteNumber(match[2]);
    if (lat == null || lng == null)
        return null;
    return { lat, lng };
}
function parseLatLng(location) {
    if (!location)
        return null;
    if (typeof location === "string") {
        return parsePointText(location) || parsePointText(location.replace(/^SRID=\d+;/i, ""));
    }
    if (typeof location === "object") {
        const shape = location;
        const coordinates = shape.coordinates;
        if (Array.isArray(coordinates) && coordinates.length >= 2) {
            const lng = toFiniteNumber(coordinates[0]);
            const lat = toFiniteNumber(coordinates[1]);
            if (lat != null && lng != null)
                return { lat, lng };
        }
    }
    return null;
}
async function findTerritoryByPolygon({ supabase, tenantId, serviceLine, latitude, longitude }) {
    const { data, error } = await supabase.rpc("match_territory_by_point", {
        p_tenant_id: tenantId,
        p_lat: latitude,
        p_lng: longitude,
        p_service_line: serviceLine
    });
    if (error)
        throw new Error(error.message || "Polygon territory lookup failed");
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first?.territory_id)
        return null;
    const { data: territory, error: territoryError } = await supabase
        .from("v2_territories")
        .select("id,tenant_id,zip_codes,service_lines,capacity_json,hours_json")
        .eq("id", String(first.territory_id))
        .eq("active", true)
        .maybeSingle();
    if (territoryError)
        throw new Error(territoryError.message || "Failed to resolve matched territory");
    return territory || null;
}
async function estimateCapacityPressure({ supabase, assignedTenantId }) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
        .from("v2_assignments")
        .select("id", { count: "exact", head: true })
        .eq("assigned_tenant_id", assignedTenantId)
        .gte("assigned_at", oneHourAgo);
    return Number(count || 0);
}
function selectEnterpriseOverrideRule(rules) {
    return rules.find((rule) => {
        const cfg = (rule.rule_json || {});
        return cfg.kind === "enterprise_override";
    }) || null;
}
function selectCatastropheOverrideRule({ rules, catastropheLinkageScore, urgencyScore, hasClusterMembership }) {
    return (rules.find((rule) => {
        const cfg = (rule.rule_json || {});
        if (cfg.kind !== "catastrophe_override")
            return false;
        const threshold = Number(cfg.threshold || 70);
        const urgentThreshold = Number(cfg.urgent_threshold || Math.max(45, threshold - 15));
        return catastropheLinkageScore >= threshold || (hasClusterMembership && urgencyScore >= urgentThreshold);
    }) || null);
}
function computeSlaMinutes({ urgencyScore, catastropheLinkageScore, hasClusterMembership, estimatedResponseWindow }) {
    const responseWindow = estimatedResponseWindow.trim().toLowerCase();
    if (responseWindow === "0-4h" || urgencyScore >= 90)
        return 15;
    if (hasClusterMembership && catastropheLinkageScore >= 65)
        return 20;
    if (responseWindow === "4-24h" || urgencyScore >= 72 || catastropheLinkageScore >= 75)
        return 30;
    return 45;
}
function resolveRoutingInputs(opportunity) {
    const explainability = asRecord(opportunity.explainability_json);
    return {
        serviceLine: String(opportunity.service_line ||
            explainability.primary_service_line ||
            opportunity.opportunity_type ||
            "general"),
        urgencyScore: Number(opportunity.urgency_score || explainability.urgency_score || 0),
        catastropheLinkageScore: Number(opportunity.catastrophe_linkage_score || 0),
        hasClusterMembership: Boolean(opportunity.incident_cluster_id),
        estimatedResponseWindow: String(explainability.estimated_response_window || "24-72h"),
        postalCode: String(opportunity.postal_code || parsePostalCode(String(opportunity.location_text || "")) || "") || null,
        latLng: parseLatLng(opportunity.location)
    };
}
exports.routingInternals = {
    parseLatLng,
    computeSlaMinutes,
    resolveRoutingInputs
};
async function findTerritoryForOpportunity({ supabase, tenantId, postalCode, serviceLine, latitude, longitude }) {
    if (feature_flags_1.featureFlags.usePolygonRouting && latitude != null && longitude != null) {
        const polygonTerritory = await findTerritoryByPolygon({
            supabase,
            tenantId,
            serviceLine,
            latitude,
            longitude
        });
        if (polygonTerritory)
            return polygonTerritory;
    }
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
    const rows = (data || []);
    if (rows.length === 0)
        return null;
    const matched = rows.find((row) => {
        const lines = pickFirstStringArray(row.service_lines);
        return lines.length === 0 || lines.includes(serviceLine) || lines.includes("general");
    });
    if (matched)
        return matched;
    return rows[0] || null;
}
async function findBackupTenant({ supabase, enterpriseTenantId, currentAssignedTenantId }) {
    const { data } = await supabase
        .from("v2_tenants")
        .select("id")
        .eq("parent_tenant_id", enterpriseTenantId)
        .eq("type", "franchise")
        .neq("id", currentAssignedTenantId)
        .limit(1);
    return data?.[0]?.id ? String(data[0].id) : null;
}
async function computeDecision({ supabase, tenantId, enterpriseTenantId, opportunity }) {
    const input = resolveRoutingInputs(opportunity);
    const serviceLine = input.serviceLine;
    const urgencyScore = input.urgencyScore;
    const catastrophe = input.catastropheLinkageScore;
    const hasClusterMembership = input.hasClusterMembership;
    const estimatedResponseWindow = input.estimatedResponseWindow;
    const postalCode = input.postalCode;
    const latLng = input.latLng;
    const baselineSlaMinutes = computeSlaMinutes({
        urgencyScore,
        catastropheLinkageScore: catastrophe,
        hasClusterMembership,
        estimatedResponseWindow
    });
    const { data: candidateRules } = await supabase
        .from("v2_routing_rules")
        .select("id,tenant_id,territory_id,service_line,priority,rule_json,active")
        .in("tenant_id", [tenantId, enterpriseTenantId])
        .eq("active", true)
        .order("priority", { ascending: true });
    const rules = (candidateRules || []);
    const enterpriseOverride = selectEnterpriseOverrideRule(rules);
    if (enterpriseOverride) {
        const cfg = (enterpriseOverride.rule_json || {});
        return {
            assignedTenantId: String(cfg.assignee_tenant_id || tenantId),
            backupTenantId: cfg.backup_tenant_id ? String(cfg.backup_tenant_id) : null,
            escalationTenantId: cfg.escalation_tenant_id ? String(cfg.escalation_tenant_id) : enterpriseTenantId,
            reason: "enterprise_override",
            slaMinutes: Math.min(toMinutes(cfg.sla_minutes, 30), baselineSlaMinutes)
        };
    }
    const catastropheOverride = selectCatastropheOverrideRule({
        rules,
        catastropheLinkageScore: catastrophe,
        urgencyScore,
        hasClusterMembership
    });
    if (catastropheOverride) {
        const cfg = (catastropheOverride.rule_json || {});
        return {
            assignedTenantId: String(cfg.assignee_tenant_id || tenantId),
            backupTenantId: cfg.backup_tenant_id ? String(cfg.backup_tenant_id) : null,
            escalationTenantId: cfg.escalation_tenant_id ? String(cfg.escalation_tenant_id) : enterpriseTenantId,
            reason: "catastrophe_override",
            slaMinutes: Math.min(toMinutes(cfg.sla_minutes, 20), baselineSlaMinutes)
        };
    }
    const territory = await findTerritoryForOpportunity({
        supabase,
        tenantId,
        postalCode,
        serviceLine,
        latitude: latLng?.lat || null,
        longitude: latLng?.lng || null
    });
    if (territory) {
        const pressure = await estimateCapacityPressure({
            supabase,
            assignedTenantId: tenantId
        });
        const pressureLimit = urgencyScore >= 80 || hasClusterMembership ? 10 : 20;
        const underPressure = pressure >= pressureLimit;
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
                slaMinutes: Math.min(20, baselineSlaMinutes)
            };
        }
        return {
            assignedTenantId: tenantId,
            backupTenantId: backupTenant,
            escalationTenantId: enterpriseTenantId,
            reason: "territory_match",
            slaMinutes: baselineSlaMinutes
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
        slaMinutes: Math.max(baselineSlaMinutes, 60)
    };
}
async function routeOpportunityV2({ supabase, tenantId, enterpriseTenantId, opportunityId, actorUserId }) {
    const { data: opportunity, error: oppError } = await supabase
        .from("v2_opportunities")
        .select("id,tenant_id,service_line,opportunity_type,postal_code,location_text,location,catastrophe_linkage_score,urgency_score,incident_cluster_id,explainability_json,routing_status")
        .eq("id", opportunityId)
        .eq("tenant_id", tenantId)
        .single();
    if (oppError || !opportunity)
        throw new Error(oppError?.message || "Opportunity not found");
    const decision = await computeDecision({
        supabase,
        tenantId,
        enterpriseTenantId,
        opportunity
    });
    const slaDueAt = new Date(Date.now() + decision.slaMinutes * 60_000).toISOString();
    const explainability = asRecord(opportunity.explainability_json);
    const primaryServiceLine = String(opportunity.service_line || explainability.primary_service_line || opportunity.opportunity_type || "general");
    const estimatedResponseWindow = String(explainability.estimated_response_window || "24-72h");
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
            use_polygon_routing: feature_flags_1.featureFlags.usePolygonRouting,
            primary_service_line: primaryServiceLine,
            urgency_score: Number(opportunity.urgency_score || 0),
            catastrophe_linkage_score: Number(opportunity.catastrophe_linkage_score || 0),
            cluster_member: Boolean(opportunity.incident_cluster_id),
            estimated_response_window: estimatedResponseWindow
        }
    })
        .select("id,status,sla_due_at,assigned_tenant_id,backup_tenant_id,escalation_tenant_id")
        .single();
    if (assignmentError || !assignment)
        throw new Error(assignmentError?.message || "Failed to create assignment");
    await supabase
        .from("v2_opportunities")
        .update({
        routing_status: decision.reason.includes("override") ? "escalated" : "routed",
        lifecycle_status: "assigned"
    })
        .eq("id", opportunityId);
    await (0, audit_1.logV2AuditEvent)({
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
async function transitionAssignmentV2({ supabase, tenantId, assignmentId, action, actorUserId }) {
    const { data: assignment, error } = await supabase
        .from("v2_assignments")
        .select("id,tenant_id,opportunity_id,status,backup_tenant_id,escalation_tenant_id")
        .eq("id", assignmentId)
        .eq("tenant_id", tenantId)
        .single();
    if (error || !assignment)
        throw new Error(error?.message || "Assignment not found");
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
        if (updateError || !updated)
            throw new Error(updateError?.message || "Could not accept assignment");
        await supabase
            .from("v2_opportunities")
            .update({ routing_status: "routed" })
            .eq("id", assignment.opportunity_id);
        await (0, audit_1.logV2AuditEvent)({
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
    if (updateError || !updated)
        throw new Error(updateError?.message || "Could not escalate assignment");
    await supabase
        .from("v2_opportunities")
        .update({ routing_status: "escalated" })
        .eq("id", assignment.opportunity_id);
    await (0, audit_1.logV2AuditEvent)({
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
