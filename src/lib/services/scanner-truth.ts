function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export function isSyntheticScannerRecord(input: {
  source?: unknown;
  raw?: unknown;
}) {
  const raw = asRecord(input.raw);
  const source = asText(input.source).toLowerCase();
  const proofAuthenticity = asText(raw.proof_authenticity).toLowerCase();
  const connectorInputMode = asText(raw.connector_input_mode).toLowerCase();
  const sourceType = asText(raw.source_type).toLowerCase();
  const provenance = asText(raw.source_provenance).toLowerCase();

  if (source === "demo") return true;
  if (proofAuthenticity === "synthetic") return true;
  if (connectorInputMode === "synthetic" || connectorInputMode === "synthetic_fallback") return true;
  if (sourceType.includes("demo") || sourceType.includes("synthetic")) return true;
  if (provenance.includes("operator.synthetic") || provenance.includes("placeholder")) return true;

  return false;
}
