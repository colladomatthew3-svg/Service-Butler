import type { ProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { isHealthyEnoughForTruth, isLiveRolloutState, isSourceFreshLiveSafe, isSourceLiveSafe } from "@/lib/v2/source-truth-gates";

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function lower(value: unknown) {
  return asText(value).toLowerCase();
}

export function isIntegrationValidationRecord(value: unknown) {
  const record = asRecord(value);
  return (
    lower(record.integration_validation) === "true" ||
    lower(record.validation_record) === "true" ||
    lower(record.opportunity_type) === "integration_validation" ||
    lower(record.signal_type) === "integration_validation" ||
    lower(record.assignment_reason) === "integration_validation"
  );
}

export function qualifiesAsRealSourceCapture(input: {
  authenticity: ProofAuthenticity | string;
  explainability?: Record<string, unknown> | null;
  source?: Record<string, unknown> | null;
  sourceEvent?: Record<string, unknown> | null;
  connectorRun?: Record<string, unknown> | null;
  nowMs?: number;
}) {
  const authenticity = lower(input.authenticity);
  const explainability = asRecord(input.explainability);
  const source = asRecord(input.source);
  const sourceEvent = asRecord(input.sourceEvent);
  const connectorRun = asRecord(input.connectorRun);
  const connectorMetadata = asRecord(connectorRun.metadata);

  if (authenticity !== "live_provider" && authenticity !== "live_derived") return false;
  if (isIntegrationValidationRecord(explainability)) return false;

  const connectorInputMode = lower(
    connectorMetadata.connector_input_mode ||
      sourceEvent.connector_input_mode ||
      explainability.connector_input_mode
  );
  if (connectorInputMode === "synthetic" || connectorInputMode === "synthetic_fallback") return false;

  const rolloutState = lower(source.rollout_state || source.rolloutState);
  if (rolloutState === "disabled" || rolloutState === "shadow") return false;
  if (!isLiveRolloutState(rolloutState)) return false;
  if (!isSourceLiveSafe(source)) return false;

  const eventComplianceStatus = lower(sourceEvent.compliance_status || explainability.compliance_status);
  if (eventComplianceStatus && eventComplianceStatus !== "approved") return false;

  const readinessStatus = lower(source.readiness_status);
  if (readinessStatus === "fail" || readinessStatus === "unknown") return false;

  const healthStatus = lower(source.health_status);
  if (!isHealthyEnoughForTruth(healthStatus)) return false;

  const runStatus = lower(connectorRun.status);
  if (runStatus && !["completed", "partial", "replayed"].includes(runStatus)) return false;

  const sourceId = asText(source.id || sourceEvent.source_id);
  const sourceEventId = asText(sourceEvent.id || explainability.source_event_id);
  if (!sourceId || !sourceEventId) return false;
  if (!isSourceFreshLiveSafe(source, input.nowMs)) return false;

  return true;
}
