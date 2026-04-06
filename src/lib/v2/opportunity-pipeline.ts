type OpportunityPipelineStage =
  | "raw"
  | "normalized"
  | "enriched"
  | "deduped"
  | "classified"
  | "scored"
  | "routed"
  | "queued_for_review"
  | "approved"
  | "rejected"
  | "contacted"
  | "converted_to_job"
  | "archived"
  | "failed";

export const canonicalOpportunityPipelineStages: OpportunityPipelineStage[] = [
  "raw",
  "normalized",
  "enriched",
  "deduped",
  "classified",
  "scored",
  "routed",
  "queued_for_review",
  "approved",
  "rejected",
  "contacted",
  "converted_to_job",
  "archived",
  "failed"
];

export type DeriveOpportunityPipelineStageInput = {
  lifecycleStatus?: unknown;
  routingStatus?: unknown;
  contactStatus?: unknown;
  sourceEventId?: unknown;
  opportunityType?: unknown;
  serviceLine?: unknown;
  urgencyScore?: unknown;
  jobLikelihoodScore?: unknown;
  sourceReliabilityScore?: unknown;
  explainability?: unknown;
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasFiniteNumber(value: unknown) {
  return Number.isFinite(Number(value));
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = asText(value).toLowerCase();
  if (!normalized) return false;
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function deriveOpportunityPipelineStage(input: DeriveOpportunityPipelineStageInput): OpportunityPipelineStage {
  const lifecycle = asText(input.lifecycleStatus).toLowerCase();
  const routing = asText(input.routingStatus).toLowerCase();
  const contact = asText(input.contactStatus).toLowerCase();
  const explainability = asRecord(input.explainability);

  const reviewDecision = asText(
    explainability.review_decision || explainability.review_status || explainability.approval_status || explainability.approval_state
  ).toLowerCase();
  const qualificationStatus = asText(explainability.qualification_status).toLowerCase();
  const nextAction = asText(explainability.next_recommended_action).toLowerCase();
  const verificationStatus = asText(explainability.verification_status).toLowerCase();
  const outreachStatus = asText(explainability.outreach_status).toLowerCase();
  const conversionStatus = asText(explainability.conversion_status).toLowerCase();

  if (lifecycle === "failed" || reviewDecision === "failed" || conversionStatus === "failed") return "failed";
  if (lifecycle === "booked_job" || conversionStatus === "converted_to_job") return "converted_to_job";
  if (lifecycle === "closed_lost" || reviewDecision === "archived" || asText(explainability.archived_reason)) return "archived";

  if (
    reviewDecision === "rejected" ||
    qualificationStatus === "rejected" ||
    verificationStatus === "rejected" ||
    contact === "do_not_contact" ||
    nextAction === "do_not_pursue"
  ) {
    return "rejected";
  }

  if (
    outreachStatus === "sent" ||
    outreachStatus === "delivered" ||
    outreachStatus === "replied" ||
    lifecycle === "contacted" ||
    contact === "contacted"
  ) {
    return "contacted";
  }

  if (reviewDecision === "approved" || qualificationStatus === "qualified_contactable" || lifecycle === "qualified") return "approved";

  if (
    nextAction === "await_sdr_review" ||
    qualificationStatus === "queued_for_sdr" ||
    qualificationStatus === "research_only" ||
    verificationStatus === "review" ||
    asBoolean(explainability.requires_sdr_qualification) ||
    asBoolean(explainability.requires_manual_review)
  ) {
    return "queued_for_review";
  }

  if (lifecycle === "assigned" || routing === "routed" || routing === "escalated" || routing === "complete") return "routed";

  if (
    hasFiniteNumber(input.urgencyScore) ||
    hasFiniteNumber(input.jobLikelihoodScore) ||
    hasFiniteNumber(input.sourceReliabilityScore) ||
    hasFiniteNumber(explainability.confidence_score)
  ) {
    return "scored";
  }

  if (asText(input.opportunityType) || asText(input.serviceLine) || asText(explainability.likely_job_type)) return "classified";

  if (asText(explainability.dedupe_key) || asText(explainability.duplicate_of_opportunity_id) || hasFiniteNumber(explainability.signal_count)) {
    return "deduped";
  }

  if (
    asText(explainability.distress_context_summary) ||
    asText(explainability.estimated_response_window) ||
    asText(explainability.property_context) ||
    asText(explainability.enrichment_provider)
  ) {
    return "enriched";
  }

  if (
    asText(input.sourceEventId) ||
    asText(explainability.source_type) ||
    asText(explainability.source_name) ||
    asText(explainability.source_provenance) ||
    asText(explainability.event_category)
  ) {
    return "normalized";
  }

  return "raw";
}
