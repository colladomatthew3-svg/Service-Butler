import { checkOpportunityDuplicate, injectDedupKey } from "@/lib/v2/deduplication";
import {
  findGroundedLeadContactMatch,
  findGroundedPermitLicenseContactMatch,
  parseGroundedLeadContactCandidate
} from "@/lib/v2/grounded-contact-attachment";
import { type FranchiseVertical, getVertical } from "@/lib/v2/franchise-verticals";
import { extractLeadContactCandidate, verifyLeadContactCandidate } from "@/lib/v2/lead-verification";
import { mergeOpportunityQualification } from "@/lib/v2/opportunity-qualification";
import { computeOpportunityScores } from "@/lib/v2/scoring";
import type { V2ConnectorRunResult } from "@/lib/v2/types";
import { type ConnectorRunMode, normalizeConnectorRunMode, sanitizeIdempotencyKey } from "@/lib/v2/connector-run-request";
import type { ConnectorAdapter, ConnectorNormalizedEvent, ConnectorPullInput } from "@/lib/v2/connectors/types";
import { logV2AuditEvent } from "@/lib/v2/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

function toPoint(lat?: number | null, lon?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `POINT(${Number(lon)} ${Number(lat)})`;
}

function toBoundedScore(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveFreshnessScore(occurredAt: string) {
  const ts = new Date(occurredAt).getTime();
  if (!Number.isFinite(ts)) return 0;
  const ageHours = Math.max(0, (Date.now() - ts) / 3_600_000);
  return Math.max(0, Math.min(100, Math.round(100 - ageHours * 5)));
}

function parsePostalFromText(text: string) {
  const match = text.match(/\b\d{5}\b/);
  return match?.[0] || "";
}

function parseLatLngFromPoint(point: unknown) {
  if (!point) return null;

  if (typeof point === "string") {
    const match = point.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (!match) return null;
    const lng = Number(match[1]);
    const lat = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  const shape = point as { coordinates?: unknown };
  if (Array.isArray(shape.coordinates) && shape.coordinates.length >= 2) {
    const lng = Number(shape.coordinates[0]);
    const lat = Number(shape.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function responseWindowFromUrgency(urgency: number) {
  if (urgency >= 85) return "0-4h";
  if (urgency >= 65) return "4-24h";
  return "24-72h";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function isIncidentFamilyEvent(event: ConnectorNormalizedEvent, opportunityType?: string) {
  const normalized = `${event.eventType || ""} ${event.eventCategory || ""} ${opportunityType || ""}`.toLowerCase();
  return normalized.includes("incident") || normalized.includes("fire") || normalized.includes("water") || normalized.includes("storm");
}

function territoryRelevanceFromEvent(event: ConnectorNormalizedEvent, geographyPrecision: number) {
  const hasPoint = Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
  const hasPostal = Boolean(String(event.postalCode || "").trim());
  const hasCityState = Boolean(String(event.city || "").trim() && String(event.state || "").trim());
  if ((hasPoint && hasPostal) || geographyPrecision >= 88) return "high";
  if (hasPoint || hasPostal || hasCityState || geographyPrecision >= 65) return "medium";
  return "low";
}

function recommendIncidentNextAction({
  event,
  confidenceScore,
  urgencyScore,
  freshnessScore,
  geographyPrecision
}: {
  event: ConnectorNormalizedEvent;
  confidenceScore: number;
  urgencyScore: number;
  freshnessScore: number;
  geographyPrecision: number;
}) {
  const territoryRelevance = territoryRelevanceFromEvent(event, geographyPrecision);

  if (confidenceScore >= 75 && urgencyScore >= 80 && freshnessScore >= 70 && territoryRelevance === "high") {
    return {
      action: "dispatch_now",
      reason: "high confidence incident with strong territory relevance and active urgency",
      slaMinutes: 15,
      territoryRelevance
    };
  }

  if (confidenceScore >= 60 && freshnessScore >= 50 && territoryRelevance !== "low") {
    return {
      action: "verify_location_then_route",
      reason: "credible incident signal requires quick location confirmation before dispatch",
      slaMinutes: 30,
      territoryRelevance
    };
  }

  return {
    action: "collect_secondary_signal",
    reason: "low-confidence or weakly located incident should be validated before operator outreach",
    slaMinutes: 60,
    territoryRelevance
  };
}

function classifyLikelyJobType(opportunityType: string, primaryServiceLine: string) {
  const normalized = `${opportunityType} ${primaryServiceLine}`.toLowerCase();
  if (normalized.includes("water") || normalized.includes("flood")) return "water mitigation";
  if (normalized.includes("fire") || normalized.includes("smoke")) return "fire restoration";
  if (normalized.includes("mold")) return "mold remediation";
  if (normalized.includes("plumb") || normalized.includes("sewer") || normalized.includes("pipe")) return "emergency plumbing";
  if (normalized.includes("roof") || normalized.includes("hail") || normalized.includes("wind")) return "roof damage inspection";
  if (normalized.includes("hvac") || normalized.includes("heat") || normalized.includes("ac")) return "HVAC outage";
  return "service dispatch";
}

function incrementCount(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function normalizeAddressKey(input: { address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null }) {
  return [input.address, input.city, input.state, input.postalCode]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

async function findGroundedExistingLeadContact({
  supabase,
  tenantId,
  serviceLine,
  address,
  city,
  state,
  postalCode
}: {
  supabase: SupabaseClient;
  tenantId: string;
  serviceLine: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}) {
  const normalizedPostalCode = String(postalCode || "").trim();
  if (!normalizedPostalCode) return null;

  const { data: leads, error: leadError } = await supabase
    .from("v2_leads")
    .select("id,opportunity_id,contact_name,contact_channels_json,property_address,city,state,postal_code,service_type,created_at,lead_status,do_not_contact")
    .eq("tenant_id", tenantId)
    .eq("postal_code", normalizedPostalCode)
    .order("created_at", { ascending: false })
    .limit(150);

  if (leadError || !Array.isArray(leads) || leads.length === 0) return null;

  const linkedOpportunityIds = Array.from(
    new Set(
      (leads as Array<Record<string, unknown>>)
        .map((row) => String(row.opportunity_id || "").trim())
        .filter(Boolean)
    )
  );
  const serviceLineByOpportunityId = new Map<string, string>();

  if (linkedOpportunityIds.length > 0) {
    const { data: opportunities } = await supabase
      .from("v2_opportunities")
      .select("id,service_line")
      .eq("tenant_id", tenantId)
      .in("id", linkedOpportunityIds);

    for (const row of (opportunities || []) as Array<Record<string, unknown>>) {
      serviceLineByOpportunityId.set(String(row.id || ""), String(row.service_line || ""));
    }
  }

  const match = findGroundedLeadContactMatch({
    address,
    city,
    state,
    postalCode: normalizedPostalCode,
    serviceLine,
    existingLeadContacts: (leads as Array<Record<string, unknown>>).map((row) =>
      parseGroundedLeadContactCandidate(row, serviceLineByOpportunityId.get(String(row.opportunity_id || "")) || null)
    )
  });

  if (match.status !== "attached") return match;

  return {
    ...match,
    matchedLeadId: match.lead.leadId,
    contactName: match.lead.contactName,
    phone: match.lead.phone,
    email: match.lead.email,
    provenance: match.lead.contactProvenance || "historical_verified_lead",
    evidence: match.lead.contactEvidence,
    qualificationSource: "historical_verified_lead",
    qualificationNotes: `${match.reason} lead_id=${match.lead.leadId}`,
    groundedReason: match.reason
  };
}

async function deriveSourceContactState({
  supabase,
  tenantId,
  event,
  serviceLine,
  scoring,
  explainability,
  sourceEventId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  event: ConnectorNormalizedEvent;
  serviceLine: string;
  scoring: {
    sourceReliabilityScore: number;
    explainability: Record<string, unknown>;
    multiSignal?: boolean;
  };
  explainability: Record<string, unknown>;
  sourceEventId: string;
}) {
  const extractedContact = extractLeadContactCandidate({
    sourceEvent: {
      raw_payload: event.rawPayload,
      normalized_payload: event.normalizedPayload
    }
  });
  const sourceVerification = verifyLeadContactCandidate(extractedContact, {
    sourceReliability: scoring.sourceReliabilityScore,
    freshnessScore: Number(scoring.explainability.freshness_score || 0),
    hasMultiSignal: Boolean(scoring.multiSignal),
    duplicatePhone: false,
    duplicateEmail: false,
    duplicateAddress: false
  });
  const hasSourceIdentity = Boolean(extractedContact.name);
  const hasSourceChannels = Boolean(extractedContact.phone || extractedContact.email);
  const permitLicenseMatch =
    event.eventType === "permit_signal" && sourceVerification.status !== "verified"
      ? await findGroundedPermitLicenseContactMatch({
          sourceEvent: {
            raw_payload: event.rawPayload,
            normalized_payload: event.normalizedPayload
          }
        })
      : null;
  const hasPermitLicenseAttachment = permitLicenseMatch?.status === "attached";
  const groundedLeadMatch =
    !hasPermitLicenseAttachment &&
    (event.eventType === "open311_service_request" || event.eventType === "permit_signal") &&
    sourceVerification.status !== "verified"
      ? await findGroundedExistingLeadContact({
          supabase,
          tenantId,
          serviceLine,
          address: event.addressText || event.locationText || null,
          city: event.city || null,
          state: event.state || null,
          postalCode: event.postalCode || null
        })
      : null;
  const hasGroundedAttachment = groundedLeadMatch?.status === "attached";
  const attachedPermitLicense =
    permitLicenseMatch && permitLicenseMatch.status === "attached" ? permitLicenseMatch : null;
  const verification = attachedPermitLicense
    ? {
        ...sourceVerification,
        name: attachedPermitLicense.contactName,
        phone: attachedPermitLicense.phone,
        email: attachedPermitLicense.email,
        status: "verified" as const,
        contactable: Boolean(attachedPermitLicense.phone || attachedPermitLicense.email),
        reasons: [
          ...sourceVerification.reasons,
          attachedPermitLicense.reason,
          `provenance ${attachedPermitLicense.provenance}`
        ],
        provenance: attachedPermitLicense.provenance,
        evidence: attachedPermitLicense.evidence
      }
    : hasGroundedAttachment
    ? {
        ...sourceVerification,
        name: groundedLeadMatch.contactName,
        phone: groundedLeadMatch.phone,
        email: groundedLeadMatch.email,
        status: "verified" as const,
        contactable: Boolean(groundedLeadMatch.phone || groundedLeadMatch.email),
        reasons: [
          ...sourceVerification.reasons,
          `grounded contact reused from verified lead ${groundedLeadMatch.matchedLeadId}`,
          `provenance ${groundedLeadMatch.provenance}`
        ],
        provenance: groundedLeadMatch.provenance,
        evidence: groundedLeadMatch.evidence
      }
    : sourceVerification;

  const contactAttached = Boolean(verification.phone || verification.email);
  const qualificationStatus = verification.status === "verified" ? "qualified_contactable" : "research_only";
  const qualificationReasonCode = hasPermitLicenseAttachment
    ? "verified_contact_attached_from_dob_license"
    : permitLicenseMatch?.status === "weak_match" || permitLicenseMatch?.status === "identity_only"
      ? permitLicenseMatch.reasonCode
      : hasGroundedAttachment
        ? "verified_contact_attached_from_existing_lead"
        : groundedLeadMatch?.status === "weak_match"
          ? groundedLeadMatch.reasonCode
          : !contactAttached && hasSourceIdentity && !hasSourceChannels
            ? "source_contact_identity_only"
            : !contactAttached
              ? "missing_contact_data_from_source"
              : verification.status === "verified"
                ? "verified_contact_present"
                : "source_contact_unverified";
  const qualificationNotes = hasPermitLicenseAttachment
    ? permitLicenseMatch.reason
    : permitLicenseMatch?.status === "weak_match" || permitLicenseMatch?.status === "identity_only"
      ? permitLicenseMatch.reason
      : hasGroundedAttachment
        ? groundedLeadMatch.qualificationNotes
        : groundedLeadMatch?.status === "weak_match"
          ? groundedLeadMatch.reason
          : verification.reasons.join("; ");
  const derivedContactStatus: "identified" | "unknown" = verification.status === "verified" ? "identified" : "unknown";
  const contactAttachmentReason =
    hasPermitLicenseAttachment
      ? "dob_license_info"
      : hasGroundedAttachment
      ? "historical_verified_lead"
      : permitLicenseMatch?.status === "weak_match" || permitLicenseMatch?.status === "identity_only"
        ? "dob_license_info_checked"
      : groundedLeadMatch?.status === "weak_match"
        ? "historical_verified_lead_rejected"
        : contactAttached
          ? "source_payload"
          : "none";
  const contactAttachmentStatus = hasPermitLicenseAttachment
    ? "grounded_attached"
    : hasGroundedAttachment
      ? "grounded_attached"
    : permitLicenseMatch?.status === "weak_match"
      ? "insufficient_grounding"
      : permitLicenseMatch?.status === "identity_only"
        ? "identity_only"
        : groundedLeadMatch?.status === "weak_match"
          ? "insufficient_grounding"
          : !contactAttached && hasSourceIdentity && !hasSourceChannels
            ? "identity_only"
            : !contactAttached
              ? "missing"
              : verification.status === "verified"
                ? "grounded_attached"
                : "insufficient_grounding";

  return {
    contactAttached,
    verification,
    explainability: mergeOpportunityQualification(explainability, {
      qualificationStatus,
      qualificationReasonCode,
      nextRecommendedAction: verification.status === "verified" ? "dispatch_to_lead_queue" : "route_to_sdr",
      sourceType: String(event.eventType || ""),
      scannerEventId: sourceEventId,
      contactName: verification.name,
      phone: verification.phone,
      email: verification.email,
      verificationStatus: verification.status,
      qualificationSource:
        hasPermitLicenseAttachment
          ? "official_dob_license_info"
          : hasGroundedAttachment
          ? groundedLeadMatch.qualificationSource
          : permitLicenseMatch?.status === "weak_match" || permitLicenseMatch?.status === "identity_only"
            ? "official_dob_license_info"
          : groundedLeadMatch?.status === "weak_match"
            ? "historical_verified_lead"
            : "source_payload_contact",
      qualificationNotes
    }),
    contactStatus: derivedContactStatus,
    contactAttachmentReason,
    contactAttachmentStatus,
    contactAttachmentProvenance: hasPermitLicenseAttachment
      ? permitLicenseMatch.provenance
      : hasGroundedAttachment
        ? groundedLeadMatch.provenance
        : permitLicenseMatch?.provenance || verification.provenance,
    contactGroundedReason: permitLicenseMatch?.reason || groundedLeadMatch?.reason || null,
    matchedLeadId: hasGroundedAttachment ? groundedLeadMatch.matchedLeadId : null,
    missingContactData:
      groundedLeadMatch?.status === "weak_match" || permitLicenseMatch?.status === "weak_match" || permitLicenseMatch?.status === "identity_only"
        ? false
        : !contactAttached && !hasSourceIdentity,
    sourceIdentityOnly: permitLicenseMatch?.status === "identity_only" || (!contactAttached && hasSourceIdentity && !hasSourceChannels)
  };
}

function mapClusterType(eventCategory: string) {
  const category = eventCategory.toLowerCase();
  if (category.includes("storm") || category.includes("hail") || category.includes("wind") || category.includes("freeze")) return "storms";
  if (category.includes("fire")) return "fires";
  if (category.includes("flood") || category.includes("water")) return "flood_water";
  if (category.includes("infrastructure") || category.includes("utility") || category.includes("outage")) return "infrastructure";
  return "incident";
}

function scoreInputsForEvent(
  event: ConnectorNormalizedEvent,
  signalAgreement = 50,
  options: {
    vertical?: FranchiseVertical;
    signalCategory?: string;
    incidentFamily?: boolean;
  } = {}
) {
  const occurredAt = new Date(event.occurredAt).getTime();
  const now = Date.now();
  const minutes = Number.isFinite(occurredAt) ? Math.max(0, Math.round((now - occurredAt) / 60000)) : 120;
  const normalized = asRecord(event.normalizedPayload);
  const hasPoint = Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
  const hasPostal = Boolean(String(event.postalCode || "").trim());
  const incidentFamily = Boolean(options.incidentFamily);

  const geographyMatch = hasPostal
    ? 92
    : hasPoint
      ? 84
      : event.city && event.state
        ? 72
        : event.locationText
          ? 58
          : 32;

  const geographyPrecision = hasPoint
    ? hasPostal
      ? 96
      : 82
    : hasPostal
      ? 78
      : 42;

  const serviceLineFit = (event.serviceLineCandidates?.length || 0) > 1 ? 84 : event.serviceLine ? 78 : 45;
  const freshnessScore = toBoundedScore(normalized.data_freshness_score, deriveFreshnessScore(event.occurredAt));
  const timestampConfidenceRaw = String(normalized.timestamp_confidence || "source").trim().toLowerCase();
  const timestampConfidence = timestampConfidenceRaw === "source" ? 100 : timestampConfidenceRaw === "inferred" ? 52 : 72;
  const sparseLocationPenalty = !hasPoint && !hasPostal ? 18 : !hasPoint ? 8 : 0;
  const weakSignalPenalty = Number(event.supportingSignalsCount ?? 1) <= 1 ? 8 : 0;
  const lowReliabilityPenalty = Number(event.sourceReliability ?? 50) < 50 ? 10 : 0;
  const inferredPenalty = timestampConfidenceRaw === "inferred" ? 18 : 0;
  const falsePositiveRisk = clamp(
    sparseLocationPenalty + weakSignalPenalty + lowReliabilityPenalty + inferredPenalty - Math.min(14, freshnessScore / 8)
  );

  return {
    sourceType: event.eventType,
    eventRecencyMinutes: minutes,
    severity: Number(event.severityHint ?? event.severity ?? 50),
    geographyMatch: incidentFamily && !hasPostal && !hasPoint ? Math.max(30, geographyMatch - 16) : geographyMatch,
    geographyPrecision: incidentFamily && !hasPostal && !hasPoint ? Math.max(25, geographyPrecision - 18) : geographyPrecision,
    freshnessScore,
    timestampConfidence,
    falsePositiveRisk,
    propertyTypeFit: 55,
    serviceLineFit,
    priorCustomerMatch: 40,
    contactAvailability: 45,
    supportingSignalsCount: Number(event.supportingSignalsCount ?? 1),
    catastropheSignal: Number(event.catastropheSignal ?? event.urgencyHint ?? 0),
    sourceReliability: Number(event.sourceReliability ?? 50),
    signalAgreement,
    signalCategory: options.signalCategory,
    vertical: options.vertical
  };
}

function shouldSuppressIncidentOpportunity({
  event,
  confidenceScore,
  freshnessScore,
  falsePositiveRisk
}: {
  event: ConnectorNormalizedEvent;
  confidenceScore: number;
  freshnessScore: number;
  falsePositiveRisk: number;
}) {
  if (!isIncidentFamilyEvent(event)) return { suppress: false, reason: "" };

  const hasPreciseLocation = Boolean(String(event.postalCode || "").trim()) || (Number.isFinite(event.latitude) && Number.isFinite(event.longitude));
  const lowSeverity = toBoundedScore(event.severityHint ?? event.severity, 50) < 45;
  const sparseSignals = Number(event.supportingSignalsCount ?? 1) <= 1;

  if (!hasPreciseLocation && freshnessScore <= 20 && falsePositiveRisk >= 55) {
    return { suppress: true, reason: "low-location-confidence and stale incident signal" };
  }
  if (confidenceScore < 40 && (lowSeverity || sparseSignals)) {
    return { suppress: true, reason: "weak incident confidence below suppression threshold" };
  }

  return { suppress: false, reason: "" };
}

async function resolveTenantVertical(supabase: SupabaseClient, tenantId: string) {
  const { data: tenantRow } = await supabase
    .from("v2_tenants")
    .select("settings_json")
    .eq("id", tenantId)
    .maybeSingle();

  const settings =
    tenantRow?.settings_json && typeof tenantRow.settings_json === "object"
      ? (tenantRow.settings_json as Record<string, unknown>)
      : null;

  return getVertical(typeof settings?.vertical === "string" ? settings.vertical : null);
}

function resolveSignalCategory(event: ConnectorNormalizedEvent, fallback: string) {
  const normalized = event.normalizedPayload as Record<string, unknown>;
  const candidates = [
    event.eventCategory,
    typeof normalized.event_category === "string" ? normalized.event_category : null,
    typeof normalized.category === "string" ? normalized.category : null,
    fallback,
    event.eventType
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return "signal";
}

function buildDedupInputForEvent(event: ConnectorNormalizedEvent, serviceType: string) {
  return {
    address: String(event.addressText || event.locationText || "").trim() || null,
    city: String(event.city || "").trim() || null,
    state: String(event.state || "").trim() || null,
    postalCode: String(event.postalCode || parsePostalFromText(String(event.locationText || "")) || "").trim() || null,
    serviceType: String(serviceType || "").trim() || null,
    sourceType: String(event.eventType || "").trim() || null
  };
}

function ensureSourceMetadata({
  event,
  connectorKey,
  sourceType,
  sourceName,
  complianceTermsStatus
}: {
  event: ConnectorNormalizedEvent;
  connectorKey: string;
  sourceType?: string;
  sourceName?: string;
  complianceTermsStatus: string;
}) {
  const normalized = { ...(event.normalizedPayload || {}) } as Record<string, unknown>;
  const sourceProvenance = String(event.sourceProvenance || normalized.source_provenance || connectorKey);
  const termsStatus = String(normalized.terms_status || complianceTermsStatus);
  const dataFreshnessScore = toBoundedScore(normalized.data_freshness_score, deriveFreshnessScore(event.occurredAt));
  const connectorVersion = String(normalized.connector_version || "unknown");

  return {
    source_type: String(sourceType || normalized.source_type || "unknown"),
    source_name: String(sourceName || event.sourceName || normalized.source_name || connectorKey),
    source_provenance: sourceProvenance,
    raw_payload: event.rawPayload,
    normalized_payload: normalized,
    event_timestamp: event.occurredAt,
    ingested_at: new Date().toISOString(),
    lat: Number.isFinite(event.latitude) ? Number(event.latitude) : null,
    lng: Number.isFinite(event.longitude) ? Number(event.longitude) : null,
    address_text: String(event.addressText || event.locationText || ""),
    city: String(event.city || ""),
    state: String(event.state || ""),
    postal_code: String(event.postalCode || parsePostalFromText(String(event.locationText || "")) || ""),
    terms_status: termsStatus,
    compliance_status: String(normalized.compliance_status || termsStatus),
    data_freshness_score: dataFreshnessScore,
    source_reliability_score: toBoundedScore(event.sourceReliability, 50),
    connector_version: connectorVersion,
    dedupe_key: event.dedupeKey,
    event_category: String(event.eventCategory || normalized.event_category || event.eventType || "signal"),
    service_line_candidates: Array.isArray(event.serviceLineCandidates)
      ? event.serviceLineCandidates.map((line) => String(line)).filter(Boolean)
      : event.serviceLine
        ? [String(event.serviceLine)]
        : ["general"],
    severity_hint: toBoundedScore(event.severityHint ?? event.severity, 50),
    urgency_hint: toBoundedScore(event.urgencyHint ?? event.catastropheSignal, 50),
    likely_job_type: String(event.likelyJobType || normalized.likely_job_type || "service dispatch"),
    estimated_response_window: String(event.estimatedResponseWindow || normalized.estimated_response_window || "24-72h"),
    distress_context_summary: String(event.distressContextSummary || normalized.distress_context_summary || ""),
    ...normalized
  };
}

function validateNormalizedEvent(event: ConnectorNormalizedEvent) {
  const failures: string[] = [];

  if (!String(event.dedupeKey || "").trim()) failures.push("dedupeKey missing");
  if (!String(event.eventType || "").trim()) failures.push("eventType missing");
  if (!String(event.title || "").trim()) failures.push("title missing");
  if (!String(event.occurredAt || "").trim()) failures.push("occurredAt missing");
  if (!Array.isArray(event.serviceLineCandidates) && !String(event.serviceLine || "").trim()) {
    failures.push("service line candidates missing");
  }

  return {
    valid: failures.length === 0,
    failures
  };
}

function normalizeRunResultStatus(value: unknown): V2ConnectorRunResult["status"] | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "queued" ||
    normalized === "running" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "partial" ||
    normalized === "stale" ||
    normalized === "replayed"
  ) {
    return normalized;
  }
  return null;
}

async function touchRunHeartbeat({
  supabase,
  runId
}: {
  supabase: SupabaseClient;
  runId: string;
}) {
  await supabase
    .from("v2_connector_runs")
    .update({
      heartbeat_at: new Date().toISOString()
    })
    .eq("id", runId);
}

async function upsertIncidentClusterFromEvent({
  supabase,
  tenantId,
  event
}: {
  supabase: SupabaseClient;
  tenantId: string;
  event: ConnectorNormalizedEvent;
}) {
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) return null;

  const clusterType = mapClusterType(String(event.eventCategory || event.eventType || "incident"));
  const nowIso = new Date().toISOString();

  const { data: clusters } = await supabase
    .from("v2_incident_clusters")
    .select("id,cluster_type,center_point,radius_meters,severity_score,signal_count,first_seen,last_seen,status")
    .eq("tenant_id", tenantId)
    .eq("cluster_type", clusterType)
    .eq("status", "active")
    .order("last_seen", { ascending: false })
    .limit(40);

  const candidates = (clusters || []) as Array<Record<string, unknown>>;
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);

  const matched = candidates.find((cluster) => {
    const center = parseLatLngFromPoint(cluster.center_point);
    if (!center) return false;

    const radius = Math.max(500, Number(cluster.radius_meters || 5000));
    const distance = haversineMeters(lat, lng, center.lat, center.lng);
    const lastSeen = new Date(String(cluster.last_seen || nowIso)).getTime();
    const stale = Date.now() - lastSeen > 6 * 60 * 60 * 1000;

    return !stale && distance <= radius;
  });

  if (matched?.id) {
    const nextSignals = Number(matched.signal_count || 0) + 1;
    const nextSeverity = Math.max(Number(matched.severity_score || 0), toBoundedScore(event.severityHint ?? event.severity, 50));

    await supabase
      .from("v2_incident_clusters")
      .update({
        signal_count: nextSignals,
        severity_score: nextSeverity,
        last_seen: nowIso
      })
      .eq("id", String(matched.id));

    return {
      clusterId: String(matched.id),
      signalCount: nextSignals,
      clusterType
    };
  }

  const { data: inserted, error } = await supabase
    .from("v2_incident_clusters")
    .insert({
      tenant_id: tenantId,
      cluster_type: clusterType,
      center_point: `SRID=4326;POINT(${lng} ${lat})`,
      radius_meters: 5000,
      severity_score: toBoundedScore(event.severityHint ?? event.severity, 50),
      signal_count: 1,
      first_seen: event.occurredAt,
      last_seen: nowIso,
      status: "active"
    })
    .select("id")
    .single();

  if (error || !inserted?.id) return null;

  return {
    clusterId: String(inserted.id),
    signalCount: 1,
    clusterType
  };
}

async function resolveOpportunityCandidate({
  supabase,
  tenantId,
  serviceLine,
  postalCode
}: {
  supabase: SupabaseClient;
  tenantId: string;
  serviceLine: string;
  postalCode: string | null;
}) {
  let query = supabase
    .from("v2_opportunities")
    .select(
      "id,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,incident_cluster_id,location,postal_code,created_at,explainability_json,title,description"
    )
    .eq("tenant_id", tenantId)
    .eq("service_line", serviceLine)
    .order("created_at", { ascending: false })
    .limit(25);

  if (postalCode) {
    query = query.eq("postal_code", postalCode);
  }

  const { data } = await query;
  const rows = (data || []) as Array<Record<string, unknown>>;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (
    rows.find((row) => {
      const ts = new Date(String(row.created_at || "")).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    }) || null
  );
}

async function loadOpportunityCandidateById({
  supabase,
  tenantId,
  opportunityId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  opportunityId: string;
}) {
  const { data, error } = await supabase
    .from("v2_opportunities")
    .select(
      "id,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,incident_cluster_id,location,postal_code,created_at,explainability_json,title,description"
    )
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data as Record<string, unknown>;
}

function mergeOpportunityScores({
  existing,
  incoming,
  incomingConfidence,
  sourceType
}: {
  existing: Record<string, unknown>;
  incoming: ReturnType<typeof computeOpportunityScores>;
  incomingConfidence: number;
  sourceType: string;
}) {
  const explainability = (existing.explainability_json || {}) as Record<string, unknown>;
  const priorSignalCount = Math.max(1, Number(explainability.signal_count || 1));
  const existingSourceTypes = Array.isArray(explainability.source_types)
    ? explainability.source_types.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const normalizedSourceType = String(sourceType || "").trim().toLowerCase();
  const existingNormalized = existingSourceTypes.map((value) => value.toLowerCase());
  const isSameSourceTypeRepeat = normalizedSourceType ? existingNormalized.includes(normalizedSourceType) : false;
  const sourceTypes = isSameSourceTypeRepeat
    ? existingSourceTypes
    : Array.from(new Set([...existingSourceTypes, String(sourceType || "").trim()])).filter(Boolean);
  const nextSignalCount = isSameSourceTypeRepeat ? priorSignalCount : priorSignalCount + 1;
  const agreementBoost = isSameSourceTypeRepeat ? 0 : Math.min(12, Math.max(0, (sourceTypes.length - 1) * 5));
  const maxLift = isSameSourceTypeRepeat ? 2 : 10;

  const weightedAverage = (current: unknown, next: number) => {
    const currentValue = Number(current || 0);
    const raw = Math.max(0, Math.min(100, Math.round((currentValue * priorSignalCount + next + agreementBoost) / nextSignalCount)));
    return isSameSourceTypeRepeat ? Math.min(currentValue + maxLift, raw) : raw;
  };

  const priorConfidence = Number(explainability.confidence_score || incomingConfidence);
  const rawConfidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(((priorConfidence * priorSignalCount + incomingConfidence) / nextSignalCount + agreementBoost) / 1.05)
    )
  );
  const confidenceScore = isSameSourceTypeRepeat ? Math.min(priorConfidence + maxLift, rawConfidence) : rawConfidence;

  return {
    urgencyScore: weightedAverage(existing.urgency_score, incoming.urgencyScore),
    jobLikelihoodScore: weightedAverage(existing.job_likelihood_score, incoming.jobLikelihoodScore),
    sourceReliabilityScore: weightedAverage(existing.source_reliability_score, incoming.sourceReliabilityScore),
    catastropheLinkageScore: weightedAverage(existing.catastrophe_linkage_score, incoming.catastropheLinkageScore),
    confidenceScore,
    signalCount: nextSignalCount,
    sourceTypes,
    multiSignal: nextSignalCount > 1 && sourceTypes.length > 1
  };
}

function shouldMergeIncidentCandidate({
  candidate,
  event,
  clusterId,
  eventCategory
}: {
  candidate: Record<string, unknown>;
  event: ConnectorNormalizedEvent;
  clusterId: string | null;
  eventCategory: string;
}) {
  const explainability = asRecord(candidate.explainability_json);
  const existingCategory = String(explainability.event_category || "");
  if (existingCategory && existingCategory.toLowerCase() === eventCategory.toLowerCase()) return true;

  const existingCluster = String(candidate.incident_cluster_id || "");
  if (clusterId && existingCluster && existingCluster === clusterId) return true;

  const existingPostal = String(candidate.postal_code || "").trim();
  const incomingPostal = String(event.postalCode || "").trim();
  if (existingPostal && incomingPostal && existingPostal === incomingPostal) return true;

  const existingPoint = parseLatLngFromPoint(candidate.location);
  if (existingPoint && Number.isFinite(event.latitude) && Number.isFinite(event.longitude)) {
    const distance = haversineMeters(existingPoint.lat, existingPoint.lng, Number(event.latitude), Number(event.longitude));
    if (distance <= 8_000) return true;
  }

  return false;
}

async function upsertOpportunityFromEvent({
  supabase,
  tenantId,
  sourceEventId,
  event,
  classification,
  clusterId,
  vertical
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceEventId: string;
  event: ConnectorNormalizedEvent;
  classification: { opportunityType: string; serviceLine: string };
  clusterId: string | null;
  vertical: FranchiseVertical;
}): Promise<{
  opportunityId: string;
  multiSignal: boolean;
  writeMode: "created" | "updated";
  contactAttached: boolean;
  contactStatus: "identified" | "unknown";
  verificationStatus: string | null;
  contactAttachmentReason: string | null;
  sourceIdentityOnly: boolean;
}> {
  const locationPoint = toPoint(event.latitude, event.longitude);

  const primaryServiceLine = classification.serviceLine || event.serviceLineCandidates?.[0] || event.serviceLine || "general";
  const secondaryServiceLines = (event.serviceLineCandidates || []).filter((line) => String(line) !== primaryServiceLine);
  const postalCode = String(event.postalCode || parsePostalFromText(String(event.locationText || "")) || "").trim();
  const likelyJobType = String(event.likelyJobType || classifyLikelyJobType(classification.opportunityType, primaryServiceLine));
  const signalCategory = resolveSignalCategory(event, classification.opportunityType);
  const incidentFamily = isIncidentFamilyEvent(event, classification.opportunityType);
  const scoring = computeOpportunityScores(
    scoreInputsForEvent(event, 55, {
      vertical,
      signalCategory,
      incidentFamily
    })
  );
  const dedupInput = buildDedupInputForEvent(event, primaryServiceLine);
  const duplicate = await checkOpportunityDuplicate(supabase, tenantId, dedupInput, vertical);

  let candidate =
    (duplicate.isDuplicate
      ? await loadOpportunityCandidateById({
          supabase,
          tenantId,
          opportunityId: duplicate.existingOpportunityId
        })
      : null) ||
    (await resolveOpportunityCandidate({
      supabase,
      tenantId,
      serviceLine: primaryServiceLine,
      postalCode: postalCode || null
    }));

  if (incidentFamily && candidate?.id) {
    const allowMerge = shouldMergeIncidentCandidate({
      candidate,
      event,
      clusterId,
      eventCategory: signalCategory
    });
    if (!allowMerge) candidate = null;
  }

  const incidentAction = incidentFamily
    ? recommendIncidentNextAction({
        event,
        confidenceScore: scoring.confidenceScore,
        urgencyScore: scoring.urgencyScore,
        freshnessScore: Number(scoring.explainability.freshness_score || 0),
        geographyPrecision: Number(scoring.explainability.geography_precision || 0)
      })
    : null;

  const baseExplainability = injectDedupKey(
    {
      ...scoring.explainability,
      primary_service_line: primaryServiceLine,
      secondary_service_lines: secondaryServiceLines,
      likely_job_type: likelyJobType,
      estimated_response_window: event.estimatedResponseWindow || responseWindowFromUrgency(scoring.urgencyScore),
      confidence_reasoning: `score=${scoring.confidenceScore}; source=${event.eventType}; recency_weighted=true`,
      distress_context_summary: event.distressContextSummary || "",
      confidence_score: scoring.confidenceScore,
      signal_count: 1,
      source_types: [event.eventType],
      multi_signal: false,
      event_category: signalCategory,
      incident_family: incidentFamily,
      recommended_next_action: incidentAction?.action ?? "route_standard",
      recommended_action_reason: incidentAction?.reason ?? "default routing path",
      recommended_action_sla_minutes: incidentAction?.slaMinutes ?? 45,
      territory_relevance: incidentAction?.territoryRelevance ?? "medium",
      review_required: Boolean(incidentAction && incidentAction.action !== "dispatch_now")
    } as Record<string, unknown>,
    dedupInput
  );

  let opportunityId = "";
  let finalScores = {
    urgencyScore: scoring.urgencyScore,
    jobLikelihoodScore: scoring.jobLikelihoodScore,
    sourceReliabilityScore: scoring.sourceReliabilityScore,
    catastropheLinkageScore: scoring.catastropheLinkageScore,
    confidenceScore: scoring.confidenceScore,
    explainability: baseExplainability,
    multiSignal: false
  };

  let writeMode: "created" | "updated" = "created";
  let contactAttached = false;
  let contactStatus: "identified" | "unknown" = "unknown";
  let verificationStatus: string | null = null;
  let contactAttachmentReason: string | null = null;
  let sourceIdentityOnly = false;

  if (candidate?.id) {
    const merged = mergeOpportunityScores({
      existing: candidate,
      incoming: scoring,
      incomingConfidence: scoring.confidenceScore,
      sourceType: event.eventType
    });

    finalScores = {
      urgencyScore: merged.urgencyScore,
      jobLikelihoodScore: merged.jobLikelihoodScore,
      sourceReliabilityScore: merged.sourceReliabilityScore,
      catastropheLinkageScore: merged.catastropheLinkageScore,
      confidenceScore: merged.confidenceScore,
      explainability: {
        ...baseExplainability,
        signal_count: merged.signalCount,
        source_types: merged.sourceTypes,
        multi_signal: merged.multiSignal,
        confidence_score: merged.confidenceScore,
        confidence_reasoning: `multi_signal=${merged.multiSignal}; sources=${merged.sourceTypes.join("+")}; score=${merged.confidenceScore}`
      },
      multiSignal: merged.multiSignal
    };

    const contactState = await deriveSourceContactState({
      supabase,
      tenantId,
      event,
      serviceLine: primaryServiceLine,
      scoring: finalScores,
      explainability: finalScores.explainability,
      sourceEventId
    });

    const { data: updated, error } = await supabase
      .from("v2_opportunities")
      .update({
        source_event_id: sourceEventId,
        incident_cluster_id: clusterId,
        opportunity_type: classification.opportunityType,
        service_line: primaryServiceLine,
        title: String(candidate.title || event.title),
        description: String(candidate.description || event.description || ""),
        urgency_score: finalScores.urgencyScore,
        job_likelihood_score: finalScores.jobLikelihoodScore,
        source_reliability_score: finalScores.sourceReliabilityScore,
        catastrophe_linkage_score: finalScores.catastropheLinkageScore,
        location_text: event.locationText || null,
        location: locationPoint ? `SRID=4326;${locationPoint}` : null,
        postal_code: postalCode || null,
        contact_status: contactState.contactStatus,
        explainability_json: {
          ...contactState.explainability,
          contact_attached: contactState.contactAttached,
          contact_attachment_reason: contactState.contactAttachmentReason,
          contact_attachment_status: contactState.contactAttachmentStatus,
          contact_attachment_provenance: contactState.contactAttachmentProvenance,
          contact_grounded_reason: contactState.contactGroundedReason,
          matched_verified_lead_id: contactState.matchedLeadId,
          missing_contact_data: contactState.missingContactData
        }
      })
      .eq("id", String(candidate.id))
      .select("id")
      .single();

    if (error || !updated?.id) throw new Error(error?.message || "Failed to update v2 opportunity");
    opportunityId = String(updated.id);
    writeMode = "updated";
    contactAttached = contactState.contactAttached;
    contactStatus = contactState.contactStatus;
    verificationStatus = contactState.verification.status;
    contactAttachmentReason = contactState.contactAttachmentReason;
    sourceIdentityOnly = contactState.sourceIdentityOnly;
  } else {
    const contactState = await deriveSourceContactState({
      supabase,
      tenantId,
      event,
      serviceLine: primaryServiceLine,
      scoring: { ...scoring, multiSignal: false },
      explainability: baseExplainability,
      sourceEventId
    });

    const { data: inserted, error } = await supabase
      .from("v2_opportunities")
      .insert({
        tenant_id: tenantId,
        source_event_id: sourceEventId,
        incident_cluster_id: clusterId,
        opportunity_type: classification.opportunityType,
        service_line: primaryServiceLine,
        title: event.title,
        description: event.description || null,
        urgency_score: scoring.urgencyScore,
        job_likelihood_score: scoring.jobLikelihoodScore,
        contactability_score: scoring.contactabilityScore,
        source_reliability_score: scoring.sourceReliabilityScore,
        revenue_band: scoring.revenueBand,
        catastrophe_linkage_score: scoring.catastropheLinkageScore,
        location_text: event.locationText || null,
        location: locationPoint ? `SRID=4326;${locationPoint}` : null,
        postal_code: postalCode || null,
        contact_status: contactState.contactStatus,
        routing_status: "pending",
        lifecycle_status: "new",
        explainability_json: {
          ...contactState.explainability,
          contact_attached: contactState.contactAttached,
          contact_attachment_reason: contactState.contactAttachmentReason,
          contact_attachment_status: contactState.contactAttachmentStatus,
          contact_attachment_provenance: contactState.contactAttachmentProvenance,
          contact_grounded_reason: contactState.contactGroundedReason,
          matched_verified_lead_id: contactState.matchedLeadId,
          missing_contact_data: contactState.missingContactData,
          normalized_address_key: normalizeAddressKey({
            address: event.addressText || event.locationText || null,
            city: event.city || null,
            state: event.state || null,
            postalCode: postalCode || null
          })
        }
      })
      .select("id")
      .single();

    if (error || !inserted?.id) throw new Error(error?.message || "Failed to create v2 opportunity");
    opportunityId = String(inserted.id);
    contactAttached = contactState.contactAttached;
    contactStatus = contactState.contactStatus;
    verificationStatus = contactState.verification.status;
    contactAttachmentReason = contactState.contactAttachmentReason;
    sourceIdentityOnly = contactState.sourceIdentityOnly;
  }

  await supabase.from("v2_opportunity_signals").insert([
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "urgency_score",
      signal_value: finalScores.urgencyScore,
      signal_weight: 1,
      explanation: "Urgency score from recency + severity + catastrophe context"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "job_likelihood_score",
      signal_value: finalScores.jobLikelihoodScore,
      signal_weight: 1,
      explanation: "Likelihood score from service fit, recency, severity, and source agreement"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "source_reliability_score",
      signal_value: finalScores.sourceReliabilityScore,
      signal_weight: 1,
      explanation: "Source reliability score"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "catastrophe_linkage_score",
      signal_value: finalScores.catastropheLinkageScore,
      signal_weight: 1,
      explanation: "Catastrophe linkage strength"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "confidence_score",
      signal_value: finalScores.confidenceScore,
      signal_weight: 1,
      explanation: "Confidence score derived from recency, reliability, geography precision, and signal agreement"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: String(event.eventCategory || event.eventType),
      signal_value: toBoundedScore(event.severityHint ?? event.severity, 50),
      signal_weight: 1,
      explanation: `Supporting signal from ${event.eventType}`,
      metadata: {
        event_type: event.eventType,
        source_name: event.sourceName || "unknown"
      }
    }
  ]);

  return {
    opportunityId,
    multiSignal: Boolean((finalScores.explainability as Record<string, unknown>).multi_signal),
    writeMode,
    contactAttached,
    contactStatus,
    verificationStatus,
    contactAttachmentReason,
    sourceIdentityOnly
  };

}

export const connectorRunnerInternals = {
  buildDedupInputForEvent,
  ensureSourceMetadata,
  validateNormalizedEvent,
  mergeOpportunityScores,
  parseLatLngFromPoint,
  haversineMeters,
  mapClusterType,
  resolveSignalCategory,
  resolveTenantVertical,
  scoreInputsForEvent,
  upsertIncidentClusterFromEvent,
  shouldSuppressIncidentOpportunity
};

export async function runConnectorForSource({
  supabase,
  tenantId,
  sourceId,
  sourceType,
  sourceConfig,
  actorUserId,
  connector,
  runMode = "standard",
  replayedFromRunId = null,
  idempotencyKey = null
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
  sourceType: string;
  sourceConfig: Record<string, unknown>;
  actorUserId: string;
  connector: ConnectorAdapter;
  runMode?: ConnectorRunMode;
  replayedFromRunId?: string | null;
  idempotencyKey?: string | null;
}): Promise<V2ConnectorRunResult & { runId: string }> {
  const normalizedRunMode = normalizeConnectorRunMode(runMode);
  const normalizedReplaySource = String(replayedFromRunId || "").trim() || null;
  const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey) || null;

  const runStart = new Date().toISOString();
  const { data: runRow, error: runError } = await supabase
    .from("v2_connector_runs")
    .insert({
      source_id: sourceId,
      tenant_id: tenantId,
      status: "running",
      started_at: runStart,
      heartbeat_at: runStart,
      idempotency_key: normalizedIdempotencyKey,
      replayed_from_run_id: normalizedReplaySource,
      metadata: {
        connector_key: connector.key,
        source_type: sourceType,
        run_mode: normalizedRunMode,
        replayed_from_run_id: normalizedReplaySource
      }
    })
    .select("id")
    .single();

  if (runError || !runRow?.id) {
    if ((runError as { code?: string } | null)?.code === "23505" && normalizedIdempotencyKey) {
      const { data: existingRun, error: existingRunError } = await supabase
        .from("v2_connector_runs")
        .select("id,status,records_seen,records_created,error_summary,idempotency_key,replayed_from_run_id,metadata")
        .eq("tenant_id", tenantId)
        .eq("source_id", sourceId)
        .eq("idempotency_key", normalizedIdempotencyKey)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingRunError && existingRun?.id) {
        const status = normalizeRunResultStatus(existingRun.status) || "partial";
        return {
          runId: String(existingRun.id),
          status,
          recordsSeen: Number(existingRun.records_seen || 0),
          recordsCreated: Number(existingRun.records_created || 0),
          idempotencyKey: String(existingRun.idempotency_key || normalizedIdempotencyKey || ""),
          replayedFromRunId: existingRun.replayed_from_run_id ? String(existingRun.replayed_from_run_id) : null,
          runMode: String((existingRun.metadata as Record<string, unknown> | null)?.run_mode || normalizedRunMode) === "replay" ? "replay" : "standard",
          errorSummary: String(existingRun.error_summary || "")
        };
      }
    }

    throw new Error(runError?.message || "Could not create connector run");
  }

  const runId = String(runRow.id);
  const pullInput: ConnectorPullInput = {
    tenantId,
    sourceId,
    sourceType,
    config: sourceConfig
  };

  const compliance = connector.compliancePolicy(pullInput);
  if (compliance.termsStatus === "blocked" || !compliance.ingestionAllowed) {
    const reason =
      compliance.termsStatus === "blocked"
        ? "Connector blocked by compliance policy"
        : "Connector ingestion denied by compliance policy";

    await supabase
      .from("v2_connector_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        error_summary: reason
      })
      .eq("id", runId);

    return {
      runId,
      recordsSeen: 0,
      recordsCreated: 0,
      status: "failed",
      errorSummary: reason
    };
  }

  let createdCount = 0;
  let invalidCount = 0;
  let multiSignalCount = 0;
  let totalFreshness = 0;
  let totalReliability = 0;
  let recordsSeen = 0;
  const trace = {
    raw_records_fetched: 0,
    normalized_records: 0,
    validation_failure_counts: {} as Record<string, number>,
    source_events_written: 0,
    suppressed_before_opportunity: 0,
    suppression_reason_counts: {} as Record<string, number>,
    opportunities_created: 0,
    opportunities_updated: 0,
    contact_attached: 0,
    contact_missing: 0,
    contact_attached_from_existing_lead: 0,
    contact_found_but_unverified: 0,
    contact_identity_only: 0
  };

  try {
    const pulled = await connector.pull(pullInput);
    trace.raw_records_fetched = pulled.length;
    const normalizedEvents = await connector.normalize(pulled, pullInput);
    trace.normalized_records = normalizedEvents.length;
    const vertical = await resolveTenantVertical(supabase, tenantId);

    for (let index = 0; index < normalizedEvents.length; index += 1) {
      const event = normalizedEvents[index];
      if (!event) continue;
      recordsSeen += 1;

      const validation = validateNormalizedEvent(event);
      if (!validation.valid) {
        invalidCount += 1;
        for (const failure of validation.failures) incrementCount(trace.validation_failure_counts, failure);
        continue;
      }

      const normalizedPayload = ensureSourceMetadata({
        event,
        connectorKey: connector.key,
        sourceType,
        sourceName: String(sourceConfig.connector_name || sourceConfig.source_name || sourceType),
        complianceTermsStatus: compliance.termsStatus
      });

      const locationPoint = toPoint(event.latitude, event.longitude);
      const classification = connector.classify(event);
      const signalCategory = resolveSignalCategory(event, classification.opportunityType);
      const incidentFamily = isIncidentFamilyEvent(event, classification.opportunityType);
      const eventScoring = computeOpportunityScores(
        scoreInputsForEvent(event, 50, {
          vertical,
          signalCategory,
          incidentFamily
        })
      );

      totalFreshness += Number(normalizedPayload.data_freshness_score || 0);
      totalReliability += Number(eventScoring.sourceReliabilityScore || 50);

      const { data: sourceEvent, error: sourceEventError } = await supabase
        .from("v2_source_events")
        .upsert(
          {
            source_id: sourceId,
            tenant_id: tenantId,
            connector_run_id: runId,
            occurred_at: event.occurredAt,
            ingested_at: new Date().toISOString(),
            raw_payload: event.rawPayload,
            normalized_payload: normalizedPayload,
            location_text: event.locationText || null,
            location: locationPoint ? `SRID=4326;${locationPoint}` : null,
            confidence_score: eventScoring.confidenceScore,
            source_reliability_score: eventScoring.sourceReliabilityScore,
            compliance_status: compliance.termsStatus,
            dedupe_key: connector.dedupeKey(event),
            event_type: event.eventType
          },
          { onConflict: "source_id,dedupe_key" }
        )
        .select("id")
        .single();

      if (sourceEventError || !sourceEvent?.id) {
        throw new Error(sourceEventError?.message || "Failed writing source event");
      }
      trace.source_events_written += 1;

      const suppression = shouldSuppressIncidentOpportunity({
        event,
        confidenceScore: eventScoring.confidenceScore,
        freshnessScore: Number(eventScoring.explainability.freshness_score || 0),
        falsePositiveRisk: Number(eventScoring.explainability.false_positive_risk || 0)
      });
      if (suppression.suppress) {
        invalidCount += 1;
        trace.suppressed_before_opportunity += 1;
        incrementCount(trace.suppression_reason_counts, suppression.reason || "suppressed");
        continue;
      }

      const cluster = await upsertIncidentClusterFromEvent({
        supabase,
        tenantId,
        event
      });

      const opportunity = await upsertOpportunityFromEvent({
        supabase,
        tenantId,
        sourceEventId: String(sourceEvent.id),
        event,
        classification,
        clusterId: cluster?.clusterId || null,
        vertical
      });

      if (opportunity.multiSignal) multiSignalCount += 1;
      createdCount += 1;
      if (opportunity.writeMode === "created") trace.opportunities_created += 1;
      else trace.opportunities_updated += 1;
      if (opportunity.contactAttached) trace.contact_attached += 1;
      else trace.contact_missing += 1;
      if (opportunity.contactAttachmentReason === "historical_verified_lead") {
        trace.contact_attached_from_existing_lead += 1;
      }
      if (opportunity.verificationStatus === "review") trace.contact_found_but_unverified += 1;
      if ((opportunity as { sourceIdentityOnly?: boolean }).sourceIdentityOnly) trace.contact_identity_only += 1;

      if ((index + 1) % 5 === 0) {
        await touchRunHeartbeat({ supabase, runId });
      }
    }

    await touchRunHeartbeat({ supabase, runId });

    const baseStatus = createdCount === normalizedEvents.length ? "completed" : "partial";
    const status: V2ConnectorRunResult["status"] = normalizedRunMode === "replay" ? "replayed" : baseStatus;
    await supabase
      .from("v2_connector_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        records_seen: recordsSeen,
        records_created: createdCount,
        metadata: {
          connector_key: connector.key,
          source_type: sourceType,
          run_mode: normalizedRunMode,
          replayed_from_run_id: normalizedReplaySource,
          terms_status: compliance.termsStatus,
          avg_data_freshness_score: recordsSeen > 0 ? Math.round(totalFreshness / recordsSeen) : 0,
          avg_source_reliability: recordsSeen > 0 ? Math.round(totalReliability / recordsSeen) : 0,
          invalid_events: invalidCount,
          multi_signal_opportunities: multiSignalCount,
          ...trace,
          replay_result_status: baseStatus,
          idempotency_key: normalizedIdempotencyKey
        }
      })
      .eq("id", runId);

    await logV2AuditEvent({
      tenantId,
      actorType: "user",
      actorId: actorUserId,
      entityType: "connector_run",
      entityId: runId,
      action: status === "replayed" ? "connector_run_replayed" : "connector_run_completed",
      before: null,
      after: {
        source_id: sourceId,
        connector_key: connector.key,
        records_seen: recordsSeen,
        records_created: createdCount,
        invalid_events: invalidCount,
        multi_signal_opportunities: multiSignalCount,
        ...trace,
        run_mode: normalizedRunMode,
        idempotency_key: normalizedIdempotencyKey
      }
    });

    return {
      runId,
      recordsSeen,
      recordsCreated: createdCount,
      status,
      runMode: normalizedRunMode,
      replayedFromRunId: normalizedReplaySource,
      idempotencyKey: normalizedIdempotencyKey
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connector run failure";
    await supabase
      .from("v2_connector_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        records_seen: recordsSeen,
        records_created: createdCount,
        error_summary: message
      })
      .eq("id", runId);

    await logV2AuditEvent({
      tenantId,
      actorType: "user",
      actorId: actorUserId,
      entityType: "connector_run",
      entityId: runId,
      action: "connector_run_failed",
      before: null,
      after: { source_id: sourceId, connector_key: connector.key, error: message }
    });

    return {
      runId,
      recordsSeen,
      recordsCreated: createdCount,
      status: "failed",
      runMode: normalizedRunMode,
      replayedFromRunId: normalizedReplaySource,
      idempotencyKey: normalizedIdempotencyKey,
      errorSummary: message
    };
  }
}
