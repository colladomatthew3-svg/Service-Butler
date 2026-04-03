export type ProofAuthenticity = "live_provider" | "live_derived" | "synthetic" | "unknown";

type ProofAuthenticityInput = {
  sourceType?: unknown;
  sourceName?: unknown;
  sourceProvenance?: unknown;
  normalizedPayload?: Record<string, unknown> | null;
  connectorRunMetadata?: Record<string, unknown> | null;
};

const SYNTHETIC_PATTERNS = [/synthetic/i, /simulated/i, /\bdemo\b/i, /placeholder/i, /operator\.synthetic/i];
const LIVE_PROVIDER_PATTERNS = [
  /api\.weather\.gov/i,
  /fema\.gov\/api\/open/i,
  /waterservices\.usgs\.gov/i,
  /api\.census\.gov/i,
  /geocoding\.geo\.census\.gov/i,
  /overpass-api/i,
  /data\.cityofnewyork\.us/i,
  /socrata/i,
  /\bopen311\b/i
];
const LIVE_DERIVED_PATTERNS = [/open-meteo/i, /forecast model/i, /forecast \+/i, /cluster/i];
const LIVE_PROVIDER_KEYS = new Set(["weather.noaa", "water.usgs", "open311.generic", "disaster.openfema", "enrichment.census", "property.overpass"]);

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function matchesAny(patterns: RegExp[], values: string[]) {
  return values.some((value) => patterns.some((pattern) => pattern.test(value)));
}

export function classifyProofAuthenticity(input: ProofAuthenticityInput): ProofAuthenticity {
  const normalized = input.normalizedPayload || {};
  const metadata = input.connectorRunMetadata || {};
  const connectorInputMode = asText(metadata.connector_input_mode).toLowerCase();
  const connectorKey = asText(
    normalized.connector_key ||
      normalized.platform ||
      normalized.source_type ||
      input.sourceType
  ).toLowerCase();
  const values = [
    asText(input.sourceType),
    asText(input.sourceName),
    asText(input.sourceProvenance),
    asText(normalized.source_provenance),
    asText(normalized.provider),
    asText(normalized.connector_name),
    asText(normalized.connector_key),
    asText(normalized.platform)
  ].filter(Boolean);
  const sourceType = asText(input.sourceType || normalized.source_type).toLowerCase();
  const sourceProvenance = asText(input.sourceProvenance || normalized.source_provenance);
  const isPublicWebPage =
    /^https?:\/\//i.test(sourceProvenance) &&
    !/localhost|127\.0\.0\.1|example\.com|example\.org|example\.net/i.test(sourceProvenance) &&
    (sourceType.includes("incident") || sourceType.includes("social") || sourceType.includes("review") || sourceType.includes("distress"));

  if (connectorInputMode === "live_provider") return "live_provider";
  if (connectorInputMode === "synthetic" || connectorInputMode === "synthetic_fallback") return "synthetic";

  if (matchesAny(SYNTHETIC_PATTERNS, values)) return "synthetic";
  if (isPublicWebPage) return "live_provider";
  if (LIVE_PROVIDER_KEYS.has(connectorKey)) return "live_provider";
  if (matchesAny(LIVE_PROVIDER_PATTERNS, values)) return "live_provider";
  if (matchesAny(LIVE_DERIVED_PATTERNS, values)) return "live_derived";
  if (connectorKey.includes("forecast") || connectorKey.includes("scanner_signal")) return "live_derived";

  return "unknown";
}

export function isProofAuthentic(authenticity: ProofAuthenticity) {
  return authenticity === "live_provider";
}
