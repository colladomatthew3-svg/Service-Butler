export type SourceLaneKey = "311" | "flood" | "fire" | "outage" | "weather" | "mold_biohazard" | "permits" | "property" | "social" | "other";

function normalizeValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function collectText(values: Array<unknown>) {
  return values
    .map((value) => normalizeValue(value))
    .filter(Boolean)
    .join(" ");
}

export function classifySourceLane(input: {
  sourceTypes?: unknown[];
  sourceProvenance?: unknown;
  sourceType?: unknown;
  category?: unknown;
  serviceLine?: unknown;
  summary?: unknown;
  reasoning?: unknown;
}) {
  const haystack = collectText([
    ...(Array.isArray(input.sourceTypes) ? input.sourceTypes : []),
    input.sourceProvenance,
    input.sourceType,
    input.category,
    input.serviceLine,
    input.summary,
    input.reasoning
  ]);

  if (
    haystack.includes("open311") ||
    haystack.includes(" 311") ||
    haystack.startsWith("311 ") ||
    haystack.includes("data.cityofnewyork.us")
  ) {
    return "311";
  }

  if (
    haystack.includes("usgs") ||
    haystack.includes("openfema") ||
    haystack.includes("flood") ||
    haystack.includes("water") ||
    haystack.includes("basement flooding")
  ) {
    return "flood";
  }

  if (
    haystack.includes("mold") ||
    haystack.includes("biohazard") ||
    haystack.includes("hazmat") ||
    haystack.includes("sewage") ||
    haystack.includes("sewer") ||
    haystack.includes("contamination")
  ) {
    return "mold_biohazard";
  }

  if (haystack.includes("outage") || haystack.includes("utility") || haystack.includes("infrastructure")) {
    return "outage";
  }

  if (haystack.includes("fire") || haystack.includes("smoke") || haystack.includes("emergency")) {
    return "fire";
  }

  if (haystack.includes("weather") || haystack.includes("storm") || haystack.includes("hail") || haystack.includes("wind") || haystack.includes("freeze")) {
    return "weather";
  }

  if (haystack.includes("permit")) return "permits";
  if (haystack.includes("overpass") || haystack.includes("property") || haystack.includes("census")) return "property";
  if (haystack.includes("social") || haystack.includes("reddit") || haystack.includes("review") || haystack.includes("distress")) return "social";
  return "other";
}

export function opportunityPriorityScore(input: {
  urgencyScore?: unknown;
  jobLikelihoodScore?: unknown;
  sourceReliabilityScore?: unknown;
}) {
  const urgency = Math.max(0, Math.min(100, Number(input.urgencyScore || 0)));
  const jobLikelihood = Math.max(0, Math.min(100, Number(input.jobLikelihoodScore || 0)));
  const reliability = Math.max(0, Math.min(100, Number(input.sourceReliabilityScore || 0)));

  return Math.round(urgency * 0.45 + jobLikelihood * 0.4 + reliability * 0.15);
}
