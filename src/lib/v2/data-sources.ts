import { getConnectorByKey, listConnectors } from "@/lib/v2/connectors/registry";
import { inferConnectorKey } from "@/lib/v2/connectors/source-type-map";
import type { ConnectorAdapter, ConnectorHealth, ConnectorPullInput } from "@/lib/v2/connectors/types";
import { runConnectorForSource } from "@/lib/v2/connectors/runner";
import { buildConnectorRunIdempotencyKey, normalizeConnectorRunMode, type ConnectorRunMode } from "@/lib/v2/connector-run-request";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DataSourceRuntimeMode = "fully-live" | "live-partial" | "simulated";

export type DataSourceMutationPayload = {
  name?: string;
  sourceType?: string;
  status?: string;
  active?: boolean;
  termsStatus?: string;
  complianceStatus?: string;
  rolloutState?: "shadow" | "pilot" | "live" | "disabled";
  freshnessSlaMinutes?: number;
  provenance?: string;
  reliabilityScore?: number;
  freshnessTimestamp?: string | null;
  rateLimitPolicy?: Record<string, unknown> | null;
  complianceFlags?: Record<string, unknown> | null;
  config?: Record<string, unknown> | string | null;
  connectorKey?: string;
};

export type DataSourceSummary = {
  id: string;
  tenantId: string;
  sourceType: string;
  connectorKey: string;
  connectorLabel: string;
  name: string;
  status: string;
  termsStatus: string;
  complianceStatus: string;
  rolloutState: "shadow" | "pilot" | "live" | "disabled";
  readinessStatus: "pass" | "warn" | "fail" | "unknown";
  runtimeMode: DataSourceRuntimeMode;
  provenance: string;
  reliabilityScore: number;
  freshnessTimestamp: string | null;
  latestRunId: string | null;
  latestRunStatus: string | null;
  latestRunStartedAt: string | null;
  latestRunCompletedAt: string | null;
  latestRunError: string | null;
  recordsSeen: number;
  recordsCreated: number;
  latestEventAt: string | null;
  latestEventComplianceStatus: string | null;
  latestEventFreshnessScore: number | null;
  latestEventReliabilityScore: number | null;
  freshnessSlaMinutes: number;
  healthStatus: "ok" | "degraded" | "failed" | "unknown";
  healthDetail: string | null;
  lastHealthCheckedAt: string | null;
  lastHealthLatencyMs: number | null;
  complianceFlags: Record<string, unknown>;
  rateLimitPolicy: Record<string, unknown>;
  configPreview: Record<string, unknown>;
};

export type ConnectorHealthSummary = {
  sourceId: string;
  sourceType: string;
  connectorKey: string;
  connectorLabel: string;
  ok: boolean;
  detail: string;
  latencyMs: number | null;
  runtimeMode: DataSourceRuntimeMode;
  termsStatus: string;
  complianceStatus: string;
  latestRunStatus: string | null;
  latestRunCompletedAt: string | null;
  recordsSeen: number;
  recordsCreated: number;
};

export type IntegrationReadinessCheckStatus = "pass" | "warn" | "fail";

export type IntegrationReadinessCheck = {
  key: string;
  label: string;
  status: IntegrationReadinessCheckStatus;
  required: boolean;
  message: string;
  detail?: string;
  value?: string | number | boolean;
};

export type IntegrationReadinessSummary = {
  overallStatus: IntegrationReadinessCheckStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
  requiredFailCount: number;
  checks: IntegrationReadinessCheck[];
};

export type ConnectorFamilySummary = {
  key: string;
  label: string;
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isPlainObject(value)) return value;
  if (typeof value !== "string") return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toConfigRecord(value: unknown) {
  return parseRecord(value);
}

function redactPreview(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (depth > 1) return `[${value.length} items]`;
    return value.slice(0, 6).map((item) => redactPreview(item, depth + 1));
  }
  if (!isPlainObject(value)) return String(value);

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/(token|secret|password|api[_-]?key|auth|credential|private)/i.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = depth > 1 ? String(raw) : redactPreview(raw, depth + 1);
  }

  return output;
}

function normalizeRunStatus(value: unknown) {
  const raw = asText(value).toLowerCase();
  if (
    raw === "completed" ||
    raw === "partial" ||
    raw === "failed" ||
    raw === "running" ||
    raw === "queued" ||
    raw === "stale" ||
    raw === "replayed"
  ) {
    return raw;
  }
  return "";
}

