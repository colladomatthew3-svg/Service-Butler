import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

const CONNECTOR_VERSION = "v2.1.0";

type OverpassElement = {
  id?: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

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

function sourceTermsStatus(input: ConnectorPullInput) {
  const status = String(input.config.terms_status || "approved").toLowerCase();
  if (status === "blocked") return "blocked" as const;
  if (status === "restricted") return "restricted" as const;
  if (status === "pending_review") return "pending_review" as const;
  return "approved" as const;
}

function classifyTags(tags: Record<string, string>) {
  const haystack = Object.values(tags).join(" ").toLowerCase();
  if (haystack.includes("hospital") || haystack.includes("hotel") || haystack.includes("warehouse")) {
    return { category: "commercial_property_signal", serviceLines: ["commercial", "restoration"], likelyJobType: "commercial restoration event", severity: 72 };
  }
  if (haystack.includes("apartments") || haystack.includes("residential")) {
    return { category: "property_risk_signal", serviceLines: ["restoration", "plumbing", "hvac"], likelyJobType: "property risk inspection", severity: 60 };
  }
  return { category: "property_signal", serviceLines: ["general"], likelyJobType: "service dispatch", severity: 46 };
}

async function timeoutFetch(url: string, init: RequestInit, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": "ServiceButler-Overpass-Connector/1.0",
        ...(init.headers || {})
      },
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export const overpassConnector: ConnectorAdapter = {
  key: "property.overpass",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    const endpoint = String(input.config.endpoint || process.env.OVERPASS_ENDPOINT || "https://overpass-api.de/api/interpreter").trim();
    const query = String(input.config.query || process.env.OVERPASS_QUERY || "").trim();
    if (!endpoint || !query) return [];

    const response = await timeoutFetch(
      endpoint,
      {
        method: "POST",
        body: query,
        headers: { "content-type": "text/plain;charset=UTF-8" }
      },
      12_000
    ).catch(() => null);

    if (!response?.ok) return [];
    const payload = (await response.json().catch(() => ({}))) as { elements?: OverpassElement[] };
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    return elements.map((row) => row as unknown as Record<string, unknown>);
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const sourceName = String(input.config.source_name || "OpenStreetMap Overpass");
    const sourceProvenance = String(input.config.source_provenance || "overpass-api.de");

    return records.map((record, index): ConnectorNormalizedEvent => {
      const element = record as unknown as OverpassElement;
      const tags = element.tags || {};
      const classification = classifyTags(tags);
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      const name = tags.name || tags.amenity || tags.building || `Overpass element ${index + 1}`;
      const contactName = String(tags["contact:name"] || tags["operator"] || tags["brand"] || tags.name || "").trim();
      const contactPhone = String(tags["contact:phone"] || tags.phone || "").trim();
      const contactEmail = String(tags["contact:email"] || tags.email || "").trim();
      const contactWebsite = String(tags["contact:website"] || tags.website || "").trim();
      const occurredAt = toIso((record as Record<string, unknown>).updated_at || new Date().toISOString());

      return {
        occurredAt,
        dedupeKey: `${element.type || "element"}|${element.id || index}|${name}`,
        eventType: "overpass_property_signal",
        eventCategory: classification.category,
        title: String(name),
        description: `OSM property signal (${classification.category})${contactWebsite ? ` · ${contactWebsite}` : ""}`,
        locationText: [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(" "),
        addressText: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
        city: String(tags["addr:city"] || ""),
        state: String(tags["addr:state"] || ""),
        postalCode: String(tags["addr:postcode"] || ""),
        latitude: lat != null ? toNumber(lat, NaN) : null,
        longitude: lon != null ? toNumber(lon, NaN) : null,
        serviceLine: classification.serviceLines[0] || "general",
        serviceLineCandidates: classification.serviceLines,
        severity: classification.severity,
        severityHint: classification.severity,
        urgencyHint: Math.max(35, Math.round(classification.severity * 0.8)),
        likelyJobType: classification.likelyJobType,
        estimatedResponseWindow: classification.severity >= 70 ? "4-24h" : "24-72h",
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber((record as Record<string, unknown>).source_reliability, 64),
        supportingSignalsCount: toNumber((record as Record<string, unknown>).supporting_signals_count, 1),
        catastropheSignal: 25,
        rawPayload: record,
        normalizedPayload: {
          element_id: element.id || null,
          element_type: element.type || null,
          tags,
          contact_name: contactName || null,
          contact_phone: contactPhone || null,
          contact_email: contactEmail || null,
          contact_website: contactWebsite || null,
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
    if (category === "commercial_property_signal") {
      return { opportunityType: "commercial_property_signal", serviceLine: "commercial" };
    }
    return { opportunityType: "property_signal", serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const termsStatus = sourceTermsStatus(input);
    const approved = termsStatus === "approved";
    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: approved,
      requiresLegalReview: !approved,
      notes: approved ? "Overpass source approved for ingestion" : "Overpass source blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const hasSample = Array.isArray(input.config.sample_records);
    if (hasSample) return { ok: false, detail: "sample_records configured; source is simulated until a live Overpass query is configured" };

    const endpoint = String(input.config.endpoint || process.env.OVERPASS_ENDPOINT || "").trim();
    const query = String(input.config.query || process.env.OVERPASS_QUERY || "").trim();
    if (!endpoint || !query) return { ok: false, detail: "OVERPASS endpoint/query missing" };
    return { ok: true, detail: "Overpass endpoint + query configured" };
  }
};
