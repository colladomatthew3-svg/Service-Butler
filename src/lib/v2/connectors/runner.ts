import { computeOpportunityScores } from "@/lib/v2/scoring";
import type { V2ConnectorRunResult } from "@/lib/v2/types";
import type { ConnectorAdapter, ConnectorNormalizedEvent, ConnectorPullInput } from "@/lib/v2/connectors/types";
import { logV2AuditEvent } from "@/lib/v2/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

function toPoint(lat?: number | null, lon?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `POINT(${Number(lon)} ${Number(lat)})`;
}

function scoreInputsForEvent(event: ConnectorNormalizedEvent) {
  const occurredAt = new Date(event.occurredAt).getTime();
  const now = Date.now();
  const minutes = Number.isFinite(occurredAt) ? Math.max(0, Math.round((now - occurredAt) / 60000)) : 120;

  return {
    sourceType: event.eventType,
    eventRecencyMinutes: minutes,
    severity: Number(event.severity ?? 50),
    geographyMatch: event.locationText ? 70 : 35,
    propertyTypeFit: 55,
    serviceLineFit: event.serviceLine ? 78 : 45,
    priorCustomerMatch: 40,
    contactAvailability: 45,
    supportingSignalsCount: Number(event.supportingSignalsCount ?? 1),
    catastropheSignal: Number(event.catastropheSignal ?? 0),
    sourceReliability: Number(event.sourceReliability ?? 50)
  };
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

function ensureSourceMetadata({
  event,
  connectorKey,
  complianceTermsStatus
}: {
  event: ConnectorNormalizedEvent;
  connectorKey: string;
  complianceTermsStatus: string;
}) {
  const normalized = { ...(event.normalizedPayload || {}) } as Record<string, unknown>;
  const sourceProvenance = String(normalized.source_provenance || connectorKey);
  const termsStatus = String(normalized.terms_status || complianceTermsStatus);
  const dataFreshnessScore = toBoundedScore(normalized.data_freshness_score, deriveFreshnessScore(event.occurredAt));
  const connectorVersion = String(normalized.connector_version || "unknown");

  return {
    ...normalized,
    source_provenance: sourceProvenance,
    terms_status: termsStatus,
    data_freshness_score: dataFreshnessScore,
    connector_version: connectorVersion
  };
}

export const connectorRunnerInternals = {
  ensureSourceMetadata
};

async function upsertOpportunityFromEvent({
  supabase,
  tenantId,
  sourceEventId,
  event,
  classification
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceEventId: string;
  event: ConnectorNormalizedEvent;
  classification: { opportunityType: string; serviceLine: string };
}) {
  const scoring = computeOpportunityScores(scoreInputsForEvent(event));
  const locationPoint = toPoint(event.latitude, event.longitude);

  const { data: existing } = await supabase
    .from("v2_opportunities")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source_event_id", sourceEventId)
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    source_event_id: sourceEventId,
    opportunity_type: classification.opportunityType,
    service_line: classification.serviceLine,
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
    contact_status: "identified",
    routing_status: "pending",
    lifecycle_status: "new",
    explainability_json: scoring.explainability
  };

  let opportunityId = "";

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from("v2_opportunities")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message || "Failed to update v2 opportunity");
    opportunityId = String(updated.id);
  } else {
    const { data: inserted, error } = await supabase
      .from("v2_opportunities")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message || "Failed to create v2 opportunity");
    opportunityId = String(inserted.id);
  }

  await supabase.from("v2_opportunity_signals").insert([
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "urgency_score",
      signal_value: scoring.urgencyScore,
      signal_weight: 1,
      explanation: "Urgency score from recency + severity + catastrophe context"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "job_likelihood_score",
      signal_value: scoring.jobLikelihoodScore,
      signal_weight: 1,
      explanation: "Likelihood score from service fit, recency, severity, and signals"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "contactability_score",
      signal_value: scoring.contactabilityScore,
      signal_weight: 1,
      explanation: "Estimated ability to contact lead quickly"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "source_reliability_score",
      signal_value: scoring.sourceReliabilityScore,
      signal_weight: 1,
      explanation: "Source reliability score"
    },
    {
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      signal_key: "catastrophe_linkage_score",
      signal_value: scoring.catastropheLinkageScore,
      signal_weight: 1,
      explanation: "Catastrophe linkage strength"
    }
  ]);

  return { opportunityId, scoring };
}

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
    let totalFreshness = 0;
    let totalReliability = 0;

    for (const event of normalizedEvents) {
      const dedupe = connector.dedupeKey(event);
      const locationPoint = toPoint(event.latitude, event.longitude);
      const normalizedPayload = ensureSourceMetadata({
        event,
        connectorKey: connector.key,
        complianceTermsStatus: compliance.termsStatus
      });
      totalFreshness += Number(normalizedPayload.data_freshness_score || 0);
      totalReliability += Number(event.sourceReliability ?? 50);

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
            confidence_score: Number(event.severity ?? 50),
            source_reliability_score: Number(event.sourceReliability ?? 50),
            compliance_status: compliance.termsStatus,
            dedupe_key: dedupe,
            event_type: event.eventType
          },
          { onConflict: "source_id,dedupe_key" }
        )
        .select("id")
        .single();

      if (sourceEventError || !sourceEvent?.id) {
        throw new Error(sourceEventError?.message || "Failed writing source event");
      }

      const classification = connector.classify(event);
      await upsertOpportunityFromEvent({
        supabase,
        tenantId,
        sourceEventId: String(sourceEvent.id),
        event,
        classification
      });
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
            normalizedEvents.length > 0 ? Math.round(totalReliability / normalizedEvents.length) : 0
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
        records_created: createdCount
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