function isApprovedStatus(value: unknown) {
  return asText(value).toLowerCase() === "approved";
}

function connectorLabel(key: string) {
  return key
    .split(".")
    .map((part) =>
      part
        .split(/[_-]+/)
        .map((piece) => (piece ? piece[0].toUpperCase() + piece.slice(1) : piece))
        .join(" ")
    )
    .join(" ");
}

function normalizeStatus(value: unknown) {
  const raw = asText(value).toLowerCase();
  if (raw === "active") return "active";
  if (raw === "paused" || raw === "inactive" || raw === "disabled" || raw === "archived") return "paused";
  return raw || "paused";
}

function normalizeRolloutState(value: unknown): DataSourceSummary["rolloutState"] {
  const normalized = asText(value).toLowerCase();
  if (normalized === "shadow" || normalized === "pilot" || normalized === "live" || normalized === "disabled") return normalized;
  return "pilot";
}

function normalizeReadinessStatus(value: unknown): DataSourceSummary["readinessStatus"] {
  const normalized = asText(value).toLowerCase();
  if (normalized === "pass" || normalized === "warn" || normalized === "fail" || normalized === "unknown") return normalized;
  return "unknown";
}

function normalizeHealthStatus(value: unknown): DataSourceSummary["healthStatus"] {
  const normalized = asText(value).toLowerCase();
  if (normalized === "ok" || normalized === "degraded" || normalized === "failed" || normalized === "unknown") return normalized;
  return "unknown";
}

function latestBySource<T extends Record<string, unknown>>(rows: T[], sourceKey = "source_id") {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = asText(row[sourceKey]);
    if (!key || latest.has(key)) continue;
    latest.set(key, row);
  }
  return latest;
}

function buildSourceConfigPreview(sourceRow: Record<string, unknown>) {
  const parsedConfig = parseRecord(sourceRow.config_encrypted);
  return redactPreview({
    ...parsedConfig,
    connector_name: sourceRow.name,
    source_type: sourceRow.source_type,
    source_provenance: sourceRow.provenance,
    terms_status: sourceRow.terms_status,
    rate_limit_policy: parseRecord(sourceRow.rate_limit_policy),
    compliance_flags: parseRecord(sourceRow.compliance_flags)
  }) as Record<string, unknown>;
}

function buildSourceRuntimeConfig({
  tenantId,
  sourceId,
  sourceRow
}: {
  tenantId: string;
  sourceId: string;
  sourceRow: Record<string, unknown>;
}): { connectorKey: string; connector: ConnectorAdapter | null; input: ConnectorPullInput; familyLabel: string } {
  const parsedConfig = toConfigRecord(sourceRow.config_encrypted);
  const connectorKey = String(parsedConfig.connector_key || inferConnectorKey(String(sourceRow.source_type || "")));
  const connector = getConnectorByKey(connectorKey);
  const familyLabel = connectorLabel(connector?.key || connectorKey);

  return {
    connectorKey,
    connector,
    familyLabel,
    input: {
      tenantId,
      sourceId,
      sourceType: String(sourceRow.source_type || "unknown"),
      config: {
        ...parsedConfig,
        connector_key: connectorKey,
        connector_name: sourceRow.name,
        source_name: sourceRow.name,
        source_provenance: sourceRow.provenance,
        terms_status: sourceRow.terms_status,
        compliance_flags: parseRecord(sourceRow.compliance_flags),
        rate_limit_policy: parseRecord(sourceRow.rate_limit_policy)
      }
    }
  };
}

function deriveRuntimeMode({
  sourceRow,
  latestRun,
  policyAllowed
}: {
  sourceRow: Record<string, unknown>;
  latestRun?: Record<string, unknown> | null;
  policyAllowed: boolean;
}): DataSourceRuntimeMode {
  const rolloutState = normalizeRolloutState(sourceRow.rollout_state);
  if (normalizeStatus(sourceRow.status) !== "active") return "simulated";
  if (rolloutState === "disabled") return "simulated";
  if (rolloutState === "shadow") return "live-partial";
  if (!policyAllowed) return "live-partial";

  const termsStatus = asText(sourceRow.terms_status || sourceRow.compliance_status).toLowerCase();
  const complianceStatus = asText(sourceRow.compliance_status || sourceRow.terms_status).toLowerCase();
  if (!isApprovedStatus(termsStatus) || !isApprovedStatus(complianceStatus)) {
    return "live-partial";
  }

  const runStatus = normalizeRunStatus(latestRun?.status);
  if (runStatus === "completed" || runStatus === "replayed") return "fully-live";
  return "live-partial";
}

