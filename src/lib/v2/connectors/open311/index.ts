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

function classifyRequest(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("flood") || lower.includes("water") || lower.includes("basement")) {
    return { category: "water_incident", serviceLines: ["restoration", "plumbing"], likelyJobType: "water mitigation", urgency: 82 };
  }
  if (lower.includes("fire") || lower.includes("smoke")) {
    return { category: "fire_incident", serviceLines: ["restoration"], likelyJobType: "fire restoration", urgency: 86 };
  }
  if (lower.includes("sewer") || lower.includes("drain") || lower.includes("pipe") || lower.includes("leak")) {
    return { category: "infrastructure_failure", serviceLines: ["plumbing", "restoration"], likelyJobType: "emergency plumbing", urgency: 78 };
  }
  if (lower.includes("outage") || lower.includes("power")) {
    return { category: "infrastructure_failure", serviceLines: ["electrical", "general"], likelyJobType: "infrastructure emergency dispatch", urgency: 72 };
  }
  return { category: "service_request", serviceLines: ["general"], likelyJobType: "service dispatch", urgency: 48 };
}

async function timeoutFetch(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ServiceButler-Open311-Connector/1.0"
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

export const open311Connector: ConnectorAdapter = {
  key: "open311.generic",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    const endpoint = String(
      input.config.endpoint || process.env.OPEN311_ENDPOINT || "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100"
    ).trim();
    if (!endpoint) return [];

    const response = await timeoutFetch(endpoint).catch(() => null);
    if (!response?.ok) return [];
    const payload = (await response.json().catch(() => [])) as unknown;
    if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));

    const wrapped = payload as { results?: unknown[]; records?: unknown[] };
    const rows = Array.isArray(wrapped.results) ? wrapped.results : Array.isArray(wrapped.records) ? wrapped.records : [];
    return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const sourceName = String(input.config.source_name || "Open311 Requests");
    const sourceProvenance = String(input.config.source_provenance || input.config.endpoint || "open311");

    return records.map((record, index): ConnectorNormalizedEvent => {
      const requestText = `${record.service_name || record.complaint_type || ""} ${record.descriptor || ""} ${record.description || ""} ${record.status_notes || ""}`;
      const classification = classifyRequest(requestText);
      const occurredAt = toIso(record.requested_datetime || record.updated_datetime || record.created_at);
      const title = String(record.title || record.service_name || record.complaint_type || `Open311 request ${index + 1}`);
      const city = String(record.city || record.borough || "");
      const state = String(record.state || "NY");
      const postalCode = String(record.postal_code || record.zip || record.incident_zip || "");
      const address = String(record.address || record.incident_address || record.location || "");
      const contactName = String(record.contact_name || record.requested_by || "").trim();
      const contactPhone = String(record.contact_phone || record.phone || "").trim();
      const contactEmail = String(record.contact_email || record.email || "").trim();

      return {
        occurredAt,
        dedupeKey: `${record.service_request_id || record.id || title}|${occurredAt}`,
        eventType: "open311_service_request",
        eventCategory: classification.category,
        title,
        description: String(record.description || ""),
        locationText: address,
        addressText: address,
        city,
        state,
        postalCode,
        latitude: record.lat != null ? toNumber(record.lat, NaN) : record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.long != null ? toNumber(record.long, NaN) : record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine: classification.serviceLines[0] || "general",
        serviceLineCandidates: classification.serviceLines,
        severity: classification.urgency,
        severityHint: classification.urgency,
        urgencyHint: classification.urgency,
        likelyJobType: classification.likelyJobType,
        estimatedResponseWindow: classification.urgency >= 80 ? "0-4h" : "4-24h",
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 69),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: classification.urgency >= 80 ? classification.urgency : 35,
        rawPayload: record,
        normalizedPayload: {
          service_request_id: record.service_request_id || record.id || null,
          service_name: record.service_name || record.complaint_type || null,
          descriptor: record.descriptor || null,
          contact_name: contactName || null,
          contact_phone: contactPhone || null,
          contact_email: contactEmail || null,
          status: record.status || null,
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
    const category = String(event.eventCategory || "");
    if (category === "fire_incident") return { opportunityType: "fire_damage_incident", serviceLine: "restoration" };
    if (category === "water_incident") return { opportunityType: "flood_incident", serviceLine: "restoration" };
    if (category === "infrastructure_failure") return { opportunityType: "infrastructure_incident", serviceLine: "plumbing" };
    return { opportunityType: "service_request_signal", serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const termsStatus = sourceTermsStatus(input);
    const approved = termsStatus === "approved";
    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: approved,
      requiresLegalReview: !approved,
      notes: approved ? "Open311 source approved for ingestion" : "Open311 source blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const hasSample = Array.isArray(input.config.sample_records);
    if (hasSample) return { ok: false, detail: "sample_records configured; source is simulated until a live Open311 endpoint is configured" };

    const endpoint = String(
      input.config.endpoint || process.env.OPEN311_ENDPOINT || "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=1"
    ).trim();
    if (!endpoint) return { ok: false, detail: "OPEN311 endpoint missing" };
    return { ok: true, detail: "Open311 endpoint configured" };
  }
};
