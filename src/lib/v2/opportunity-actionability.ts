import { getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "@/lib/v2/opportunity-qualification";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAssignmentStatus(value: unknown) {
  const status = asText(value).toLowerCase();
  if (
    status === "pending_acceptance" ||
    status === "accepted" ||
    status === "escalated" ||
    status === "complete" ||
    status === "rejected"
  ) {
    return status;
  }
  return "";
}

function isTerminalLifecycle(value: unknown) {
  const lifecycle = asText(value).toLowerCase();
  return lifecycle === "booked_job" || lifecycle === "closed_lost";
}

function hasActiveAssignment(status: string) {
  return status === "pending_acceptance" || status === "accepted" || status === "escalated";
}

export type OpportunityActionabilityInput = {
  lifecycleStatus: unknown;
  routingStatus: unknown;
  contactStatus?: unknown;
  explainability: unknown;
  assignment?: Record<string, unknown> | null;
};

export type OpportunityActionability = {
  recommendedNextAction: string;
  recommendedActionReason: string | null;
  recommendedActionSlaMinutes: number | null;
  freshnessScore: number;
  confidenceScore: number;
  territoryRelevance: string | null;
  reviewRequired: boolean;
  assignmentId: string | null;
  assignmentStatus: string | null;
  assignedTenantId: string | null;
  assignmentSlaDueAt: string | null;
  assignmentReason: string | null;
  canRouteNow: boolean;
  canAcceptAssignment: boolean;
  canEscalateAssignment: boolean;
  canConvertToJob: boolean;
  dispatchReady: boolean;
};

export function deriveOpportunityActionability(input: OpportunityActionabilityInput): OpportunityActionability {
  const explainability = asRecord(input.explainability);
  const assignment = input.assignment || null;
  const assignmentStatus = normalizeAssignmentStatus(assignment?.status);
  const qualification = getOpportunityQualificationSnapshot({
    explainability,
    lifecycleStatus: input.lifecycleStatus,
    contactStatus: input.contactStatus
  });
  const dispatchReady = qualificationAllowsDispatch(qualification);
  const terminal = isTerminalLifecycle(input.lifecycleStatus);
  const reviewRequired = Boolean(explainability.review_required) || qualification.requiresSdrQualification || qualification.researchOnly;
  const activeAssignment = hasActiveAssignment(assignmentStatus);
  const routingStatus = asText(input.routingStatus).toLowerCase();
  const routeBlockedByStatus = routingStatus === "routed" || routingStatus === "escalated" || routingStatus === "complete";

  const canRouteNow = !terminal && !reviewRequired && !activeAssignment && !routeBlockedByStatus;
  const canAcceptAssignment = assignmentStatus === "pending_acceptance";
  const canEscalateAssignment = assignmentStatus === "pending_acceptance" || assignmentStatus === "accepted";
  const canConvertToJob = !terminal && !reviewRequired && dispatchReady;

  return {
    recommendedNextAction:
      asText(explainability.recommended_next_action) ||
      asText(explainability.next_recommended_action) ||
      qualification.nextRecommendedAction ||
      "review_signal",
    recommendedActionReason: asText(explainability.recommended_action_reason) || null,
    recommendedActionSlaMinutes: Number.isFinite(Number(explainability.recommended_action_sla_minutes))
      ? Math.max(0, Math.round(Number(explainability.recommended_action_sla_minutes)))
      : null,
    freshnessScore: toNumber(explainability.freshness_score, 0),
    confidenceScore: toNumber(explainability.confidence_score, 0),
    territoryRelevance: asText(explainability.territory_relevance) || null,
    reviewRequired,
    assignmentId: assignment?.id ? asText(assignment.id) : null,
    assignmentStatus: assignmentStatus || null,
    assignedTenantId: assignment?.assigned_tenant_id ? asText(assignment.assigned_tenant_id) : null,
    assignmentSlaDueAt: assignment?.sla_due_at ? asText(assignment.sla_due_at) : null,
    assignmentReason: assignment?.assignment_reason ? asText(assignment.assignment_reason) : null,
    canRouteNow,
    canAcceptAssignment,
    canEscalateAssignment,
    canConvertToJob,
    dispatchReady
  };
}
