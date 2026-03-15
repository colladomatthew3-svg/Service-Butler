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

function severityWeight(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "extreme") return 95;
  if (normalized === "severe") return 82;
  if (normalized === "moderate") return 65;
  return 48;
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

  async normalize(records: Record<string, unknown>[]) {
    const normalized: ConnectorNormalizedEvent[] = [];

    for (const record of records) {
      const alert = record as unknown as NwsAlert;
      const props = alert.properties || {};
      const title = props.headline || props.event || "NOAA alert";
      const eventType = String(props.event || "weather_alert").toLowerCase().replace(/\s+/g, "_");
      const occurredAt = props.sent || new Date().toISOString();
      const severity = severityWeight(String(props.severity || "moderate"));
      const urgencyWord = String(props.urgency || "future").toLowerCase();

      normalized.push({
        occurredAt,
        dedupeKey: `${alert.id || title}|${occurredAt}`,
        eventType,
        title,
        description: props.description,
        locationText: props.areaDesc,
        serviceLine: eventType.includes("flood") || eventType.includes("wind") ? "restoration" : "general",
        severity,
        sourceReliability: 86,
        supportingSignalsCount: 1,
        catastropheSignal: urgencyWord.includes("immediate") ? 90 : 60,
        rawPayload: record,
        normalizedPayload: {
          alert_id: alert.id,
          event: props.event,
          area_desc: props.areaDesc,
          severity: props.severity,
          urgency: props.urgency
        }
      });
    }

    return normalized;
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const eventType = event.eventType.toLowerCase();
    if (eventType.includes("flood") || eventType.includes("storm") || eventType.includes("wind")) {
      return { opportunityType: "storm_restoration", serviceLine: "restoration" };
    }
    if (eventType.includes("freeze")) {
      return { opportunityType: "freeze_pipe_risk", serviceLine: "plumbing" };
    }
    return { opportunityType: "weather_risk", serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(): ConnectorCompliancePolicy {
    return {
      termsStatus: "approved",
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
