import { computeOpportunityScores } from "@/lib/v2/scoring";
import type { V2ConnectorRunResult } from "@/lib/v2/types";
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

function mapClusterType(eventCategory: string) {
  const category = eventCategory.toLowerCase();
  if (category.includes("storm") || category.includes("hail") || category.includes("wind") || category.includes("freeze")) return "storms";
  if (category.includes("fire")) return "fires";
  if (category.includes("flood") || category.includes("water")) return "flood_water";
  if (category.includes("infrastructure") || category.includes("utility") || category.includes("outage")) return "infrastructure";
  return "incident";
}

function scoreInputsForEvent(event: ConnectorNormalizedEvent, signalAgreement = 50) {
  const occurredAt = new Date(event.occurredAt).getTime();
  const now = Date.now();
  const minutes = Number.isFinite(occurredAt) ? Math.max(0, Math.round((now - occurredAt) / 60000)) : 120;

  const geographyMatch = event.postalCode
    ? 92
    : event.city && event.state
      ? 80
      : event.locationText
        ? 68
        : 35;

  const geographyPrecision = Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
    ? event.postalCode
      ? 96
      : 84
    : event.postalCode
      ? 78
      : 48;

  const serviceLineFit = (event.serviceLineCandidates?.length || 0) > 1 ? 84 : event.serviceLine ? 78 : 45;

  return {
    sourceType: event.eventType,
    eventRecencyMinutes: minutes,
    severity: Number(event.severityHint ?? event.severity ?? 50),
    geographyMatch,
    geographyPrecision,
    propertyTypeFit: 55,
    serviceLineFit,
    priorCustomerMatch: 40,
    contactAvailability: 45,
    supportingSignalsCount: Number(event.supportingSignalsCount ?? 1),
    catastropheSignal: Number(event.catastropheSignal ?? event.urgencyHint ?? 0),
    sourceReliability: Number(event.sourceReliability ?? 50),
    signalAgreement
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
    .select("id,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,created_at,explainability_json,title,description")
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
  const nextSignalCount = priorSignalCount + 1;

  const existingSourceTypes = Array.isArray(explainability.source_types)
    ? explainability.source_types.map((v) => String(v))
    : [];
  const sourceTypes = Array.from(new Set([...existingSourceTypes, sourceType]));

  const agreementBoost = Math.min(12, Math.max(0, (sourceTypes.length - 1) * 5));

  const weightedAverage = (current: unknown, next: number) =>
    Math.max(0, Math.min(100, Math.round((Number(current || 0) * priorSignalCount + next + agreementBoost) / nextSignalCount)));

  const confidenceScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(((Number(explainability.confidence_score || incomingConfidence) * priorSignalCount + incomingConfidence) / nextSignalCount + agreementBoost) / 1.05)
    )
  );

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

async function upsertOpportunityFromEvent({
  supabase,
  tenantId,
  sourceEventId,
  event,
  classification,
  clusterId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceEventId: string;
  event: ConnectorNormalizedEvent;
  classification: { opportunityType: string; serviceLine: string };
  clusterId: string | null;
}) {
  const scoring = computeOpportunityScores(scoreInputsForEvent(event, 55));
  const locationPoint = toPoint(event.latitude, event.longitude);

  const primaryServiceLine = classification.serviceLine || event.serviceLineCandidates?.[0] || event.serviceLine || "general";
  const secondaryServiceLines = (event.serviceLineCandidates || []).filter((line) => String(line) !== primaryServiceLine);
  const postalCode = String(event.postalCode || parsePostalFromText(String(event.locationText || "")) || "").trim();
  const likelyJobType = String(event.likelyJobType || classifyLikelyJobType(classification.opportunityType, primaryServiceLine));

  const candidate = await resolveOpportunityCandidate({
    supabase,
    tenantId,
    serviceLine: primaryServiceLine,
    postalCode: postalCode || null
  });

  const baseExplainability = {
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
    event_category: event.eventCategory || classification.opportunityType
  } as Record<string, unknown>;

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
        explainability_json: finalScores.explainability
      })
      .eq("id", String(candidate.id))
      .select("id")
      .single();

    if (error || !updated?.id) throw new Error(error?.message || "Failed to update v2 opportunity");
    opportunityId = String(updated.id);
  } else {
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
        contact_status: "identified",
        routing_status: "pending",
        lifecycle_status: "new",
        explainability_json: baseExplainability
      })
      .select("id")
      .single();

    if (error || !inserted?.id) throw new Error(error?.message || "Failed to create v2 opportunity");
    opportunityId = String(inserted.id);
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
    scoring: finalScores,
    multiSignal: Boolean((finalScores.explainability as Record<string, unknown>).multi_signal)
  };
}

