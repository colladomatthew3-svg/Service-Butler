export type SourceTruthSource = {
  id: string;
  status?: string | null;
  termsStatus?: string | null;
  complianceStatus?: string | null;
  rolloutState?: string | null;
  healthStatus?: string | null;
  freshnessTimestamp?: string | null;
  freshnessSlaMinutes?: number | null;
};

export type SourceTruthEvent = {
  sourceId: string;
  complianceStatus?: string | null;
  ingestedAt?: string | null;
};

export type SourceTruthSummary = {
  activeSources: number;
  liveSafeSources: number;
  freshLiveSafeSources: number;
  approvedRecentEvents: number;
  blockedSources: number;
  sampleWindowMinutes: number;
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isApproved(value: unknown) {
  return asText(value).toLowerCase() === "approved";
}

export function isActiveSource(value: unknown) {
  return asText(value).toLowerCase() === "active";
}

export function isLiveRolloutState(value: unknown) {
  const normalized = asText(value).toLowerCase();
  return normalized === "pilot" || normalized === "live";
}

export function isHealthyEnoughForTruth(value: unknown) {
  const normalized = asText(value).toLowerCase();
  return normalized === "ok" || normalized === "degraded";
}

export function isFreshForTruth(timestamp: unknown, freshnessSlaMinutes: unknown, nowMs: number) {
  const text = asText(timestamp);
  if (!text) return false;
  const ts = new Date(text).getTime();
  if (!Number.isFinite(ts)) return false;
  const ageMinutes = Math.max(0, Math.round((nowMs - ts) / 60000));
  return ageMinutes <= Math.max(30, asNumber(freshnessSlaMinutes, 360));
}

function pickSourceField(source: Record<string, unknown>, camelKey: string, snakeKey: string) {
  return source[camelKey] ?? source[snakeKey];
}

export function isSourceLiveSafe(source: Record<string, unknown>) {
  return (
    isActiveSource(pickSourceField(source, "status", "status")) &&
    isApproved(pickSourceField(source, "termsStatus", "terms_status")) &&
    isApproved(pickSourceField(source, "complianceStatus", "compliance_status")) &&
    isLiveRolloutState(pickSourceField(source, "rolloutState", "rollout_state"))
  );
}

export function isSourceFreshLiveSafe(source: Record<string, unknown>, nowMs = Date.now()) {
  return (
    isSourceLiveSafe(source) &&
    isHealthyEnoughForTruth(pickSourceField(source, "healthStatus", "health_status")) &&
    isFreshForTruth(
      pickSourceField(source, "freshnessTimestamp", "freshness_timestamp"),
      pickSourceField(source, "freshnessSlaMinutes", "freshness_sla_minutes"),
      nowMs
    )
  );
}

export function summarizeSourceTruth(
  sources: SourceTruthSource[],
  events: SourceTruthEvent[],
  nowMs = Date.now()
): SourceTruthSummary {
  const activeSources = sources.filter((source) => isActiveSource(source.status));
  const liveSafeSources = activeSources.filter((source) => isSourceLiveSafe(source));

  const freshLiveSafeSourceIds = new Set(
    liveSafeSources
      .filter((source) => isSourceFreshLiveSafe(source, nowMs))
      .map((source) => source.id)
  );

  const sampleWindowMinutes = 24 * 60;
  const approvedRecentEvents = events.filter((event) => {
    if (!freshLiveSafeSourceIds.has(event.sourceId)) return false;
    if (!isApproved(event.complianceStatus)) return false;
    const ts = new Date(asText(event.ingestedAt)).getTime();
    if (!Number.isFinite(ts)) return false;
    const ageMinutes = Math.max(0, Math.round((nowMs - ts) / 60000));
    return ageMinutes <= sampleWindowMinutes;
  }).length;

  return {
    activeSources: activeSources.length,
    liveSafeSources: liveSafeSources.length,
    freshLiveSafeSources: freshLiveSafeSourceIds.size,
    approvedRecentEvents,
    blockedSources: activeSources.length - liveSafeSources.length,
    sampleWindowMinutes
  };
}
