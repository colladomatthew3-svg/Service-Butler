import type { ProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { normalizeEmail, normalizePhone } from "@/lib/v2/lead-verification";

export type OpportunityQualificationStatus = "research_only" | "queued_for_sdr" | "qualified_contactable" | "rejected";

export type OpportunityQualificationSnapshot = {
  qualificationStatus: OpportunityQualificationStatus;
  qualificationReasonCode: string | null;
  nextRecommendedAction: string;
  researchOnly: boolean;
  requiresSdrQualification: boolean;
  proofAuthenticity: ProofAuthenticity;
  sourceType: string | null;
  scannerEventId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  verificationStatus: string | null;
  qualificationSource: string | null;
  qualificationNotes: string | null;
  qualifiedAt: string | null;
  qualifiedBy: string | null;
};

export type OpportunityQualificationMutation = {
  qualification_status: OpportunityQualificationStatus;
  qualification_reason_code?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  verification_status?: string | null;
  qualification_source?: string | null;
  qualification_notes?: string | null;
};

export type OpportunityQualificationContactEvidence = {
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  verificationStatus?: string | null;
  qualificationSource?: string | null;
  qualificationNotes?: string | null;
  qualifiedAt?: string | null;
  qualifiedBy?: string | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeProofAuthenticity(value: unknown): ProofAuthenticity | null {
  const normalized = asText(value).toLowerCase();
  if (normalized === "live_provider" || normalized === "live_derived" || normalized === "synthetic" || normalized === "unknown") {
    return normalized;
  }
  return null;
}

export function normalizeQualificationStatus(value: unknown): OpportunityQualificationStatus | null {
  const normalized = asText(value).toLowerCase();
  if (
    normalized === "research_only" ||
    normalized === "queued_for_sdr" ||
    normalized === "qualified_contactable" ||
    normalized === "rejected"
  ) {
    return normalized;
  }
  return null;
}

export function getOpportunityQualificationSnapshot(input: {
  explainability: unknown;
  proofAuthenticity?: ProofAuthenticity;
  lifecycleStatus?: unknown;
  contactStatus?: unknown;
}): OpportunityQualificationSnapshot {
  const explainability = asRecord(input.explainability);
  const qualificationContact = asRecord(explainability.qualification_contact);
  const lifecycleStatus = asText(input.lifecycleStatus).toLowerCase();
  const contactStatus = asText(input.contactStatus).toLowerCase();
  let qualificationStatus = normalizeQualificationStatus(explainability.qualification_status);
  if (!qualificationStatus) {
    if (explainability.research_only === true || explainability.requires_sdr_qualification === true) {
      qualificationStatus = "research_only";
    } else if (
      (lifecycleStatus === "qualified" || lifecycleStatus === "assigned" || lifecycleStatus === "booked_job") &&
      contactStatus === "identified"
    ) {
      qualificationStatus = "qualified_contactable";
    } else {
      qualificationStatus = "research_only";
    }
  }
  const qualificationReasonCode = asText(explainability.qualification_reason_code) || null;
  const nextRecommendedAction =
    asText(explainability.next_recommended_action) ||
    (qualificationStatus === "qualified_contactable"
      ? "dispatch_to_lead_queue"
      : qualificationStatus === "queued_for_sdr"
        ? "await_sdr_review"
        : qualificationStatus === "rejected"
          ? "hold"
        : "route_to_sdr");
  const proofAuthenticity = input.proofAuthenticity || normalizeProofAuthenticity(explainability.proof_authenticity) || "unknown";
  const requiresSdrQualification = qualificationStatus !== "qualified_contactable";
  const researchOnly = qualificationStatus === "research_only" || qualificationStatus === "queued_for_sdr";
  const phone = normalizePhone(qualificationContact.phone ?? explainability.phone);
  const email = normalizeEmail(qualificationContact.email ?? explainability.email);

  return {
    qualificationStatus,
    qualificationReasonCode,
    nextRecommendedAction,
    researchOnly,
    requiresSdrQualification,
    proofAuthenticity,
    sourceType: asText(explainability.source_type) || null,
    scannerEventId: asText(explainability.scanner_event_id) || asText(explainability.scanner_opportunity_id) || null,
    contactName: asText(qualificationContact.contact_name ?? explainability.contact_name) || null,
    phone,
    email,
    verificationStatus: asText(qualificationContact.verification_status ?? explainability.verification_status) || null,
    qualificationSource: asText(explainability.qualification_source) || null,
    qualificationNotes: asText(explainability.qualification_notes) || null,
    qualifiedAt: asText(explainability.qualified_at ?? explainability.sdr_verified_at) || null,
    qualifiedBy: asText(explainability.qualified_by) || null
  };
}

export function isBuyerProofEligibleQualification(snapshot: OpportunityQualificationSnapshot) {
  return (
    !snapshot.researchOnly &&
    snapshot.qualificationStatus === "qualified_contactable" &&
    snapshot.proofAuthenticity !== "synthetic" &&
    snapshot.proofAuthenticity !== "unknown"
  );
}

export function qualificationAllowsDispatch(snapshot: OpportunityQualificationSnapshot) {
  return snapshot.qualificationStatus === "qualified_contactable" && snapshot.verificationStatus === "verified" && Boolean(snapshot.phone || snapshot.email);
}

export function mergeOpportunityQualification(
  explainability: unknown,
  input: {
    qualificationStatus: OpportunityQualificationStatus;
    qualificationReasonCode: string;
    nextRecommendedAction: string;
    proofAuthenticity?: ProofAuthenticity;
    sourceType?: string | null;
    scannerEventId?: string | null;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    verificationStatus?: string | null;
    qualificationSource?: string | null;
    qualificationNotes?: string | null;
    qualifiedAt?: string | null;
    qualifiedBy?: string | null;
  }
) {
  const current = asRecord(explainability);
  const existingContact = asRecord(current.qualification_contact);

  return {
    ...current,
    qualification_status: input.qualificationStatus,
    qualification_reason_code: input.qualificationReasonCode,
    next_recommended_action: input.nextRecommendedAction,
    research_only: input.qualificationStatus !== "qualified_contactable",
    requires_sdr_qualification: input.qualificationStatus !== "qualified_contactable",
    proof_authenticity: input.proofAuthenticity ?? current.proof_authenticity ?? "unknown",
    source_type: input.sourceType ?? (asText(current.source_type) || null),
    scanner_event_id: input.scannerEventId ?? (asText(current.scanner_event_id) || null),
    qualification_source: input.qualificationSource ?? (asText(current.qualification_source) || null),
    qualification_notes: input.qualificationNotes ?? (asText(current.qualification_notes) || null),
    qualified_at: input.qualifiedAt ?? (asText(current.qualified_at) || null),
    qualified_by: input.qualifiedBy ?? (asText(current.qualified_by) || null),
    qualification_contact: {
      ...existingContact,
      contact_name: input.contactName ?? (asText(existingContact.contact_name) || null),
      phone: normalizePhone(input.phone) ?? normalizePhone(existingContact.phone),
      email: normalizeEmail(input.email) ?? normalizeEmail(existingContact.email),
      verification_status: input.verificationStatus ?? (asText(existingContact.verification_status) || null)
    }
  };
}

export function validateQualificationMutation(payload: OpportunityQualificationMutation) {
  const status = normalizeQualificationStatus(payload.qualification_status) || "research_only";
  const source = asText(payload.qualification_source);
  const notes = asText(payload.qualification_notes);
  const contactName = asText(payload.contact_name);
  const phone = asText(payload.phone);
  const email = asText(payload.email);
  const verificationStatus = asText(payload.verification_status);

  if (!source) return "qualification_source is required";
  if (!notes) return "qualification_notes is required";

  if (status === "qualified_contactable") {
    if (!contactName) return "contact_name is required when qualification_status is qualified_contactable";
    if (!phone && !email) return "phone or email is required when qualification_status is qualified_contactable";
    if (!verificationStatus) return "verification_status is required when qualification_status is qualified_contactable";
  }

  return null;
}

export function buildQualificationUpdate({
  explainability,
  mutation,
  actorUserId
}: {
  explainability: unknown;
  mutation: OpportunityQualificationMutation;
  actorUserId: string;
}) {
  const current = asRecord(explainability);
  const qualificationStatus = normalizeQualificationStatus(mutation.qualification_status) || "research_only";
  const qualifiedAt = new Date().toISOString();
  const verificationStatus = asText(mutation.verification_status).toLowerCase() || null;

  return {
    lifecycleStatus: qualificationStatus === "qualified_contactable" ? "qualified" : qualificationStatus === "rejected" ? "closed_lost" : "new",
    contactStatus: qualificationStatus === "qualified_contactable" && verificationStatus === "verified" ? "identified" : "unknown",
    explainability: {
      ...current,
      qualification_status: qualificationStatus,
      qualification_reason_code:
        asText(mutation.qualification_reason_code) ||
        (qualificationStatus === "qualified_contactable"
          ? "verified_contact_present"
          : qualificationStatus === "queued_for_sdr"
            ? "queued_for_sdr"
            : qualificationStatus === "rejected"
              ? "rejected_by_operator"
              : "missing_verified_contact"),
      next_recommended_action:
        qualificationStatus === "qualified_contactable"
          ? "create_lead"
          : qualificationStatus === "queued_for_sdr"
            ? "route_to_sdr"
            : qualificationStatus === "rejected"
              ? "do_not_pursue"
              : "route_to_sdr",
      research_only: qualificationStatus !== "qualified_contactable",
      requires_sdr_qualification: qualificationStatus !== "qualified_contactable",
      qualification_source: asText(mutation.qualification_source),
      qualification_notes: asText(mutation.qualification_notes),
      qualified_at: qualifiedAt,
      qualified_by: actorUserId,
      contact_name: asText(mutation.contact_name) || null,
      phone: asText(mutation.phone) || null,
      email: asText(mutation.email) || null,
      verification_status: verificationStatus,
      sdr_contact_verification_status: verificationStatus,
      sdr_contact_provenance: asText(mutation.qualification_source),
      sdr_verified_at: qualificationStatus === "qualified_contactable" ? qualifiedAt : current.sdr_verified_at ?? null,
      sdr_notes: asText(mutation.qualification_notes)
    }
  };
}

export function buildResearchOnlyDispatchPayload({
  scannerEventId,
  opportunityId,
  sourceType,
  proofAuthenticity
}: {
  scannerEventId: string;
  opportunityId?: string | null;
  sourceType: string;
  proofAuthenticity?: ProofAuthenticity | null;
}) {
  return {
    status: "research_only" as const,
    reason_code: "missing_verified_contact" as const,
    next_step: "route_to_sdr" as const,
    proof_authenticity: proofAuthenticity || "unknown",
    source_type: sourceType,
    scanner_event_id: scannerEventId,
    opportunity_id: opportunityId || null
  };
}

export function buildQualificationBackfill({
  explainability,
  lifecycleStatus,
  contactStatus,
  proofAuthenticity,
  scannerEventId,
  contactEvidence
}: {
  explainability: unknown;
  lifecycleStatus?: unknown;
  contactStatus?: unknown;
  proofAuthenticity?: ProofAuthenticity;
  scannerEventId?: string | null;
  contactEvidence?: OpportunityQualificationContactEvidence | null;
}) {
  const current = asRecord(explainability);
  const existingStatus = normalizeQualificationStatus(current.qualification_status);
  const snapshot = getOpportunityQualificationSnapshot({
    explainability: current,
    lifecycleStatus,
    contactStatus,
    proofAuthenticity
  });

  if (existingStatus) {
    return {
      explainability: current,
      snapshot,
      changed: false
    };
  }

  const merged = mergeOpportunityQualification(current, {
    qualificationStatus: snapshot.qualificationStatus,
    qualificationReasonCode:
      snapshot.qualificationStatus === "qualified_contactable" ? "historical_contactable_status" : "missing_verified_contact",
    nextRecommendedAction: snapshot.qualificationStatus === "qualified_contactable" ? "create_lead" : "route_to_sdr",
    proofAuthenticity: proofAuthenticity ?? snapshot.proofAuthenticity,
    sourceType: snapshot.sourceType,
    scannerEventId: scannerEventId ?? snapshot.scannerEventId,
    contactName: asText(contactEvidence?.contactName) || snapshot.contactName,
    phone: normalizePhone(contactEvidence?.phone) ?? snapshot.phone,
    email: normalizeEmail(contactEvidence?.email) ?? snapshot.email,
    verificationStatus: asText(contactEvidence?.verificationStatus) || snapshot.verificationStatus,
    qualificationSource: asText(contactEvidence?.qualificationSource) || snapshot.qualificationSource,
    qualificationNotes: asText(contactEvidence?.qualificationNotes) || snapshot.qualificationNotes,
    qualifiedAt: asText(contactEvidence?.qualifiedAt) || snapshot.qualifiedAt,
    qualifiedBy: asText(contactEvidence?.qualifiedBy) || snapshot.qualifiedBy
  });

  return {
    explainability: merged,
    snapshot: getOpportunityQualificationSnapshot({
      explainability: merged,
      lifecycleStatus,
      contactStatus,
      proofAuthenticity: proofAuthenticity ?? snapshot.proofAuthenticity
    }),
    changed: true
  };
}
