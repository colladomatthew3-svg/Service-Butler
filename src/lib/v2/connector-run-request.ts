export type ConnectorRunMode = "standard" | "replay";

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeConnectorRunMode(value: unknown): ConnectorRunMode {
  const normalized = asText(value).toLowerCase();
  return normalized === "replay" ? "replay" : "standard";
}

export function sanitizeIdempotencyKey(value: unknown) {
  const raw = asText(value);
  if (!raw) return "";
  return raw.slice(0, 180);
}

function isoMinuteBucket(isoLike: unknown) {
  const value = asText(isoLike);
  const parsed = value ? new Date(value).toISOString() : new Date().toISOString();
  return parsed.slice(0, 16);
}

export function buildConnectorRunIdempotencyKey({
  entrypoint,
  tenantId,
  sourceId,
  connectorKey,
  runMode = "standard",
  replayedFromRunId,
  providedKey,
  requestedAt
}: {
  entrypoint: string;
  tenantId: string;
  sourceId: string;
  connectorKey: string;
  runMode?: ConnectorRunMode;
  replayedFromRunId?: string | null;
  providedKey?: string | null;
  requestedAt?: string | null;
}) {
  const explicit = sanitizeIdempotencyKey(providedKey);
  if (explicit) return explicit;

  const normalizedRunMode = normalizeConnectorRunMode(runMode);
  const replayed = asText(replayedFromRunId);
  const replaySuffix = replayed ? `:replay:${replayed}` : "";
  const bucket = isoMinuteBucket(requestedAt);
  const computed = [
    asText(entrypoint) || "connector",
    asText(tenantId) || "tenant",
    asText(sourceId) || "source",
    asText(connectorKey) || "connector",
    normalizedRunMode,
    bucket
  ].join(":");

  return sanitizeIdempotencyKey(`${computed}${replaySuffix}`);
}