function summarizeLatestRun(latestRun?: Record<string, unknown> | null) {
  if (!latestRun) {
    return {
      latestRunId: null,
      latestRunStatus: null,
      latestRunStartedAt: null,
      latestRunCompletedAt: null,
      latestRunError: null,
      recordsSeen: 0,
      recordsCreated: 0
    };
  }

  return {
    latestRunId: asText(latestRun.id) || null,
    latestRunStatus: asText(latestRun.status) || null,
    latestRunStartedAt: asText(latestRun.started_at) || null,
    latestRunCompletedAt: asText(latestRun.completed_at) || null,
    latestRunError: asText(latestRun.error_summary) || null,
    recordsSeen: asNumber(latestRun.records_seen, 0),
    recordsCreated: asNumber(latestRun.records_created, 0)
  };
}

export function listSupportedConnectorFamilies(): ConnectorFamilySummary[] {
  return listConnectors().map((connector) => ({
    key: connector.key,
    label: connectorLabel(connector.key)
  }));
}

export async function getDataSourceSummaries({
  supabase,
  tenantId
}: {
  supabase: SupabaseClient;
  tenantId: string;
}) {
  const [
    { data: sourceRows, error: sourceError },
    { data: runRows, error: runError },
    { data: eventRows, error: eventError }
  ] = await Promise.all([
    supabase
    .from("v2_data_sources")
    .select(
      "id,source_type,name,status,terms_status,provenance,reliability_score,freshness_timestamp,freshness_sla_minutes,rate_limit_policy,compliance_flags,config_encrypted,compliance_status,rollout_state,readiness_status,health_status,health_detail,last_health_checked_at,last_health_latency_ms,created_at,updated_at"
    )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("v2_connector_runs")
      .select("id,source_id,status,started_at,completed_at,records_seen,records_created,error_summary,metadata")
      .eq("tenant_id", tenantId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("started_at", { ascending: false })
      .limit(500),
    supabase
      .from("v2_source_events")
      .select("id,source_id,compliance_status,normalized_payload,source_reliability_score,ingested_at")
      .eq("tenant_id", tenantId)
      .order("ingested_at", { ascending: false })
      .limit(500)
  ]);

  if (sourceError) throw new Error(sourceError.message);
  if (runError) throw new Error(runError.message);
  if (eventError) throw new Error(eventError.message);

  const sourceRecords = (sourceRows || []) as Array<Record<string, unknown>>;
  const runRecords = (runRows || []) as Array<Record<string, unknown>>;
  const eventRecords = (eventRows || []) as Array<Record<string, unknown>>;

  const latestRuns = latestBySource(runRecords);
  const latestEvents = latestBySource(eventRecords);

  return sourceRecords.map((sourceRow) => {
    const sourceId = asText(sourceRow.id);
    const sourceType = asText(sourceRow.source_type) || "unknown";
    const sourceConfig = buildSourceRuntimeConfig({ tenantId, sourceId, sourceRow });
    const connector = sourceConfig.connector;
    const compliancePolicy = connector?.compliancePolicy(sourceConfig.input);
    const latestRun = latestRuns.get(sourceId) || null;
    const latestEvent = latestEvents.get(sourceId) || null;
    const termsStatus = asText(latestEvent?.compliance_status || sourceRow.terms_status || compliancePolicy?.termsStatus || "pending_review");
    const complianceStatus = asText(latestEvent?.compliance_status || sourceRow.compliance_status || termsStatus || compliancePolicy?.termsStatus || "pending_review");
    const runtimeMode = deriveRuntimeMode({
      sourceRow: {
        ...sourceRow,
        terms_status: termsStatus,
        compliance_status: complianceStatus
      },
      latestRun,
      policyAllowed: Boolean(compliancePolicy?.ingestionAllowed ?? true)
    });
    const latestRunSummary = summarizeLatestRun(latestRun);

    return {
      id: sourceId,
      tenantId,
      sourceType,
      connectorKey: sourceConfig.connectorKey,
      connectorLabel: sourceConfig.familyLabel,
      name: asText(sourceRow.name) || sourceConfig.familyLabel,
      status: normalizeStatus(sourceRow.status),
      termsStatus,
      complianceStatus,
      rolloutState: normalizeRolloutState(sourceRow.rollout_state),
      readinessStatus: normalizeReadinessStatus(sourceRow.readiness_status),
      runtimeMode,
      provenance: asText(sourceRow.provenance),
      reliabilityScore: asNumber(sourceRow.reliability_score, 0),
      freshnessTimestamp: asText(sourceRow.freshness_timestamp) || null,
      latestRunId: latestRunSummary.latestRunId,
      latestRunStatus: latestRunSummary.latestRunStatus,
      latestRunStartedAt: latestRunSummary.latestRunStartedAt,
      latestRunCompletedAt: latestRunSummary.latestRunCompletedAt,
      latestRunError: latestRunSummary.latestRunError,
      recordsSeen: latestRunSummary.recordsSeen,
      recordsCreated: latestRunSummary.recordsCreated,
      latestEventAt: asText(latestEvent?.ingested_at) || null,
      latestEventComplianceStatus: asText(latestEvent?.compliance_status) || null,
      latestEventFreshnessScore: latestEvent ? asNumber(parseRecord(latestEvent.normalized_payload).data_freshness_score, 0) : null,
      latestEventReliabilityScore: latestEvent ? asNumber(latestEvent.source_reliability_score, 0) : null,
      freshnessSlaMinutes: Math.max(30, asNumber(sourceRow.freshness_sla_minutes, 360)),
      healthStatus: normalizeHealthStatus(sourceRow.health_status),
      healthDetail: asText(sourceRow.health_detail) || null,
      lastHealthCheckedAt: asText(sourceRow.last_health_checked_at) || null,
      lastHealthLatencyMs: sourceRow.last_health_latency_ms != null ? asNumber(sourceRow.last_health_latency_ms, 0) : null,
      complianceFlags: parseRecord(sourceRow.compliance_flags),
      rateLimitPolicy: parseRecord(sourceRow.rate_limit_policy),
      configPreview: buildSourceConfigPreview(sourceRow)
    };
  });
}

export async function getDataSourceSummary({
  supabase,
  tenantId,
  sourceId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
}) {
  const summaries = await getDataSourceSummaries({ supabase, tenantId });
  const summary = summaries.find((item) => item.id === sourceId);
  if (!summary) throw new Error("Source not found");
  return summary;
}

export async function fetchDataSourceRow({
  supabase,
  tenantId,
  sourceId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
}) {
  const { data, error } = await supabase
    .from("v2_data_sources")
    .select(
      "id,tenant_id,source_type,name,status,terms_status,provenance,reliability_score,freshness_timestamp,freshness_sla_minutes,rate_limit_policy,compliance_flags,config_encrypted,compliance_status,rollout_state,readiness_status,health_status,health_detail,last_health_checked_at,last_health_latency_ms,created_at,updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("id", sourceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Source not found");
  return data as Record<string, unknown>;
}

function buildStoredConfigValue(
  config: DataSourceMutationPayload["config"],
  connectorKey: string,
  existingConfig: Record<string, unknown>
) {
  const merged = {
    ...(isPlainObject(existingConfig) ? existingConfig : {}),
    ...toConfigRecord(config)
  } as Record<string, unknown>;

  if (connectorKey) {
    merged.connector_key = connectorKey;
  }

  return JSON.stringify(merged);
}

export function buildDataSourceInsertPayload({
  tenantId,
  body
}: {
  tenantId: string;
  body: DataSourceMutationPayload;
}) {
  const name = asText(body.name);
  const sourceType = asText(body.sourceType);
  if (!name) throw new Error("name is required");
  if (!sourceType) throw new Error("sourceType is required");

  const active = body.active;
  const status = normalizeStatus(body.status || (active === false ? "paused" : active === true ? "active" : body.termsStatus === "approved" ? "active" : "paused"));
  const termsStatus = asText(body.termsStatus) || "pending_review";
  const connectorKey = asText(body.connectorKey) || inferConnectorKey(sourceType);

  return {
    tenant_id: tenantId,
    source_type: sourceType,
    name,
    status,
    terms_status: termsStatus,
    provenance: asText(body.provenance) || null,
    reliability_score: asNumber(body.reliabilityScore, 0),
    freshness_timestamp: body.freshnessTimestamp || new Date().toISOString(),
    freshness_sla_minutes: Math.max(30, asNumber(body.freshnessSlaMinutes, 360)),
    rate_limit_policy: body.rateLimitPolicy || {},
    compliance_flags: body.complianceFlags || {},
    compliance_status: asText(body.complianceStatus) || termsStatus,
    rollout_state: body.rolloutState || "pilot",
    readiness_status: "unknown",
    readiness_reasons: [],
    config_encrypted: buildStoredConfigValue(body.config, connectorKey, {})
  };
}

export function buildDataSourceUpdatePayload(
  body: DataSourceMutationPayload,
  existingConfig: Record<string, unknown> = {}
) {
  const payload: Record<string, unknown> = {};

  if (body.name != null) payload.name = asText(body.name);
  if (body.sourceType != null) payload.source_type = asText(body.sourceType);
  if (body.status != null || body.active != null) {
    payload.status = normalizeStatus(body.status || (body.active === false ? "paused" : "active"));
  }
  if (body.termsStatus != null) payload.terms_status = asText(body.termsStatus) || "pending_review";
  if (body.complianceStatus != null) payload.compliance_status = asText(body.complianceStatus) || null;
  if (body.rolloutState != null) payload.rollout_state = normalizeRolloutState(body.rolloutState);
  if (body.freshnessSlaMinutes != null) payload.freshness_sla_minutes = Math.max(30, asNumber(body.freshnessSlaMinutes, 360));
  if (body.provenance != null) payload.provenance = asText(body.provenance) || null;
  if (body.reliabilityScore != null) payload.reliability_score = asNumber(body.reliabilityScore, 0);
  if (body.freshnessTimestamp !== undefined) payload.freshness_timestamp = body.freshnessTimestamp || null;
  if (body.rateLimitPolicy != null) payload.rate_limit_policy = body.rateLimitPolicy || {};
  if (body.complianceFlags != null) payload.compliance_flags = body.complianceFlags || {};
  if (body.config != null || body.connectorKey != null) {
    payload.config_encrypted = buildStoredConfigValue(
      body.config ?? existingConfig,
      asText(body.connectorKey) || String(existingConfig.connector_key || ""),
      existingConfig
    );
  }

  return payload;
}

export function summarizeConnectorHealth({
  sourceSummary,
  health,
  connectorKey
}: {
  sourceSummary: DataSourceSummary;
  health: ConnectorHealth;
  connectorKey?: string;
}): ConnectorHealthSummary {
  return {
    sourceId: sourceSummary.id,
    sourceType: sourceSummary.sourceType,
    connectorKey: connectorKey || sourceSummary.connectorKey,
    connectorLabel: sourceSummary.connectorLabel,
    ok: Boolean(health.ok),
    detail: asText(health.detail) || (health.ok ? "Connector reachable" : "Connector healthcheck failed"),
    latencyMs: Number.isFinite(health.latencyMs) ? Number(health.latencyMs) : null,
    runtimeMode: sourceSummary.runtimeMode,
    termsStatus: sourceSummary.termsStatus,
    complianceStatus: sourceSummary.complianceStatus,
    latestRunStatus: sourceSummary.latestRunStatus,
    latestRunCompletedAt: sourceSummary.latestRunCompletedAt,
    recordsSeen: sourceSummary.recordsSeen,
    recordsCreated: sourceSummary.recordsCreated
  };
}

export async function runDataSourceConnector({
  supabase,
  tenantId,
  sourceId,
  actorUserId,
  connectorKeyOverride,
  idempotencyKey,
  runMode,
  replayedFromRunId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
  actorUserId: string;
  connectorKeyOverride?: string;
  idempotencyKey?: string;
  runMode?: ConnectorRunMode;
  replayedFromRunId?: string | null;
}) {
  const sourceRow = await fetchDataSourceRow({ supabase, tenantId, sourceId });
  if (normalizeStatus(sourceRow.status) !== "active") {
    throw new Error("Source must be active before it can run");
  }

  const connectorConfig = buildSourceRuntimeConfig({ tenantId, sourceId, sourceRow });
  const connectorKey = connectorKeyOverride || connectorConfig.connectorKey;
  const connector = getConnectorByKey(connectorKey);
  if (!connector) throw new Error(`Connector not found for key ${connectorKey}`);

  const health = await connector.healthcheck(connectorConfig.input);
  const sourceSummaryBeforeRun = await getDataSourceSummary({ supabase, tenantId, sourceId });
  const summarizedHealth = summarizeConnectorHealth({
    sourceSummary: sourceSummaryBeforeRun,
    health,
    connectorKey
  });

  if (!health.ok) {
    await supabase
      .from("v2_data_sources")
      .update({
        health_status: "failed",
        health_detail: asText(health.detail) || "Connector healthcheck failed",
        last_health_checked_at: new Date().toISOString(),
        last_health_latency_ms: Number.isFinite(health.latencyMs) ? Number(health.latencyMs) : null
      })
      .eq("tenant_id", tenantId)
      .eq("id", sourceId);
    return {
      sourceSummary: sourceSummaryBeforeRun,
      health: summarizedHealth,
      run: null
    };
  }

  const run = await runConnectorForSource({
    supabase,
    tenantId,
    sourceId,
    sourceType: String(sourceRow.source_type || "unknown"),
    sourceConfig: connectorConfig.input.config,
    actorUserId,
    connector,
    runMode: normalizeConnectorRunMode(runMode),
    replayedFromRunId: replayedFromRunId ? String(replayedFromRunId) : null,
    idempotencyKey: buildConnectorRunIdempotencyKey({
      entrypoint: "lib_v2_data_sources",
      tenantId,
      sourceId,
      connectorKey: connector.key,
      runMode,
      replayedFromRunId,
      providedKey: idempotencyKey
    })
  });

  const sourceSummary = await getDataSourceSummary({ supabase, tenantId, sourceId });
  await supabase
    .from("v2_data_sources")
    .update({
      health_status: run.status === "failed" ? "failed" : run.status === "partial" || run.status === "stale" ? "degraded" : "ok",
      health_detail: run.errorSummary || (run.status === "replayed" ? "Replay run completed" : "Connector run completed"),
      compliance_status: sourceSummary.complianceStatus,
      readiness_status: run.status === "failed" ? "fail" : run.status === "partial" || run.status === "stale" ? "warn" : "pass",
      last_health_checked_at: new Date().toISOString(),
      freshness_timestamp: sourceSummary.latestEventAt || sourceSummary.freshnessTimestamp,
      last_health_latency_ms: Number.isFinite(health.latencyMs) ? Number(health.latencyMs) : null
    })
    .eq("tenant_id", tenantId)
    .eq("id", sourceId);
  const updatedSourceSummary = await getDataSourceSummary({ supabase, tenantId, sourceId });
  return {
    sourceSummary: updatedSourceSummary,
    health: summarizeConnectorHealth({ sourceSummary: updatedSourceSummary, health, connectorKey }),
    run
  };
}

export async function probeDataSourceHealth({
  supabase,
  tenantId,
  sourceId,
  connectorKeyOverride
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
  connectorKeyOverride?: string;
}) {
  const sourceRow = await fetchDataSourceRow({ supabase, tenantId, sourceId });
  const connectorConfig = buildSourceRuntimeConfig({ tenantId, sourceId, sourceRow });
  const connectorKey = connectorKeyOverride || connectorConfig.connectorKey;
  const connector = getConnectorByKey(connectorKey);
  if (!connector) throw new Error(`Connector not found for key ${connectorKey}`);

  const health = await connector.healthcheck(connectorConfig.input);
  await supabase
    .from("v2_data_sources")
    .update({
      health_status: health.ok ? "ok" : "failed",
      health_detail: asText(health.detail) || (health.ok ? "Connector reachable" : "Connector healthcheck failed"),
      last_health_checked_at: new Date().toISOString(),
      last_health_latency_ms: Number.isFinite(health.latencyMs) ? Number(health.latencyMs) : null
    })
    .eq("tenant_id", tenantId)
    .eq("id", sourceId);
  const sourceSummary = await getDataSourceSummary({ supabase, tenantId, sourceId });

  return {
    sourceSummary,
    health: summarizeConnectorHealth({
      sourceSummary,
      health,
      connectorKey
    })
  };
}
