import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

const CONNECTOR_VERSION = "v2.1.0";

function toIso(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function classifyIncidentType(value: string) {
  const text = value.toLowerCase();
  if (text.includes("flood") || text.includes("coastal storm")) return { category: "flood_incident", serviceLines: ["restoration", "plumbing"], catastrophe: 88 };
  if (text.includes("hurricane") || text.includes("tornado") || text.includes("severe storm")) {
    return { category: "storm_incident", serviceLines: ["restoration", "roofing"], catastrophe: 85 };
  }
  if (text.includes("fire")) return { category: "fire_incident", serviceLines: ["restoration"], catastrophe: 86 };
  if (text.includes("winter") || text.includes("freeze")) return { category: "freeze_incident", serviceLines: ["plumbing", "hvac"], catastrophe: 78 };
  return { category: "disaster_incident", serviceLines: ["restoration"], catastrophe: 68 };
}

async function timeoutFetch(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ServiceButler-OpenFEMA-Connector/1.0"
      },
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function sourceTermsStatus(input: ConnectorPullInput) {
  const status = String(input.config.terms_status || "approved").toLowerCase();
  if (status === "blocked") return "blocked" as const;
  if (status === "restricted") return "restricted" as const;
  if (status === "pending_review") return "pending_review" as const;
  return "approved" as const;
}

export const openFemaConnector: ConnectorAdapter = {
  key: "disaster.openfema",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    const endpoint = String(
      input.config.endpoint ||
        process.env.OPENFEMA_API_URL ||
        "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=100&$orderby=declarationDate desc"
    ).trim();

    if (!endpoint) return [];

    const response = await timeoutFetch(endpoint).catch(() => null);
    if (!response?.ok) return [];
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    const nested = payload.DisasterDeclarationsSummaries;
    if (Array.isArray(nested)) {
      return nested.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }
    if (Array.isArray(payload.results)) return payload.results as Record<string, unknown>[];
    return [];
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const sourceName = String(input.config.source_name || "OpenFEMA Disaster Declarations");
    const sourceProvenance = String(input.config.source_provenance || "fema.gov/api/open");

    return records.map((record): ConnectorNormalizedEvent => {
      const incidentType = String(record.incidentType || record.incident_type || "disaster");
      const classification = classifyIncidentType(incidentType);
      const occurredAt = toIso(record.declarationDate || record.incidentBeginDate || record.created_at);
      const title = String(record.title || `${incidentType} declaration`);

      return {
        occurredAt,
        dedupeKey: `${record.disasterNumber || record.id || title}|${occurredAt}`,
        eventType: "openfema_disaster_declaration",
        eventCategory: classification.category,
        title,
        description: String(record.declarationTitle || record.declarationType || incidentType),
        locationText: `${record.designatedArea || ""}${record.state ? `, ${record.state}` : ""}`.trim(),
        addressText: String(record.designatedArea || ""),
        city: String(record.city || ""),
        state: String(record.state || ""),
        postalCode: String(record.postal_code || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine: classification.serviceLines[0] || "restoration",
        serviceLineCandidates: classification.serviceLines,
        severity: classification.catastrophe,
        severityHint: classification.catastrophe,
        urgencyHint: classification.catastrophe,
        likelyJobType:
          classification.category === "fire_incident"
            ? "fire restoration"
            : classification.category === "flood_incident"
              ? "water mitigation"
              : "storm restoration",
        estimatedResponseWindow: classification.catastrophe >= 80 ? "0-4h" : "4-24h",
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 78),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: classification.catastrophe,
        rawPayload: record,
        normalizedPayload: {
          incident_type: incidentType,
          disaster_number: record.disasterNumber || null,
          declaration_type: record.declarationType || null,
          source_provenance: sourceProvenance,
          connector_version: CONNECTOR_VERSION
        }
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const category = String(event.eventCategory || "disaster_incident");
    if (category === "flood_incident") return { opportunityType: "storm_restoration", serviceLine: "restoration" };
    if (category === "fire_incident") return { opportunityType: "fire_damage_incident", serviceLine: "restoration" };
    if (category === "freeze_incident") return { opportunityType: "freeze_pipe_risk", serviceLine: "plumbing" };
    return { opportunityType: "catastrophe_signal", serviceLine: event.serviceLine || "restoration" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const termsStatus = sourceTermsStatus(input);
    const approved = termsStatus === "approved";
    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: approved,
      requiresLegalReview: !approved,
      notes: approved ? "OpenFEMA source approved for ingestion" : "OpenFEMA source blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const hasSample = Array.isArray(input.config.sample_records);
    if (hasSample) return { ok: true, detail: "sample_records configured" };

    const endpoint = String(
      input.config.endpoint ||
        process.env.OPENFEMA_API_URL ||
        "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=1"
    ).trim();

    if (!endpoint) return { ok: false, detail: "OpenFEMA endpoint missing" };
    return { ok: true, detail: "OpenFEMA endpoint configured" };
  }
};
