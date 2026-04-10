import { deriveOpportunityActionability } from "@/lib/v2/opportunity-actionability";
import { getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "@/lib/v2/opportunity-qualification";
import { classifyProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { qualifiesAsRealSourceCapture } from "@/lib/v2/source-truth";

export const DISPATCHABLE_LEAD_RECENCY_HOURS = 72;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isActiveAssignment(status: string | null) {
  return status === "pending_acceptance" || status === "accepted" || status === "escalated";
}

function sourceTypeForEvent(sourceEvent: Record<string, unknown>, source?: Record<string, unknown> | null) {
  const normalized = asRecord(sourceEvent.normalized_payload);
  return asText(sourceEvent.source_type || normalized.source_type || normalized.connector_key || source?.source_type || sourceEvent.event_type);
}

function sourceNameForEvent(sourceEvent: Record<string, unknown>, source?: Record<string, unknown> | null) {
  const normalized = asRecord(sourceEvent.normalized_payload);
  return asText(sourceEvent.source_name || normalized.source_name || normalized.provider || source?.name || sourceTypeForEvent(sourceEvent, source));
}

function sourceProvenanceForEvent(sourceEvent: Record<string, unknown>, source?: Record<string, unknown> | null) {
  const normalized = asRecord(sourceEvent.normalized_payload);
  return asText(sourceEvent.source_provenance || normalized.source_provenance || normalized.provider || normalized.source_url || source?.provenance);
}

function deriveFreshnessTimestamp(opportunity: Record<string, unknown>, sourceEvent: Record<string, unknown>, explainability: Record<string, unknown>) {
  return (
    asText(explainability.freshness_timestamp) ||
    asText(sourceEvent.occurred_at) ||
    asText(sourceEvent.ingested_at) ||
    asText(explainability.occurred_at) ||
    asText(explainability.event_timestamp) ||
    asText(opportunity.created_at) ||
    null
  );
}

function deriveDisplayName(opportunity: Record<string, unknown>, qualification: ReturnType<typeof getOpportunityQualificationSnapshot>) {
  return (
    qualification.contactName ||
    asText(opportunity.title) ||
    asText(opportunity.description) ||
    "Unnamed lead"
  );
}

function deriveLocation(opportunity: Record<string, unknown>, explainability: Record<string, unknown>) {
  const explicit = asText(opportunity.location_text);
  if (explicit) return explicit;
  return [explainability.property_city, explainability.property_state, explainability.property_postal_code].map(asText).filter(Boolean).join(", ") || null;
}

function deriveServiceSignal(opportunity: Record<string, unknown>, explainability: Record<string, unknown>, sourceEvent: Record<string, unknown>) {
  return (
    asText(opportunity.service_line || opportunity.opportunity_type) ||
    asText(explainability.service_line || explainability.opportunity_type || explainability.source_type) ||
    sourceTypeForEvent(sourceEvent)
  );
}

function deriveDispatchBlockedReason(input: {
  countsAsRealCapture: boolean;
  recentEnough: boolean;
  hasDispatchContact: boolean;
  contactAttachmentStatus: string | null;
  qualificationReasonCode: string | null;
  hasLocation: boolean;
  hasServiceSignal: boolean;
  reviewRequired: boolean;
  terminal: boolean;
  activeAssignment: boolean;
}) {
  if (!input.countsAsRealCapture) return "Blocked: source is not live-safe or record is synthetic/test.";
  if (!input.recentEnough) return "Blocked: signal is older than the dispatch window.";
  if (input.contactAttachmentStatus === "identity_only" || input.qualificationReasonCode === "source_contact_identity_only") {
    return "Blocked: permit source identifies the owner or applicant, but no verified phone or email is available.";
  }
  if (input.contactAttachmentStatus === "insufficient_grounding" || input.qualificationReasonCode === "source_contact_unverified") {
    return "Blocked: contact data exists, but provenance is not strong enough to treat it as verified.";
  }
  if (!input.hasDispatchContact) return "Blocked: no verified phone or email is available.";
  if (!input.hasLocation) return "Blocked: location context is missing.";
  if (!input.hasServiceSignal) return "Blocked: service signal is missing.";
  if (input.reviewRequired) return "Blocked: SDR or operator review is still required.";
  if (input.activeAssignment) return "Blocked: lead is already in an active dispatch assignment.";
  if (input.terminal) return "Blocked: opportunity is already closed or converted.";
  return null;
}

export type DispatchableLeadCandidate = {
  id: string;
  title: string | null;
  business_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  source_type: string | null;
  service_signal: string | null;
  timestamp: string | null;
  age_hours: number | null;
  confidence_score: number;
  trust_status: string;
  qualification_status: string | null;
  verification_status: string | null;
  contact_provenance: string | null;
  contact_attachment_status: string | null;
  contact_grounded_reason: string | null;
  dispatch_eligible: boolean;
  blocked_reason: string | null;
  counts_as_real_capture: boolean;
  review_required: boolean;
  assignment_status: string | null;
};

export function deriveDispatchableLeadCandidate(input: {
  opportunity: Record<string, unknown>;
  sourceEvent?: Record<string, unknown> | null;
  source?: Record<string, unknown> | null;
  connectorRun?: Record<string, unknown> | null;
  assignment?: Record<string, unknown> | null;
  nowMs?: number;
}) : DispatchableLeadCandidate {
  const opportunity = input.opportunity;
  const sourceEvent = input.sourceEvent || {};
  const source = input.source || {};
  const connectorRun = input.connectorRun || {};
  const explainability = asRecord(opportunity.explainability_json);
  const proofAuthenticity = classifyProofAuthenticity({
    sourceType: sourceTypeForEvent(sourceEvent, source),
    sourceName: sourceNameForEvent(sourceEvent, source),
    sourceProvenance: sourceProvenanceForEvent(sourceEvent, source),
    normalizedPayload: asRecord(sourceEvent.normalized_payload),
    connectorRunMetadata: asRecord(connectorRun.metadata)
  });
  const qualification = getOpportunityQualificationSnapshot({
    explainability,
    proofAuthenticity,
    lifecycleStatus: opportunity.lifecycle_status,
    contactStatus: opportunity.contact_status
  });
  const actionability = deriveOpportunityActionability({
    lifecycleStatus: opportunity.lifecycle_status,
    routingStatus: opportunity.routing_status,
    contactStatus: opportunity.contact_status,
    explainability,
    assignment: input.assignment || null
  });
  const nowMs = input.nowMs ?? Date.now();
  const countsAsRealCapture = qualifiesAsRealSourceCapture({
    authenticity: proofAuthenticity,
    explainability,
    source,
    sourceEvent,
    connectorRun,
    nowMs
  });
  const timestamp = deriveFreshnessTimestamp(opportunity, sourceEvent, explainability);
  const tsMs = timestamp ? new Date(timestamp).getTime() : NaN;
  const ageHours = Number.isFinite(tsMs) ? Math.max(0, Math.round((nowMs - tsMs) / 3600000)) : null;
  const recentEnough = ageHours != null && ageHours <= DISPATCHABLE_LEAD_RECENCY_HOURS;
  const hasDispatchContact = qualificationAllowsDispatch(qualification);
  const contactAttachmentStatus = asText(explainability.contact_attachment_status) || null;
  const location = deriveLocation(opportunity, explainability);
  const serviceSignal = deriveServiceSignal(opportunity, explainability, sourceEvent);
  const terminal = ["booked_job", "closed_lost"].includes(asText(opportunity.lifecycle_status).toLowerCase());
  const activeAssignment = isActiveAssignment(actionability.assignmentStatus);
  const blockedReason = deriveDispatchBlockedReason({
    countsAsRealCapture,
    recentEnough,
    hasDispatchContact,
    contactAttachmentStatus,
    qualificationReasonCode: qualification.qualificationReasonCode,
    hasLocation: Boolean(location),
    hasServiceSignal: Boolean(serviceSignal),
    reviewRequired: actionability.reviewRequired,
    terminal,
    activeAssignment
  });
  const dispatchEligible = blockedReason == null;

  return {
    id: asText(opportunity.id),
    title: asText(opportunity.title) || null,
    business_name: deriveDisplayName(opportunity, qualification),
    phone: qualification.phone,
    email: qualification.email,
    location,
    source: sourceNameForEvent(sourceEvent, source) || null,
    source_type: sourceTypeForEvent(sourceEvent, source) || null,
    service_signal: serviceSignal || null,
    timestamp,
    age_hours: ageHours,
    confidence_score: toNumber(opportunity.source_reliability_score ?? explainability.confidence_score, 0),
    trust_status: dispatchEligible ? "Dispatchable live lead" : blockedReason ? blockedReason.replace(/^Blocked:\s*/, "") : "Needs review",
    qualification_status: qualification.qualificationStatus,
    verification_status: qualification.verificationStatus,
    contact_provenance: asText(explainability.contact_attachment_provenance || qualification.qualificationSource) || null,
    contact_attachment_status: contactAttachmentStatus,
    contact_grounded_reason: asText(explainability.contact_grounded_reason) || null,
    dispatch_eligible: dispatchEligible,
    blocked_reason: blockedReason,
    counts_as_real_capture: countsAsRealCapture,
    review_required: actionability.reviewRequired,
    assignment_status: actionability.assignmentStatus
  };
}
