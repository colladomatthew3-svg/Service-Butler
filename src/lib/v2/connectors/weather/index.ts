import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

type NwsAlert = {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    description?: string;
    severity?: string;
    sent?: string;
    areaDesc?: string;
    urgency?: string;
  };
};

const CONNECTOR_VERSION = "v2.2.0";

function severityWeight(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "extreme") return 95;
  if (normalized === "severe") return 82;
  if (normalized === "moderate") return 65;
  return 48;
}

function urgencyWeight(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("immediate")) return 92;
  if (normalized.includes("expected")) return 75;
  if (normalized.includes("future")) return 58;
  return 52;
}

function timeoutFetch(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    signal: controller.signal,
    headers: { "user-agent": "ServiceButler-V2-Connector/1.0" },
    cache: "no-store"
  }).finally(() => clearTimeout(timer));
}

function inferWeatherCategory(event: string) {
  const text = event.toLowerCase();
  if (text.includes("hail")) return "hail";
  if (text.includes("wind") || text.includes("tornado")) return "wind";
  if (text.includes("freeze") || text.includes("ice") || text.includes("cold")) return "freeze";
  if (text.includes("flood") || text.includes("water")) return "flood";
  if (text.includes("storm") || text.includes("thunder")) return "storm";
  return "weather";
}

function categoryServiceLines(category: string) {
  if (category === "hail") return ["roofing", "restoration"];
  if (category === "wind") return ["roofing", "restoration"];
  if (category === "freeze") return ["plumbing", "hvac"];
  if (category === "flood") return ["restoration", "plumbing"];
  if (category === "storm") return ["restoration", "roofing"];
  return ["general"];
}

function likelyJobType(category: string) {
  if (category === "hail" || category === "wind") return "roof damage inspection";
  if (category === "freeze") return "emergency plumbing";
  if (category === "flood") return "water mitigation";
  if (category === "storm") return "storm restoration";
  return "weather risk inspection";
}

function eventTypeFromCategory(category: string) {
  if (category === "hail") return "weather_hail_alert";
  if (category === "wind") return "weather_wind_alert";
  if (category === "freeze") return "weather_freeze_alert";
  if (category === "flood") return "weather_flood_alert";
  if (category === "storm") return "weather_storm_alert";
  return "weather_alert";
}

export const weatherConnector: ConnectorAdapter = {
  key: "weather.noaa",

  async pull(input: ConnectorPullInput) {
    const lat = Number(input.config.latitude ?? input.config.lat);
    const lon = Number(input.config.longitude ?? input.config.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const res = await timeoutFetch(url).catch(() => null);
    if (!res?.ok) return [];

    const payload = (await res.json().catch(() => ({}))) as { features?: NwsAlert[] };
    return (payload.features || []) as unknown as Record<string, unknown>[];
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const normalized: ConnectorNormalizedEvent[] = [];

    const lat = Number(input.config.latitude ?? input.config.lat);
    const lon = Number(input.config.longitude ?? input.config.lon);
    const city = String(input.config.city || "");
    const state = String(input.config.state || "");
    const postalCode = String(input.config.postal_code || input.config.zip || "");
    const sourceName = String(input.config.connector_name || input.config.source_name || "NOAA Weather Alerts");

    for (const record of records) {
      const alert = record as unknown as NwsAlert;
      const props = alert.properties || {};
      const event = String(props.event || "weather alert");
      const category = inferWeatherCategory(event);
      const lines = categoryServiceLines(category);
      const severityHint = severityWeight(String(props.severity || "moderate"));
      const urgencyHint = urgencyWeight(String(props.urgency || "future"));
      const occurredAt = props.sent || new Date().toISOString();
      const title = props.headline || event || "NOAA alert";

      normalized.push({
        occurredAt,
        dedupeKey: `${alert.id || title}|${occurredAt}`,
        eventType: eventTypeFromCategory(category),
        eventCategory: category,
        title,
        description: props.description,
        locationText: props.areaDesc || `${city}${city && state ? ", " : ""}${state}`,
        addressText: String(props.areaDesc || ""),
        city,
        state,
        postalCode,
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lon) ? lon : null,
        serviceLine: lines[0] || "general",
        serviceLineCandidates: lines,
        severity: severityHint,
        severityHint,
        urgencyHint,
        likelyJobType: likelyJobType(category),
        estimatedResponseWindow: urgencyHint >= 80 ? "0-4h" : "4-24h",
        sourceName,
        sourceProvenance: "api.weather.gov",
        sourceReliability: 86,
        supportingSignalsCount: 1,
        catastropheSignal: category === "storm" || category === "flood" ? urgencyHint : Math.max(25, Math.round(urgencyHint * 0.7)),
        rawPayload: record,
        normalizedPayload: {
          alert_id: alert.id,
          event: props.event,
          weather_category: category,
          area_desc: props.areaDesc,
          severity: props.severity,
          urgency: props.urgency,
          source_provenance: "api.weather.gov",
          connector_version: CONNECTOR_VERSION
        }
      });
    }

    return normalized;
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const category = String(event.eventCategory || "weather");
    const serviceLine = event.serviceLineCandidates?.[0] || event.serviceLine || "general";

    if (category === "flood") return { opportunityType: "storm_restoration", serviceLine: "restoration" };
    if (category === "freeze") return { opportunityType: "freeze_pipe_risk", serviceLine: "plumbing" };
    if (category === "hail" || category === "wind") return { opportunityType: "roof_damage_risk", serviceLine: "roofing" };
    if (category === "storm") return { opportunityType: "storm_restoration", serviceLine: "restoration" };

    return { opportunityType: "weather_risk", serviceLine };
  },

  compliancePolicy(): ConnectorCompliancePolicy {
    return {
      termsStatus: "approved",
      ingestionAllowed: true,
      outboundAllowed: true,
      requiresLegalReview: false,
      notes: "NOAA public weather alerts"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const lat = Number(input.config.latitude ?? input.config.lat);
    const lon = Number(input.config.longitude ?? input.config.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, detail: "Missing latitude/longitude" };
    }

    const start = Date.now();
    const res = await timeoutFetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(2)},${lon.toFixed(2)}`, 7000).catch(() => null);
    const latencyMs = Date.now() - start;

    if (!res?.ok) return { ok: false, latencyMs, detail: "NOAA request failed" };
    return { ok: true, latencyMs };
  }
};
