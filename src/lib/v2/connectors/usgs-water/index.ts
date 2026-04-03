import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

const CONNECTOR_VERSION = "v2.1.0";

type UsgsSeries = {
  sourceInfo?: {
    siteName?: string;
    siteCode?: Array<{ value?: string }>;
  };
  variable?: {
    variableName?: string;
  };
  values?: Array<{
    value?: Array<{
      value?: string;
      dateTime?: string;
    }>;
  }>;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function floodSeverity(cfs: number) {
  if (cfs >= 30_000) return 92;
  if (cfs >= 15_000) return 82;
  if (cfs >= 8_000) return 72;
  if (cfs >= 3_500) return 60;
  return 44;
}

function classifyFlowCategory(cfs: number) {
  if (cfs >= 15_000) return "flood_indicator";
  if (cfs >= 6_000) return "high_water_indicator";
  return "water_level_monitor";
}

function sourceTermsStatus(input: ConnectorPullInput) {
  const status = String(input.config.terms_status || "approved").toLowerCase();
  if (status === "blocked") return "blocked" as const;
  if (status === "restricted") return "restricted" as const;
  if (status === "pending_review") return "pending_review" as const;
  return "approved" as const;
}

async function timeoutFetch(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ServiceButler-USGS-Connector/1.0"
      },
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function flattenUsgsPayload(payload: Record<string, unknown>) {
  const outer = payload.value as { timeSeries?: UsgsSeries[] } | undefined;
  const series = Array.isArray(outer?.timeSeries) ? outer.timeSeries : [];

  const rows: Record<string, unknown>[] = [];
  for (const entry of series) {
    const siteName = String(entry.sourceInfo?.siteName || "USGS site");
    const siteCode = String(entry.sourceInfo?.siteCode?.[0]?.value || "");
    const variableName = String(entry.variable?.variableName || "streamflow");
    const measurements = Array.isArray(entry.values?.[0]?.value) ? entry.values?.[0]?.value : [];
    const latest = measurements[measurements.length - 1];
    if (!latest) continue;

    rows.push({
      site_name: siteName,
      site_code: siteCode,
      variable_name: variableName,
      value: latest.value,
      observed_at: latest.dateTime
    });
  }

  return rows;
}

export const usgsWaterConnector: ConnectorAdapter = {
  key: "water.usgs",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    const endpoint = String(input.config.endpoint || process.env.USGS_WATER_ENDPOINT || "").trim();
    if (endpoint) {
      const response = await timeoutFetch(endpoint).catch(() => null);
      if (!response?.ok) return [];
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (Array.isArray(payload.records)) return payload.records as Record<string, unknown>[];
      return flattenUsgsPayload(payload);
    }

    const siteCodes = String(input.config.site_codes || process.env.USGS_SITE_CODES || "").trim();
    if (!siteCodes) return [];

    const url =
      `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${encodeURIComponent(siteCodes)}` +
      "&parameterCd=00060,00065&siteStatus=all";

    const response = await timeoutFetch(url).catch(() => null);
    if (!response?.ok) return [];
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return flattenUsgsPayload(payload);
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const sourceName = String(input.config.source_name || "USGS Water Data");
    const sourceProvenance = String(input.config.source_provenance || "api.waterdata.usgs.gov");

    return records.map((record): ConnectorNormalizedEvent => {
      const streamflowCfs = toNumber(record.value, 0);
      const category = classifyFlowCategory(streamflowCfs);
      const severity = floodSeverity(streamflowCfs);
      const occurredAt = toIso(record.observed_at || record.occurred_at || record.created_at);
      const title = String(record.title || `${record.site_name || "USGS site"} ${category.replace(/_/g, " ")}`);

      return {
        occurredAt,
        dedupeKey: `${record.site_code || record.id || title}|${occurredAt}|${category}`,
        eventType: "usgs_water_indicator",
        eventCategory: category,
        title,
        description: `USGS water indicator ${streamflowCfs} cfs (${record.variable_name || "streamflow"})`,
        locationText: String(record.location_text || record.site_name || ""),
        addressText: String(record.address_text || ""),
        city: String(record.city || ""),
        state: String(record.state || ""),
        postalCode: String(record.postal_code || record.zip || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine: "restoration",
        serviceLineCandidates: ["restoration", "plumbing"],
        severity,
        severityHint: severity,
        urgencyHint: severity,
        likelyJobType: category === "flood_indicator" ? "water mitigation" : "flood risk inspection",
        estimatedResponseWindow: severity >= 75 ? "0-4h" : "4-24h",
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 82),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: severity,
        rawPayload: record,
        normalizedPayload: {
          streamflow_cfs: streamflowCfs,
          site_name: record.site_name || null,
          site_code: record.site_code || null,
          variable_name: record.variable_name || "streamflow",
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
    if (category === "flood_indicator" || category === "high_water_indicator") {
      return { opportunityType: "flood_risk_signal", serviceLine: "restoration" };
    }
    return { opportunityType: "water_monitor_signal", serviceLine: "restoration" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const termsStatus = sourceTermsStatus(input);
    const approved = termsStatus === "approved";
    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: approved,
      requiresLegalReview: !approved,
      notes: approved ? "USGS open water data approved" : "USGS connector blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) return { ok: false, detail: "sample_records configured; source is simulated until a live USGS endpoint or site code is configured" };

    const endpoint = String(input.config.endpoint || process.env.USGS_WATER_ENDPOINT || "").trim();
    const siteCodes = String(input.config.site_codes || process.env.USGS_SITE_CODES || "").trim();
    if (!endpoint && !siteCodes) {
      return { ok: false, detail: "Provide endpoint or site_codes for USGS connector" };
    }
    return { ok: true, detail: endpoint ? "custom endpoint configured" : "site_codes configured" };
  }
};
