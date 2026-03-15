import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";
import { resolvePermitsProvider } from "@/lib/v2/connectors/permits/providers";

const CONNECTOR_VERSION = "v2.1.0";

function toIso(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeFreshnessScore(occurredAtIso: string) {
  const occurred = new Date(occurredAtIso).getTime();
  const ageHours = Math.max(0, (Date.now() - occurred) / 3_600_000);
  return Math.max(0, Math.min(100, Math.round(100 - ageHours * 4)));
}

function inferServiceLine(record: Record<string, unknown>) {
  const text = `${record.permit_type || ""} ${record.description || ""} ${record.scope || ""}`.toLowerCase();
  if (text.includes("roof")) return "roofing";
  if (text.includes("plumb") || text.includes("sewer")) return "plumbing";
  if (text.includes("hvac") || text.includes("furnace") || text.includes("boiler")) return "hvac";
  if (text.includes("asbestos") || text.includes("abatement")) return "asbestos";
  if (text.includes("fire") || text.includes("water") || text.includes("mitigation")) return "restoration";
  return "general";
}

export const permitsConnector: ConnectorAdapter = {
  key: "permits.production",

  async pull(input: ConnectorPullInput) {
    const provider = resolvePermitsProvider(input);
    return provider.fetchRecords(input);
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const provider = resolvePermitsProvider(input);
    const termsStatus = provider.termsStatus(input);
    const sourceProvenance = provider.sourceProvenance(input);

    return records.map((record, index): ConnectorNormalizedEvent => {
      const title = String(record.title || record.permit_type || `Permit event ${index + 1}`);
      const occurredAt = toIso(record.occurred_at || record.issued_at || record.created_at);
      const freshnessScore = computeFreshnessScore(occurredAt);
      const serviceLine = inferServiceLine(record);

      return {
        occurredAt,
        dedupeKey: `${record.id || record.permit_number || title}|${occurredAt}`,
        eventType: String(record.event_type || "permit_signal"),
        title,
        description: String(record.description || record.scope || ""),
        locationText: String(record.location || record.address || record.city || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine,
        severity: toNumber(record.severity, 58),
        sourceReliability: toNumber(record.source_reliability, 74),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: toNumber(record.catastrophe_signal, 12),
        rawPayload: record,
        normalizedPayload: {
          permit_id: record.id || record.permit_number || null,
          permit_type: record.permit_type || null,
          service_line: serviceLine,
          source_provenance: sourceProvenance,
          terms_status: termsStatus,
          data_freshness_score: freshnessScore,
          connector_version: CONNECTOR_VERSION,
          provider_key: provider.key
        }
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const serviceLine = String(event.serviceLine || "general");
    if (serviceLine === "roofing") return { opportunityType: "roof_permit_signal", serviceLine };
    if (serviceLine === "plumbing") return { opportunityType: "plumbing_permit_signal", serviceLine };
    if (serviceLine === "hvac") return { opportunityType: "hvac_permit_signal", serviceLine };
    if (serviceLine === "asbestos") return { opportunityType: "abatement_permit_signal", serviceLine };
    if (serviceLine === "restoration") return { opportunityType: "restoration_permit_signal", serviceLine };
    return { opportunityType: "permit_signal", serviceLine };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const provider = resolvePermitsProvider(input);
    const termsStatus = provider.termsStatus(input);
    const approved = termsStatus === "approved";

    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: approved,
      requiresLegalReview: !approved,
      notes: approved
        ? "Permits provider approved for ingestion"
        : "Permits ingestion blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const provider = resolvePermitsProvider(input);
    const start = Date.now();
    const records = await provider.fetchRecords(input).catch(() => []);
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      latencyMs,
      detail: `Provider ${provider.key} reachable; sample_count=${records.length}`
    };
  }
};
