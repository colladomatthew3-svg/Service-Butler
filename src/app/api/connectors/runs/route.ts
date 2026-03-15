import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { getConnectorByKey } from "@/lib/v2/connectors/registry";
import { runConnectorForSource } from "@/lib/v2/connectors/runner";
import type { AccountRole } from "@/types/domain";

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
      .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags")
      .eq("tenant_id", context.franchiseTenantId)
      .eq("id", body.sourceId)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: error?.message || "Source not found" }, { status: 404 });
    sources = [data as Record<string, unknown>];
  } else {
    const { data, error } = await context.supabase
      .from("v2_data_sources")
      .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags")
      .eq("tenant_id", context.franchiseTenantId)
      .eq("status", "active")
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    sources = (data || []) as Array<Record<string, unknown>>;
  }

  const results: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    const key =
      String(body.connectorKey || "").trim() ||
      (String(source.source_type || "").toLowerCase().includes("weather")
        ? "weather.noaa"
        : String(source.source_type || "").toLowerCase().includes("permit")
          ? "permits.placeholder"
          : String(source.source_type || "").toLowerCase().includes("social")
            ? "social.intent.placeholder"
            : "incidents.generic");

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
      config: {
        connector_name: source.name,
        rate_limit_policy: source.rate_limit_policy,
        compliance_flags: source.compliance_flags,
        config_encrypted: source.config_encrypted
      }
    });

    if (!health.ok) {
      results.push({
        sourceId: source.id,
        status: "failed",
        error: health.detail || "Connector healthcheck failed"
      });
      continue;
    }

    const run = await runConnectorForSource({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      sourceId: String(source.id),
      sourceType: String(source.source_type || "unknown"),
      sourceConfig: {
        connector_name: source.name,
        rate_limit_policy: source.rate_limit_policy,
        compliance_flags: source.compliance_flags,
        config_encrypted: source.config_encrypted
      },
      actorUserId: context.userId,
      connector
    });

    results.push({
      sourceId: source.id,
      connectorKey: connector.key,
      ...run
    });
  }

  return NextResponse.json({ ok: true, results });
}
