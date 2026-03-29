import { getConnectorByKey, listConnectors } from "@/lib/v2/connectors/registry";
import { inferConnectorKey } from "@/lib/v2/connectors/source-type-map";
import type { ConnectorAdapter, ConnectorHealth, ConnectorPullInput } from "@/lib/v2/connectors/types";
import { runConnectorForSource } from "@/lib/v2/connectors/runner";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DataSourceRuntimeMode = "fully-live" | "live-partial" | "simulated";

export type DataSourceMutationPayload = {
  name?: string;
  sourceType?: string;
  status?: string;
  active?: boolean;
  termsStatus?: string;
  complianceStatus?: string;
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
  if (raw === "completed" || raw === "partial" || raw === "failed" || raw === "running" || raw === "queued") {
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
  if (normalizeStatus(sourceRow.status) !== "active") return "simulated";
  if (!policyAllowed) return "live-partial";

  const termsStatus = asText(sourceRow.terms_status || sourceRow.compliance_status).toLowerCase();
  const complianceStatus = asText(sourceRow.compliance_status || sourceRow.terms_status).toLowerCase();
  if (!isApprovedStatus(termsStatus) || !isApprovedStatus(complianceStatus)) {
    return "live-partial";
  }

  const runStatus = normalizeRunStatus(latestRun?.status);
  if (runStatus === "completed") return "fully-live";
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
        "id,source_type,name,status,terms_status,provenance,reliability_score,freshness_timestamp,rate_limit_policy,compliance_flags,config_encrypted,compliance_status,created_at,updated_at"
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
      .select("id,source_id,compliance_status,data_freshness_score,source_reliability_score,ingested_at")
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
      latestEventFreshnessScore: latestEvent ? asNumber(latestEvent.data_freshness_score, 0) : null,
      latestEventReliabilityScore: latestEvent ? asNumber(latestEvent.source_reliability_score, 0) : null,
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
      "id,tenant_id,source_type,name,status,terms_status,provenance,reliability_score,freshness_timestamp,rate_limit_policy,compliance_flags,config_encrypted,compliance_status,created_at,updated_at"
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

  return merged;
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
    rate_limit_policy: body.rateLimitPolicy || {},
    compliance_flags: body.complianceFlags || {},
    compliance_status: asText(body.complianceStatus) || termsStatus,
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
  connectorKeyOverride
}: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceId: string;
  actorUserId: string;
  connectorKeyOverride?: string;
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
    connector
  });

  const sourceSummary = await getDataSourceSummary({ supabase, tenantId, sourceId });
  return {
    sourceSummary,
    health: summarizeConnectorHealth({ sourceSummary, health, connectorKey }),
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
