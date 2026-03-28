import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

function loadEnvFromFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const cwd = process.cwd();
loadEnvFromFile(path.join(cwd, ".env.local"));
loadEnvFromFile(path.join(cwd, ".env"));

type Status = "PASS" | "WARN" | "FAIL";

type CheckResult = {
  name: string;
  status: Status;
  detail: string;
  remediation?: string;
};

const REQUIRED_TABLES = [
  "v2_tenants",
  "v2_tenant_memberships",
  "v2_territories",
  "v2_data_sources",
  "v2_connector_runs",
  "v2_source_events",
  "v2_opportunities",
  "v2_assignments",
  "v2_leads",
  "v2_outreach_events",
  "v2_jobs",
  "v2_job_attributions"
];

function envTrue(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function pushResult(list: CheckResult[], result: CheckResult) {
  list.push(result);
}

function parseSupabaseHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function parseSupabasePort(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(url: string) {
  const hostname = parseSupabaseHost(url);
  return hostname === "127.0.0.1" || hostname === "localhost";
}

async function isPortListening(host: string, port: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1_000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function checkTableExists(supabase: any, table: string): Promise<CheckResult> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (error) {
    return {
      name: `table:${table}`,
      status: "FAIL",
      detail: `Table probe failed (${error.message}).`,
      remediation: "Run `npm run db:push` and verify Supabase project/migration target."
    };
  }

  return {
    name: `table:${table}`,
    status: "PASS",
    detail: "Table reachable."
  };
}

async function main() {
  const results: CheckResult[] = [];

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const webhookSecret = String(process.env.WEBHOOK_SHARED_SECRET || "").trim();
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();

  if (!supabaseUrl || !serviceRole) {
    pushResult(results, {
      name: "supabase_env",
      status: "FAIL",
      detail: "NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing.",
      remediation: "Export both variables, then re-run `npm run operator-healthcheck`."
    });

    printReport(results);
    process.exit(1);
  }

  pushResult(results, {
    name: "supabase_env",
    status: "PASS",
    detail: "Supabase URL + service role key present."
  });

  if (!appUrl) {
    pushResult(results, {
      name: "app_url",
      status: "FAIL",
      detail: "NEXT_PUBLIC_APP_URL is not set.",
      remediation: "Set NEXT_PUBLIC_APP_URL to the public app origin before pilot activation."
    });
  } else if (!/^https?:\/\//i.test(appUrl)) {
    pushResult(results, {
      name: "app_url",
      status: "FAIL",
      detail: `NEXT_PUBLIC_APP_URL must start with http:// or https:// (got ${appUrl}).`,
      remediation: "Set NEXT_PUBLIC_APP_URL to a valid origin such as https://app.example.com."
    });
  } else {
    pushResult(results, {
      name: "app_url",
      status: "PASS",
      detail: `NEXT_PUBLIC_APP_URL configured (${appUrl}).`
    });
  }

  if (!webhookSecret) {
    pushResult(results, {
      name: "webhook_secret",
      status: "FAIL",
      detail: "WEBHOOK_SHARED_SECRET is not set.",
      remediation: "Set WEBHOOK_SHARED_SECRET. Mutating webhook routes now fail closed without it."
    });
  } else {
    pushResult(results, {
      name: "webhook_secret",
      status: "PASS",
      detail: "WEBHOOK_SHARED_SECRET configured."
    });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { error: connectivityError } = await supabase.from("accounts").select("id", { head: true, count: "exact" }).limit(1);
  if (connectivityError) {
    const host = parseSupabaseHost(supabaseUrl);
    const port = parseSupabasePort(supabaseUrl);
    const localDbDown =
      isLocalSupabaseUrl(supabaseUrl) && port !== null && !(await isPortListening(host, port));

    pushResult(results, {
      name: "supabase_connectivity",
      status: "FAIL",
      detail: `Supabase connectivity check failed (${connectivityError.message}).`,
      remediation: localDbDown
        ? "Local Supabase does not appear to be running. Start it with `npm run db:start`, then run `npm run db:push` and retry."
        : "Confirm URL/key pair and that the target project is reachable."
    });

    printReport(results);
    process.exit(1);
  }

  pushResult(results, {
    name: "supabase_connectivity",
    status: "PASS",
    detail: "Supabase connectivity OK."
  });

  for (const table of REQUIRED_TABLES) {
    pushResult(results, await checkTableExists(supabase, table));
  }

  const useWrites = envTrue("SB_USE_V2_WRITES");
  const useReads = envTrue("SB_USE_V2_READS");

  if (useWrites && useReads) {
    pushResult(results, {
      name: "feature_flags",
      status: "PASS",
      detail: "SB_USE_V2_WRITES=true and SB_USE_V2_READS=true."
    });
  } else {
    pushResult(results, {
      name: "feature_flags",
      status: "FAIL",
      detail: `Flags not ready (writes=${useWrites}, reads=${useReads}).`,
      remediation: "Set SB_USE_V2_WRITES=true and SB_USE_V2_READS=true for pilot activation."
    });
  }

  const operatorTenantId = String(process.env.OPERATOR_TENANT_ID || "").trim();
  const operatorTenantName = String(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group").trim();

  let tenantId = operatorTenantId;

  if (!tenantId) {
    const { data, error } = await supabase
      .from("v2_tenants")
      .select("id,type,parent_tenant_id")
      .eq("name", operatorTenantName)
      .eq("type", "franchise")
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) {
      pushResult(results, {
        name: "operator_tenant",
        status: "FAIL",
        detail: `Operator tenant not found (${operatorTenantName}).`,
        remediation: "Run `npm run operator:seed` or set OPERATOR_TENANT_ID explicitly."
      });
    } else {
      tenantId = String(data.id);
      pushResult(results, {
        name: "operator_tenant",
        status: "PASS",
        detail: `Operator tenant found (${tenantId}). parent_tenant_id=${data.parent_tenant_id || "null"}`
      });
    }
  } else {
    const { data, error } = await supabase
      .from("v2_tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (error || !data?.id) {
      pushResult(results, {
        name: "operator_tenant",
        status: "FAIL",
        detail: `OPERATOR_TENANT_ID does not exist (${tenantId}).`,
        remediation: "Set a valid OPERATOR_TENANT_ID or run `npm run operator:seed`."
      });
    } else {
      pushResult(results, {
        name: "operator_tenant",
        status: "PASS",
        detail: `Operator tenant found (${tenantId}).`
      });
    }
  }

  if (tenantId) {
    const { count: membershipCount, error: membershipError } = await supabase
      .from("v2_tenant_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (membershipError || !Number(membershipCount || 0)) {
      pushResult(results, {
        name: "tenant_memberships",
        status: "FAIL",
        detail: membershipError?.message || "No active tenant memberships found.",
        remediation: "Seed the operator with OPERATOR_USER_ID so at least one active user is wired to the tenant."
      });
    } else {
      pushResult(results, {
        name: "tenant_memberships",
        status: "PASS",
        detail: `Active tenant memberships: ${membershipCount}.`
      });
    }

    const { count: territoryCount, error: territoryError } = await supabase
      .from("v2_territories")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("active", true);

    if (territoryError || !Number(territoryCount || 0)) {
      pushResult(results, {
        name: "territories",
        status: "FAIL",
        detail: territoryError?.message || "No active territories found.",
        remediation: "Seed or insert active territories for this operator tenant."
      });
    } else {
      pushResult(results, {
        name: "territories",
        status: "PASS",
        detail: `Active territories: ${territoryCount}.`
      });
    }

    const { count: sourceCount, error: sourceError } = await supabase
      .from("v2_data_sources")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (sourceError || !Number(sourceCount || 0)) {
      pushResult(results, {
        name: "data_sources",
        status: "FAIL",
        detail: sourceError?.message || "No active v2_data_sources configured.",
        remediation: "Seed/update active sources (weather, permits, incidents, social, USGS, Open311, OpenFEMA, Census, Overpass)."
      });
    } else {
      pushResult(results, {
        name: "data_sources",
        status: "PASS",
        detail: `Active data sources: ${sourceCount}.`
      });
    }
  }

  const twilioDisabled = envTrue("SB_DISABLE_TWILIO");
  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  );

  if (twilioConfigured) {
    pushResult(results, {
      name: "twilio",
      status: "PASS",
      detail: "Twilio credentials configured."
    });
  } else if (twilioDisabled) {
    pushResult(results, {
      name: "twilio",
      status: "PASS",
      detail: "Twilio explicitly disabled (SB_DISABLE_TWILIO=true)."
    });
  } else {
    pushResult(results, {
      name: "twilio",
      status: "FAIL",
      detail: "Twilio not configured and not explicitly disabled.",
      remediation: "Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER or SB_DISABLE_TWILIO=true."
    });
  }

  const hubspotDisabled = envTrue("SB_DISABLE_HUBSPOT");
  const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);

  if (hubspotConfigured) {
    pushResult(results, {
      name: "hubspot",
      status: "PASS",
      detail: "HubSpot token configured."
    });
  } else if (hubspotDisabled) {
    pushResult(results, {
      name: "hubspot",
      status: "PASS",
      detail: "HubSpot explicitly disabled (SB_DISABLE_HUBSPOT=true)."
    });
  } else {
    pushResult(results, {
      name: "hubspot",
      status: "FAIL",
      detail: "HubSpot not configured and not explicitly disabled.",
      remediation: "Set HUBSPOT_ACCESS_TOKEN or SB_DISABLE_HUBSPOT=true."
    });
  }

  const inngestConfigured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
  const inngestEndpointConfigured = Boolean(appUrl);
  if (inngestConfigured && inngestEndpointConfigured) {
    pushResult(results, {
      name: "inngest",
      status: "PASS",
      detail: `Inngest keys configured with endpoint ${appUrl.replace(/\/$/, "")}/api/inngest.`
    });
  } else {
    pushResult(results, {
      name: "inngest",
      status: "FAIL",
      detail: "Inngest config is incomplete (missing keys and/or NEXT_PUBLIC_APP_URL).",
      remediation: "Set INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, and NEXT_PUBLIC_APP_URL before live pilot activation."
    });
  }

  const failCount = results.filter((r) => r.status === "FAIL").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;

  printReport(results);

  if (failCount > 0) {
    console.error(`\nHealthcheck failed: ${failCount} failing check(s), ${warnCount} warning(s).`);
    process.exit(1);
  }

  console.log(`\nHealthcheck passed: ${results.length - warnCount} pass, ${warnCount} warning(s), 0 failures.`);
}

function printReport(results: CheckResult[]) {
  console.log("\nService Butler Operator Healthcheck\n");

  for (const result of results) {
    const prefix = result.status === "PASS" ? "[PASS]" : result.status === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(`${prefix} ${result.name}: ${result.detail}`);
    if (result.remediation) {
      console.log(`       remediation: ${result.remediation}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
