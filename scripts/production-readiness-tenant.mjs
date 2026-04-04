import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const operatorTenantId = String(process.env.OPERATOR_TENANT_ID || "").trim();
const operatorTenantName = String(process.env.OPERATOR_TENANT_NAME || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");

if (!supabaseUrl || !serviceRoleKey) {
  console.log("warn|Tenant-scoped readiness checks skipped because Supabase credentials are missing.");
  process.exit(0);
}

if (!operatorTenantId && !operatorTenantName) {
  console.log("warn|Tenant-scoped readiness checks skipped because OPERATOR_TENANT_ID or OPERATOR_TENANT_NAME is not set.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const localSupabaseTarget = (() => {
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
})();

const result = await resolveTenantReadiness().catch((error) => ({
  fatal: error instanceof Error ? error.message : String(error),
  lines: []
}));

if (result.fatal) {
  if (localSupabaseTarget && String(result.fatal).toLowerCase().includes("fetch failed")) {
    console.log("warn|Tenant-scoped readiness probe could not complete over local REST in this runtime. Use operator-healthcheck as the authoritative local readiness gate.");
    process.exit(0);
  }
  console.log(`fail|Tenant-scoped readiness probe failed: ${result.fatal}`);
  process.exit(1);
}

for (const line of result.lines) {
  console.log(`${line.status}|${line.message}`);
}

process.exit(result.lines.some((line) => line.status === "fail") ? 1 : 0);

async function resolveTenantReadiness() {
  const tenantQuery = operatorTenantId
    ? supabase.from("v2_tenants").select("id,name,type").eq("id", operatorTenantId).maybeSingle()
    : supabase.from("v2_tenants").select("id,name,type").eq("name", operatorTenantName).eq("type", "franchise").maybeSingle();

  const { data: tenant, error: tenantError } = await tenantQuery;
  if (tenantError) {
    throw new Error(tenantError.message);
  }

  if (!tenant?.id) {
    return {
      lines: [
        {
          status: "fail",
          message: `Operator tenant could not be resolved${operatorTenantName ? ` (${operatorTenantName})` : ""}.`
        }
      ]
    };
  }

  const tenantId = String(tenant.id);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    territoryCountResponse,
    territoryRowsResponse,
    sourceRowsResponse,
    connectorRunsResponse,
    sourceEventsResponse
  ] = await Promise.all([
    supabase.from("v2_territories").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true),
    supabase.from("v2_territories").select("zip_codes,service_lines").eq("tenant_id", tenantId).eq("active", true).limit(50),
    supabase
      .from("v2_data_sources")
      .select("id,status,terms_status,config_encrypted")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(200),
    supabase
      .from("v2_connector_runs")
      .select("id,status,completed_at", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("completed_at", cutoff)
      .in("status", ["completed", "partial"]),
    supabase
      .from("v2_source_events")
      .select("id,ingested_at", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("ingested_at", cutoff)
  ]);

  const lines = [];

  if (territoryCountResponse.error) {
    lines.push({ status: "fail", message: `Active territories could not be checked: ${territoryCountResponse.error.message}.` });
  } else if (Number(territoryCountResponse.count || 0) > 0) {
    lines.push({ status: "pass", message: `Active territories: ${territoryCountResponse.count}.` });
  } else {
    lines.push({ status: "fail", message: "No active territories found." });
  }

  if (territoryRowsResponse.error) {
    lines.push({ status: "fail", message: `Service area could not be checked: ${territoryRowsResponse.error.message}.` });
  } else {
    const hasServiceArea = (territoryRowsResponse.data || []).some((row) => {
      const zipCodes = Array.isArray(row.zip_codes) ? row.zip_codes : [];
      const serviceLines = Array.isArray(row.service_lines) ? row.service_lines : [];
      return zipCodes.length > 0 || serviceLines.length > 0;
    });

    if (hasServiceArea) {
      lines.push({ status: "pass", message: "Service area is configured on active territories." });
    } else {
      lines.push({ status: "fail", message: "No active territory has zip codes or service lines configured." });
    }
  }

  if (sourceRowsResponse.error) {
    lines.push({ status: "fail", message: `Active data sources could not be checked: ${sourceRowsResponse.error.message}.` });
  } else {
    const activeSources = sourceRowsResponse.data || [];
    const liveSafeCount = activeSources.filter((row) => {
      const termsStatus = String(row.terms_status || "").toLowerCase();
      return termsStatus === "approved";
    }).length;
    const blockedSourceCount = activeSources.filter((row) => {
      const termsStatus = String(row.terms_status || "").toLowerCase();
      return termsStatus !== "approved";
    }).length;
    const sampleBackedCount = activeSources.filter((row) => {
      const config = parseConfig(row.config_encrypted);
      return Array.isArray(config.sample_records) && config.sample_records.length > 0;
    }).length;

    if (activeSources.length > 0) {
      lines.push({ status: "pass", message: `Active data sources: ${activeSources.length}.` });
    } else {
      lines.push({ status: "fail", message: "No active data sources found." });
    }

    if (liveSafeCount > 0) {
      lines.push({ status: "pass", message: `Live-safe data sources: ${liveSafeCount}.` });
    } else {
      lines.push({ status: "fail", message: "No live-safe data sources are active." });
    }

    if (blockedSourceCount > 0) {
      lines.push({ status: "warn", message: `Blocked active data sources: ${blockedSourceCount}.` });
    } else {
      lines.push({ status: "pass", message: "No active data sources are blocked by terms/compliance." });
    }

    if (sampleBackedCount > 0) {
      lines.push({ status: "warn", message: `Sample-backed active data sources: ${sampleBackedCount}.` });
    } else {
      lines.push({ status: "pass", message: "No active data sources are using sample-backed configuration." });
    }
  }

  if (connectorRunsResponse.error) {
    lines.push({ status: "warn", message: `Recent connector runs could not be checked: ${connectorRunsResponse.error.message}.` });
  } else if (Number(connectorRunsResponse.count || 0) > 0) {
    lines.push({ status: "pass", message: `Recent successful connector runs (7d): ${connectorRunsResponse.count}.` });
  } else {
    lines.push({ status: "warn", message: "No recent successful connector runs found in the last 7 days." });
  }

  if (sourceEventsResponse.error) {
    lines.push({ status: "warn", message: `Recent source events could not be checked: ${sourceEventsResponse.error.message}.` });
  } else if (Number(sourceEventsResponse.count || 0) > 0) {
    lines.push({ status: "pass", message: `Recent source events (7d): ${sourceEventsResponse.count}.` });
  } else {
    lines.push({ status: "warn", message: "No recent source events found in the last 7 days." });
  }

  return { lines };
}

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
