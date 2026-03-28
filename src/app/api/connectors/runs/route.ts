import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { getConnectorByKey } from "@/lib/v2/connectors/registry";
import { runConnectorForSource } from "@/lib/v2/connectors/runner";
import { inferConnectorKey } from "@/lib/v2/connectors/source-type-map";
import type { AccountRole } from "@/types/domain";

function parseEncryptedConfig(raw: unknown) {
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

function connectorRuntimeMode(sourceType: string, config: Record<string, unknown>) {
  const normalizedType = String(sourceType || "").toLowerCase();
  const terms = String(config.terms_status || "").toLowerCase();
  const hasPermitsProvider = Boolean(config.provider_url || process.env.PERMITS_PROVIDER_URL);
  const hasOpen311Endpoint = Boolean(
    config.endpoint || process.env.OPEN311_ENDPOINT || "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100"
  );
  const hasCensusEndpoint = Boolean(
    config.endpoint ||
      process.env.CENSUS_API_ENDPOINT ||
      "https://api.census.gov/data/2023/acs/acs5?get=NAME,B25034_010E,B25034_011E,B25003_003E,B25004_001E&for=county:*&in=state:36"
  );
  const hasOverpassQuery = Boolean(config.query || process.env.OVERPASS_QUERY);

  if (normalizedType.includes("permit")) {
    if (!hasPermitsProvider) return "simulated";
    if (terms && terms !== "approved") return "live-partial";
    return "fully-live";
  }

  if (normalizedType.includes("open311") || normalizedType.includes("311")) {
    if (!hasOpen311Endpoint) return "simulated";
    if (terms && terms !== "approved") return "live-partial";
    return "fully-live";
  }

  if (normalizedType.includes("census")) {
    if (!hasCensusEndpoint) return "simulated";
    if (terms && terms !== "approved") return "live-partial";
    return "fully-live";
  }

  if (normalizedType.includes("overpass") || normalizedType.includes("osm")) {
    if (!hasOverpassQuery) return "simulated";
    if (terms && terms !== "approved") return "live-partial";
    return "fully-live";
  }

  if (terms && terms !== "approved") return "live-partial";
  return "fully-live";
}

export async function GET(req: NextRequest) {
  if (isDemoMode() || !featureFlags.useV2Reads) {
    return NextResponse.json({ connectorRuns: [], mode: "compat" });
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));

  const { data, error } = await context.supabase
    .from("v2_connector_runs")
    .select("id,source_id,status,started_at,completed_at,records_seen,records_created,error_summary,metadata")
    .eq("tenant_id", context.franchiseTenantId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ connectorRuns: data || [] });
}

export async function POST(req: NextRequest) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to execute v2 connector runs"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const body = (await req.json().catch(() => ({}))) as {
    sourceId?: string;
    connectorKey?: string;
  };

  let sources: Array<Record<string, unknown>> = [];

  if (body.sourceId) {
    const { data, error } = await context.supabase
      .from("v2_data_sources")
      .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags,terms_status,provenance")
      .eq("tenant_id", context.franchiseTenantId)
      .eq("id", body.sourceId)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: error?.message || "Source not found" }, { status: 404 });
    sources = [data as Record<string, unknown>];
  } else {
    const { data, error } = await context.supabase
      .from("v2_data_sources")
      .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags,terms_status,provenance")
      .eq("tenant_id", context.franchiseTenantId)
      .eq("status", "active")
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    sources = (data || []) as Array<Record<string, unknown>>;
  }

  const results: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    const decryptedConfig = parseEncryptedConfig(source.config_encrypted);
    const sourceConfig = {
      connector_name: source.name,
      rate_limit_policy: source.rate_limit_policy,
      compliance_flags: source.compliance_flags,
      config_encrypted: source.config_encrypted,
      terms_status: source.terms_status,
      source_provenance: source.provenance,
      ...decryptedConfig
    };
    const runtimeMode = connectorRuntimeMode(String(source.source_type || "unknown"), sourceConfig);

    const key = String(body.connectorKey || "").trim() || inferConnectorKey(String(source.source_type || ""));

    const connector = getConnectorByKey(key);
    if (!connector) {
      results.push({
        sourceId: source.id,
        status: "failed",
        error: `Connector not found for key ${key}`
      });
      continue;
    }

    const health = await connector.healthcheck({
      tenantId: context.franchiseTenantId,
      sourceId: String(source.id),
      sourceType: String(source.source_type || "unknown"),
      config: sourceConfig
    });

    if (!health.ok) {
      results.push({
        sourceId: source.id,
        status: "failed",
        runtimeMode,
        error: health.detail || "Connector healthcheck failed"
      });
      continue;
    }

    const run = await runConnectorForSource({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      sourceId: String(source.id),
      sourceType: String(source.source_type || "unknown"),
      sourceConfig,
      actorUserId: context.userId,
      connector
    });

    results.push({
      sourceId: source.id,
      connectorKey: connector.key,
      runtimeMode,
      ...run
    });
  }

  return NextResponse.json({ ok: true, results });
}
