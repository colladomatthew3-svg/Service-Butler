/* eslint-disable @typescript-eslint/no-explicit-any */
import { featureFlags } from "@/lib/config/feature-flags";
import { dataSourceCatalog, getCatalogEntryForSourceType, getDataSourceCatalogEntry } from "@/lib/control-plane/catalog";
import { buyerReadinessNoteForSource } from "@/lib/control-plane/readiness";
import type {
  ConnectorHealthSummary,
  DataSourceMutationPayload,
  DataSourceRuntimeMode,
  DataSourceStatus,
  DataSourceSummary,
  DataSourceTermsStatus
} from "@/lib/control-plane/types";
import { getConnectorByKey } from "@/lib/v2/connectors/registry";
import { inferConnectorKey } from "@/lib/v2/connectors/source-type-map";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
    insert: (payload: Record<string, unknown>) => any;
    update: (payload: Record<string, unknown>) => any;
    eq: (column: string, value: unknown) => any;
    in?: (column: string, value: unknown[]) => any;
    order?: (column: string, opts?: Record<string, unknown>) => any;
    limit?: (value: number) => any;
    maybeSingle?: () => any;
    single?: () => any;
  };
};

type RawSourceRow = {
  id: string;
  source_type: string;
  name: string;
  status: Exclude<DataSourceStatus, "not_configured">;
  terms_status: Exclude<DataSourceTermsStatus, "unknown">;
  rate_limit_policy?: Record<string, unknown> | null;
  config_encrypted?: unknown;
  reliability_score?: number | null;
  freshness_timestamp?: string | null;
  provenance?: string | null;
};

type RawRunRow = {
  id: string;
  source_id: string;
  status?: string | null;
  completed_at?: string | null;
  records_seen?: number | null;
  records_created?: number | null;
  metadata?: Record<string, unknown> | null;
};

type RawSourceEventRow = {
  source_id: string;
  compliance_status?: string | null;
  ingested_at?: string | null;
};