export const connectorRunnerInternals = {
  ensureSourceMetadata,
  validateNormalizedEvent,
  mergeOpportunityScores,
  parseLatLngFromPoint,
  haversineMeters,
  mapClusterType,
  scoreInputsForEvent,
  upsertIncidentClusterFromEvent
};

export async function runConnectorForSource({
  supabase,
  tenantId,
  sourceId,
  sourceType,
  sourceConfig,
  actorUserId,
  connector
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
  sourceType: string;
  sourceConfig: Record<string, unknown>;
  actorUserId: string;
  connector: ConnectorAdapter;
}): Promise<V2ConnectorRunResult & { runId: string }> {
  const runStart = new Date().toISOString();
  const { data: runRow, error: runError } = await supabase
    .from("v2_connector_runs")
    .insert({
      source_id: sourceId,
      tenant_id: tenantId,
      status: "running",
      started_at: runStart,
      metadata: { connector_key: connector.key, source_type: sourceType }
    })
    .select("id")
    .single();

  if (runError || !runRow?.id) {
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

  try {
    const pulled = await connector.pull(pullInput);
    const normalizedEvents = await connector.normalize(pulled, pullInput);

    let createdCount = 0;
    let invalidCount = 0;
    let multiSignalCount = 0;
    let totalFreshness = 0;
    let totalReliability = 0;

    for (const event of normalizedEvents) {
      const validation = validateNormalizedEvent(event);
      if (!validation.valid) {
        invalidCount += 1;
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
      const eventScoring = computeOpportunityScores(scoreInputsForEvent(event, 50));

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

      const cluster = await upsertIncidentClusterFromEvent({
        supabase,
        tenantId,
        event
      });

      const classification = connector.classify(event);
      const opportunity = await upsertOpportunityFromEvent({
        supabase,
        tenantId,
        sourceEventId: String(sourceEvent.id),
        event,
        classification,
        clusterId: cluster?.clusterId || null
      });

      if (opportunity.multiSignal) multiSignalCount += 1;
      createdCount += 1;
    }

    const status = createdCount === normalizedEvents.length ? "completed" : "partial";
    await supabase
      .from("v2_connector_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        records_seen: normalizedEvents.length,
        records_created: createdCount,
        metadata: {
          connector_key: connector.key,
          source_type: sourceType,
          terms_status: compliance.termsStatus,
          avg_data_freshness_score:
            normalizedEvents.length > 0 ? Math.round(totalFreshness / normalizedEvents.length) : 0,
          avg_source_reliability:
            normalizedEvents.length > 0 ? Math.round(totalReliability / normalizedEvents.length) : 0,
          invalid_events: invalidCount,
          multi_signal_opportunities: multiSignalCount
        }
      })
      .eq("id", runId);

    await logV2AuditEvent({
      tenantId,
      actorType: "user",
      actorId: actorUserId,
      entityType: "connector_run",
      entityId: runId,
      action: "connector_run_completed",
      before: null,
      after: {
        source_id: sourceId,
        connector_key: connector.key,
        records_seen: normalizedEvents.length,
        records_created: createdCount,
        invalid_events: invalidCount,
        multi_signal_opportunities: multiSignalCount
      }
    });

    return {
      runId,
      recordsSeen: normalizedEvents.length,
      recordsCreated: createdCount,
      status
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connector run failure";
    await supabase
      .from("v2_connector_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
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
      recordsSeen: 0,
      recordsCreated: 0,
      status: "failed",
      errorSummary: message
    };
  }
}
