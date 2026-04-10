import { isIntegrationValidationRecord } from "@/lib/v2/source-truth";

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
  if (isIntegrationValidationRecord(raw)) return true;
  if (proofAuthenticity === "synthetic") return true;
  if (connectorInputMode === "synthetic" || connectorInputMode === "synthetic_fallback") return true;
  if (sourceType.includes("demo") || sourceType.includes("synthetic")) return true;
  if (provenance.includes("operator.synthetic") || provenance.includes("placeholder")) return true;

  return false;
}

export function countsAsRealScannerCapture(input: {
  source?: unknown;
  raw?: unknown;
}) {
  const raw = asRecord(input.raw);
  const proofAuthenticity = asText(raw.proof_authenticity).toLowerCase();
  const complianceStatus = asText(raw.compliance_status || raw.latest_event_compliance_status).toLowerCase();
  const connectorInputMode = asText(raw.connector_input_mode).toLowerCase();

  if (isSyntheticScannerRecord(input)) return false;
  if (complianceStatus && complianceStatus !== "approved") return false;
  if (connectorInputMode === "synthetic_fallback") return false;

  return proofAuthenticity === "live_provider" || proofAuthenticity === "live_derived";
}