function envTrue(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function familyLabel(connectorKey: string) {
  const prefix = String(connectorKey || "").split(".")[0] || "source";
  return prefix
    .split(/[_-]+/)
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function parseDataSourceConfig(raw: unknown) {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function stringifyDataSourceConfig(raw: Record<string, unknown>) {
  return JSON.stringify(raw || {});
}

function freshnessLabel(value: string | null | undefined) {
  if (!value) return "No recent source events";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown freshness";

  const deltaMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  if (deltaMinutes < 1440) return `${Math.round(deltaMinutes / 60)}h ago`;
  return `${Math.round(deltaMinutes / 1440)}d ago`;
}

function freshnessScore(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 0;

  const deltaMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (deltaMinutes <= 60) return 96;
  if (deltaMinutes <= 6 * 60) return 88;
  if (deltaMinutes <= 24 * 60) return 76;
  if (deltaMinutes <= 72 * 60) return 58;
  return 34;
}

function normalizeTermsStatus(value: unknown): DataSourceTermsStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved" || normalized === "restricted" || normalized === "pending_review" || normalized === "blocked") {
    return normalized;
  }
  return "unknown";
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  const text = String(value || "").trim();
  if (!text) return [];

  return text
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function hasFirecrawlCredential(config: Record<string, unknown>) {
  return Boolean(config.firecrawl_api_key || process.env.FIRECRAWL_API_KEY);
}

function hasSampleRecords(config: Record<string, unknown>) {
  return Array.isArray(config.sample_records) && config.sample_records.length > 0;
}

export function computeRuntimeMode(sourceType: string, config: Record<string, unknown>, termsStatus: DataSourceTermsStatus): DataSourceRuntimeMode {
  const normalizedType = String(sourceType || "").toLowerCase();

  if (hasSampleRecords(config)) return "simulated";

  if (normalizedType.includes("weather")) {
    const hasCoords = Number.isFinite(Number(config.latitude ?? config.lat)) && Number.isFinite(Number(config.longitude ?? config.lon));
    return hasCoords ? "fully-live" : "simulated";
  }

  if (normalizedType.includes("permit")) {
    const hasProvider = Boolean(config.provider_url || process.env.PERMITS_PROVIDER_URL);
    if (!hasProvider) return "simulated";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("usgs") || normalizedType.includes("water")) {
    const hasEndpoint = Boolean(config.endpoint || process.env.USGS_WATER_ENDPOINT);
    const hasSiteCodes = Boolean(config.site_codes || process.env.USGS_SITE_CODES);
    if (!hasEndpoint && !hasSiteCodes) return "simulated";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("open311") || normalizedType.includes("311")) {
    const hasEndpoint = Boolean(config.endpoint || process.env.OPEN311_ENDPOINT || "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100");
    if (!hasEndpoint) return "simulated";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("fema") || normalizedType.includes("disaster")) {
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("census")) {
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("overpass") || normalizedType.includes("osm") || normalizedType.includes("property")) {
    const hasQuery = Boolean(config.query || process.env.OVERPASS_QUERY);
    if (!hasQuery) return "simulated";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("utility") || normalizedType.includes("outage")) {
    const hasSearchTerms =
      (Array.isArray(config.search_terms) && config.search_terms.some((value) => String(value || "").trim().length > 0)) ||
      Boolean(String(config.search_query || config.query || "").trim());
    if (!hasSearchTerms) return "simulated";
    if (!hasFirecrawlCredential(config)) return "live-partial";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("incident")) {
    const citizenRestricted = envTrue("SB_ENABLE_CITIZEN_CONNECTOR") === false && String(config.source_provenance || "").toLowerCase().includes("citizen");
    if (citizenRestricted) return "simulated";
    const hasStructuredFeed = Boolean(config.endpoint || config.feed_url);
    const hasFirecrawlUrls = parseStringList(config.page_urls).length > 0 && parseBoolean(config.use_firecrawl);
    if (!hasStructuredFeed && !hasFirecrawlUrls) return "simulated";
    if (hasFirecrawlUrls && !hasFirecrawlCredential(config)) return "live-partial";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  if (normalizedType.includes("social") || normalizedType.includes("reddit") || normalizedType.includes("review")) {
    const hasFeed = Boolean(config.feed_url || config.endpoint || process.env.SOCIAL_INTENT_FEED_URL);
    const hasSearchTerms =
      (Array.isArray(config.search_terms) && config.search_terms.some((value) => String(value || "").trim().length > 0)) ||
      Boolean(String(config.search_query || config.query || "").trim()) ||
      (Array.isArray(config.subreddits) && config.subreddits.some((value) => String(value || "").trim().length > 0));
    const hasFirecrawlUrls = parseStringList(config.page_urls).length > 0 && parseBoolean(config.use_firecrawl);
    if (!hasFeed && !hasSearchTerms && !hasFirecrawlUrls) return "simulated";
    if (hasFirecrawlUrls && !hasFirecrawlCredential(config)) return "live-partial";
    return termsStatus === "approved" ? "fully-live" : "live-partial";
  }

  return termsStatus === "approved" ? "fully-live" : "live-partial";
}

function resolveCaptureStatus(summary: Pick<DataSourceSummary, "configured" | "status" | "runtimeMode" | "termsStatus" | "complianceStatus" | "config" | "latestRunStatus">) {
  if (!summary.configured || summary.status === "not_configured" || hasSampleRecords(summary.config)) return "simulated" as const;
  if (summary.termsStatus !== "approved" || summary.complianceStatus !== "approved") return "blocked" as const;
  if (summary.runtimeMode === "live-partial") return "live_safe_partial" as const;
  if (summary.runtimeMode === "simulated") return "simulated" as const;
  if (summary.latestRunStatus === "failed") return "blocked" as const;
  return "capturing_live" as const;
}

function buildBuyerReadinessNote(input: {
  name: string;
  configured: boolean;
  status: DataSourceStatus;
  runtimeMode: DataSourceRuntimeMode;
  termsStatus: DataSourceTermsStatus;
  complianceStatus: DataSourceTermsStatus;
  config: Record<string, unknown>;
}) {
  return buyerReadinessNoteForSource(input as DataSourceSummary);
}

function configuredSummaryFromCatalog(catalogKey: string): DataSourceSummary {
  const catalog = getDataSourceCatalogEntry(catalogKey);
  if (!catalog) {
    throw new Error(`Unknown data source catalog key: ${catalogKey}`);
  }

  return {
    id: null,
    catalogKey: catalog.catalogKey,
    connectorKey: catalog.connectorKey,
    family: familyLabel(catalog.connectorKey),
    sourceType: catalog.sourceType,
    name: catalog.name,
    description: catalog.description,
    configured: false,
    status: "not_configured",
    runtimeMode: computeRuntimeMode(catalog.sourceType, catalog.defaultConfig, catalog.defaultTermsStatus),
    termsStatus: catalog.defaultTermsStatus,
    complianceStatus: catalog.defaultTermsStatus,
    freshness: 0,
    freshnessTimestamp: null,
    freshnessLabel: "Not configured",
    reliability: catalog.defaultReliabilityScore,
    latestRunStatus: null,
    latestRunCompletedAt: null,
    latestEventAt: null,
    recordsSeen: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    provenance: catalog.defaultProvenance,
    liveRequirements: catalog.liveRequirements,
    buyerReadinessNote: buildBuyerReadinessNote({
      name: catalog.name,
      configured: false,
      status: "not_configured",
      runtimeMode: computeRuntimeMode(catalog.sourceType, catalog.defaultConfig, catalog.defaultTermsStatus),
      termsStatus: catalog.defaultTermsStatus,
      complianceStatus: catalog.defaultTermsStatus,
      config: catalog.defaultConfig
    }),
    captureStatus: "simulated",
    countsAsRealCapture: false,
    config: catalog.defaultConfig,
    configTemplate: catalog.defaultConfig,
    rateLimitPolicy: {}
  };
}

export function buildDemoDataSourceSummaries() {
  const summaries = dataSourceCatalog.map((entry) => configuredSummaryFromCatalog(entry.catalogKey));
  const orderIndex = new Map(dataSourceCatalog.map((entry, index) => [entry.catalogKey, index]));

  return summaries.sort((a, b) => {
    const left = orderIndex.get(a.catalogKey) ?? 999;
    const right = orderIndex.get(b.catalogKey) ?? 999;
    return left - right;
  });
}

function buildConfiguredSummary(
  row: RawSourceRow,
  latestRun: RawRunRow | undefined,
  latestEvent: RawSourceEventRow | undefined
) {
  const catalog = getCatalogEntryForSourceType(row.source_type);
  const connectorKey = catalog?.connectorKey || inferConnectorKey(row.source_type);
  const config = parseDataSourceConfig(row.config_encrypted);
  const termsStatus = normalizeTermsStatus(row.terms_status);
  const connector = getConnectorByKey(connectorKey);
  const complianceStatus =
    connector?.compliancePolicy({
      tenantId: "",
      sourceId: String(row.id),
      sourceType: String(row.source_type),
      config: {
        ...config,
        terms_status: row.terms_status,
        source_provenance: row.provenance
      }
    }).termsStatus ||
    normalizeTermsStatus(latestEvent?.compliance_status) ||
    termsStatus;

  const runtimeMode = computeRuntimeMode(row.source_type, config, termsStatus);
  const freshnessTimestamp = latestEvent?.ingested_at || row.freshness_timestamp || null;
  const recordsUpdated = Number((latestRun?.metadata as Record<string, unknown> | null)?.opportunities_updated || 0);
  const summary = {
    id: String(row.id),
    catalogKey: catalog?.catalogKey || connectorKey,
    connectorKey,
    family: familyLabel(connectorKey),
    sourceType: row.source_type,
    name: row.name || catalog?.name || row.source_type,
    description: catalog?.description || "Configured restoration intelligence source.",
    configured: true,
    status: row.status,
    runtimeMode,
    termsStatus,
    complianceStatus,
    freshness: freshnessScore(freshnessTimestamp),
    freshnessTimestamp,
    freshnessLabel: freshnessLabel(freshnessTimestamp),
    reliability: Number(row.reliability_score || catalog?.defaultReliabilityScore || 50),
    latestRunStatus: latestRun?.status || null,
    latestRunCompletedAt: latestRun?.completed_at || null,
    latestEventAt: latestEvent?.ingested_at || null,
    recordsSeen: Number(latestRun?.records_seen || 0),
    recordsCreated: Number(latestRun?.records_created || 0),
    recordsUpdated,
    provenance: row.provenance || catalog?.defaultProvenance || null,
    liveRequirements: catalog?.liveRequirements || [],
    buyerReadinessNote: buildBuyerReadinessNote({
      name: row.name || catalog?.name || row.source_type,
      configured: true,
      status: row.status,
      runtimeMode,
      termsStatus,
      complianceStatus,
      config
    }),
    captureStatus: "simulated" as const,
    countsAsRealCapture: false,
    config,
    configTemplate: catalog?.defaultConfig || {},
    rateLimitPolicy: (row.rate_limit_policy as Record<string, unknown>) || {}
  } satisfies DataSourceSummary;

  const captureStatus = resolveCaptureStatus(summary);
  const connectorInputMode = String((latestRun?.metadata as Record<string, unknown> | null)?.connector_input_mode || "").toLowerCase();

  return {
    ...summary,
    captureStatus,
    countsAsRealCapture: captureStatus === "capturing_live" && connectorInputMode !== "synthetic_fallback"
  };
}

export async function listDataSourceSummaries({
  supabase,
  tenantId
}: {
  supabase?: SupabaseLike | null;
  tenantId?: string | null;
} = {}) {
  if (!featureFlags.useV2Reads || !supabase || !tenantId) {
    return buildDemoDataSourceSummaries();
  }

  const { data: sourceRows, error: sourceError } = await (supabase as any)
    .from("v2_data_sources")
    .select("id,source_type,name,status,terms_status,rate_limit_policy,config_encrypted,reliability_score,freshness_timestamp,provenance")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (sourceError) {
    throw new Error(sourceError.message || "Could not load data sources");
  }

  const rows = (sourceRows || []) as RawSourceRow[];
  const sourceIds = rows.map((row) => String(row.id)).filter(Boolean);

  const [runResponse, eventResponse] = sourceIds.length
    ? await Promise.all([
        (supabase as any)
          .from("v2_connector_runs")
          .select("id,source_id,status,completed_at,records_seen,records_created,started_at,metadata")
          .in("source_id", sourceIds)
          .order("started_at", { ascending: false })
          .limit(400),
        (supabase as any)
          .from("v2_source_events")
          .select("source_id,compliance_status,ingested_at")
          .in("source_id", sourceIds)
          .order("ingested_at", { ascending: false })
          .limit(400)
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const latestRunBySource = new Map<string, RawRunRow>();
  for (const run of ((runResponse.data || []) as RawRunRow[])) {
    const key = String(run.source_id || "");
    if (!key || latestRunBySource.has(key)) continue;
    latestRunBySource.set(key, run);
  }

  const latestEventBySource = new Map<string, RawSourceEventRow>();
  for (const event of ((eventResponse.data || []) as RawSourceEventRow[])) {
    const key = String(event.source_id || "");
    if (!key || latestEventBySource.has(key)) continue;
    latestEventBySource.set(key, event);
  }

  const configured = rows.map((row) => buildConfiguredSummary(row, latestRunBySource.get(String(row.id)), latestEventBySource.get(String(row.id))));
  const configuredCatalogKeys = new Set(configured.map((row) => row.catalogKey));
  const missing = dataSourceCatalog
    .filter((entry) => !configuredCatalogKeys.has(entry.catalogKey))
    .map((entry) => configuredSummaryFromCatalog(entry.catalogKey));

  const orderIndex = new Map(dataSourceCatalog.map((entry, index) => [entry.catalogKey, index]));

  return [...configured, ...missing].sort((a, b) => {
    const left = orderIndex.get(a.catalogKey) ?? 999;
    const right = orderIndex.get(b.catalogKey) ?? 999;
    if (left !== right) return left - right;
    if (a.configured !== b.configured) return a.configured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getDataSourceSummaryById({
  supabase,
  tenantId,
  sourceId
}: {
  supabase: SupabaseLike;
  tenantId: string;
  sourceId: string;
}) {
  const summaries = await listDataSourceSummaries({ supabase, tenantId });
  return summaries.find((summary) => summary.id === sourceId) || null;
}

export function buildCreatePayloadFromMutation(payload: DataSourceMutationPayload) {
  const catalog = payload.catalogKey ? getDataSourceCatalogEntry(payload.catalogKey) : null;
  if (!catalog) {
    throw new Error("catalogKey is required");
  }

  const config = {
    ...catalog.defaultConfig,
    ...(payload.config || {})
  };

  return {
    source_type: catalog.sourceType,
    name: String(payload.name || catalog.name).trim(),
    status: payload.status || "active",
    terms_status: payload.termsStatus || catalog.defaultTermsStatus,
    reliability_score: clampScore(payload.reliabilityScore ?? catalog.defaultReliabilityScore),
    provenance: String(payload.provenance || catalog.defaultProvenance).trim() || null,
    rate_limit_policy: payload.rateLimitPolicy || {},
    config_encrypted: stringifyDataSourceConfig(config),
    freshness_timestamp: null
  };
}

export function buildUpdatePayloadFromMutation(payload: DataSourceMutationPayload) {
  const update: Record<string, unknown> = {};
  if (payload.name != null) update.name = String(payload.name).trim();
  if (payload.status != null) update.status = payload.status;
  if (payload.termsStatus != null) update.terms_status = payload.termsStatus;
  if (payload.reliabilityScore != null) update.reliability_score = clampScore(payload.reliabilityScore);
  if (payload.provenance != null) update.provenance = String(payload.provenance).trim() || null;
  if (payload.rateLimitPolicy != null) update.rate_limit_policy = payload.rateLimitPolicy;
  if (payload.config != null) update.config_encrypted = stringifyDataSourceConfig(payload.config);
  return update;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export async function probeDataSourceHealth(summary: DataSourceSummary): Promise<ConnectorHealthSummary> {
  const connector = getConnectorByKey(summary.connectorKey);
  const checkedAt = new Date().toISOString();

  if (!connector) {
    return {
      ok: false,
      detail: `Connector not found for ${summary.connectorKey}`,
      checkedAt,
      runtimeMode: summary.runtimeMode,
      complianceStatus: summary.complianceStatus
    };
  }

  const result = await connector.healthcheck({
    tenantId: "",
    sourceId: String(summary.id || summary.catalogKey),
    sourceType: summary.sourceType,
    config: {
      ...summary.config,
      terms_status: summary.termsStatus,
      source_provenance: summary.provenance
    }
  });

  return {
    ok: Boolean(result.ok),
    detail: String(result.detail || (result.ok ? "Healthcheck passed" : "Healthcheck failed")),
    checkedAt,
    latencyMs: result.latencyMs,
    runtimeMode: summary.runtimeMode,
    complianceStatus: summary.complianceStatus
  };
}
