import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

const CONNECTOR_VERSION = "v2.1.0";

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

function sourceTermsStatus(input: ConnectorPullInput) {
  const status = String(input.config.terms_status || "approved").toLowerCase();
  if (status === "blocked") return "blocked" as const;
  if (status === "restricted") return "restricted" as const;
  if (status === "pending_review") return "pending_review" as const;
  return "approved" as const;
}

function classifyMarketRisk(record: Record<string, unknown>) {
  const explicitOlderHousing = toNumber(record.older_housing_ratio, NaN);
  const explicitRenterRate = toNumber(record.renter_rate, NaN);
  const explicitVacancyRate = toNumber(record.vacancy_rate, NaN);

  const olderUnits = toNumber(record.B25034_010E, 0) + toNumber(record.B25034_011E, 0);
  const renterHouseholds = toNumber(record.B25003_003E, 0);
  const vacantUnits = toNumber(record.B25004_001E, 0);

  const olderHousingRatio = Number.isFinite(explicitOlderHousing) ? explicitOlderHousing : Math.max(0, Math.min(100, Math.round((olderUnits / 50_000) * 100)));
  const renterRate = Number.isFinite(explicitRenterRate) ? explicitRenterRate : Math.max(0, Math.min(100, Math.round((renterHouseholds / 120_000) * 100)));
  const vacancyRate = Number.isFinite(explicitVacancyRate) ? explicitVacancyRate : Math.max(0, Math.min(100, Math.round((vacantUnits / 45_000) * 100)));
  const severeWeatherExposure = toNumber(record.severe_weather_exposure, 0);

  const composite =
    Math.round(
      Math.max(
        0,
        Math.min(100, olderHousingRatio * 0.35 + renterRate * 0.2 + vacancyRate * 0.1 + severeWeatherExposure * 0.35)
      )
    ) || 40;

  const serviceLineCandidates = ["restoration", "plumbing", "hvac"];

  return {
    riskScore: composite,
    serviceLineCandidates,
    likelyJobType: composite >= 70 ? "preventive restoration inspection" : "maintenance campaign opportunity",
    window: composite >= 70 ? "4-24h" : "24-72h"
  };
}

async function timeoutFetch(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ServiceButler-Census-Connector/1.0"
      },
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function rowsFromCensusArray(payload: unknown) {
  if (!Array.isArray(payload) || payload.length < 2) return [] as Record<string, unknown>[];
  const [headerRow, ...rows] = payload;
  if (!Array.isArray(headerRow)) return [] as Record<string, unknown>[];
  const headers = headerRow.map((v) => String(v));
  return rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => {
      const mapped: Record<string, unknown> = {};
      headers.forEach((key, idx) => {
        mapped[key] = row[idx];
      });
      return mapped;
    });
}

export const censusConnector: ConnectorAdapter = {
  key: "enrichment.census",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    const stateCode = String(input.config.state_code || process.env.CENSUS_API_STATE || "36").trim();
    const apiKey = String(input.config.api_key || process.env.CENSUS_API_KEY || "").trim();
    const defaultEndpoint =
      "https://api.census.gov/data/2023/acs/acs5" +
      `?get=NAME,B25034_010E,B25034_011E,B25003_003E,B25004_001E&for=county:*&in=state:${encodeURIComponent(stateCode)}` +
      (apiKey ? `&key=${encodeURIComponent(apiKey)}` : "");

    const endpoint = String(input.config.endpoint || process.env.CENSUS_API_ENDPOINT || defaultEndpoint).trim();
    if (!endpoint) return [];

    const response = await timeoutFetch(endpoint).catch(() => null);
    if (!response?.ok) return [];
    const payload = (await response.json().catch(() => [])) as unknown;

    if (Array.isArray(payload)) return rowsFromCensusArray(payload);
    if (payload && typeof payload === "object") {
      const wrapper = payload as Record<string, unknown>;
      const rows = Array.isArray(wrapper.results) ? wrapper.results : Array.isArray(wrapper.records) ? wrapper.records : [];
      return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }
    return [];
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const sourceName = String(input.config.source_name || "US Census Enrichment");
    const sourceProvenance = String(input.config.source_provenance || "api.census.gov");

    return records.map((record, index): ConnectorNormalizedEvent => {
      const classification = classifyMarketRisk(record);
      const occurredAt = toIso(record.observed_at || record.reference_date || record.created_at);
      const label = String(record.area_name || record.NAME || record.zip || `Census area ${index + 1}`);

      return {
        occurredAt,
        dedupeKey: `${record.geoid || record.GEO_ID || label}|${occurredAt}`,
        eventType: "census_enrichment_signal",
        eventCategory: "market_risk_enrichment",
        title: `Census risk profile: ${label}`,
        description: `Composite market risk score ${classification.riskScore}`,
        locationText: String(record.location_text || label),
        addressText: String(record.address_text || ""),
        city: String(record.city || ""),
        state: String(record.state || ""),
        postalCode: String(record.zip || record.postal_code || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine: classification.serviceLineCandidates[0],
        serviceLineCandidates: classification.serviceLineCandidates,
        severity: classification.riskScore,
        severityHint: classification.riskScore,
        urgencyHint: Math.max(35, Math.round(classification.riskScore * 0.75)),
        likelyJobType: classification.likelyJobType,
        estimatedResponseWindow: classification.window,
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 73),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: toNumber(record.catastrophe_signal, Math.round(classification.riskScore * 0.55)),
        rawPayload: record,
        normalizedPayload: {
          area_name: label,
          geoid: record.geoid || record.GEO_ID || null,
          risk_score: classification.riskScore,
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
    return {
      opportunityType: "market_risk_signal",
      serviceLine: event.serviceLine || "general"
    };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const termsStatus = sourceTermsStatus(input);
    const approved = termsStatus === "approved";
    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: false,
      requiresLegalReview: !approved,
      notes: approved ? "Census enrichment approved for ingestion" : "Census source blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const hasSample = Array.isArray(input.config.sample_records);
    if (hasSample) return { ok: false, detail: "sample_records configured; source is simulated until a live Census endpoint is configured" };

    const stateCode = String(input.config.state_code || process.env.CENSUS_API_STATE || "36").trim();
    const apiKey = String(input.config.api_key || process.env.CENSUS_API_KEY || "").trim();
    const fallbackEndpoint =
      "https://api.census.gov/data/2023/acs/acs5" +
      `?get=NAME,B25034_010E,B25034_011E,B25003_003E,B25004_001E&for=county:*&in=state:${encodeURIComponent(stateCode)}` +
      (apiKey ? `&key=${encodeURIComponent(apiKey)}` : "");
    const endpoint = String(input.config.endpoint || process.env.CENSUS_API_ENDPOINT || fallbackEndpoint).trim();
    if (!endpoint) return { ok: false, detail: "CENSUS API endpoint missing" };
    return { ok: true, detail: "Census endpoint configured" };
  }
};
