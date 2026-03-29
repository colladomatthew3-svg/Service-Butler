import { getBillingMode } from "@/lib/services/billing-mode";
import { getStripeClient } from "@/lib/services/stripe";
import { getDataSourceSummaries, type IntegrationReadinessCheck, type IntegrationReadinessCheckStatus, type IntegrationReadinessSummary } from "@/lib/v2/data-sources";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductionReadinessCheck = IntegrationReadinessCheck;

export type ProductionReadinessTenantSummary = {
  tenantId: string;
  tenantName: string;
  activeTerritories: number;
  serviceAreaConfigured: boolean;
  activeDataSources: number;
  liveSafeDataSources: number;
};

export type ProductionReadinessSummary = {
  checkedAt: string;
  status: IntegrationReadinessCheckStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
  checks: ProductionReadinessCheck[];
  integrationReadiness: IntegrationReadinessSummary;
  tenant: ProductionReadinessTenantSummary | null;
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function envEnabled(name: string) {
  const value = asText(process.env[name]).toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function pass(key: string, required: boolean, message: string, detail?: string, value?: string | number | boolean): ProductionReadinessCheck {
  return { key, label: key.replace(/_/g, " "), status: "pass", required, message, detail, value };
}

function warn(key: string, required: boolean, message: string, detail?: string, value?: string | number | boolean): ProductionReadinessCheck {
  return { key, label: key.replace(/_/g, " "), status: "warn", required, message, detail, value };
}

function fail(key: string, required: boolean, message: string, detail?: string, value?: string | number | boolean): ProductionReadinessCheck {
  return { key, label: key.replace(/_/g, " "), status: "fail", required, message, detail, value };
}

function countStatus(checks: ProductionReadinessCheck[]) {
  return {
    passCount: checks.filter((check) => check.status === "pass").length,
    warnCount: checks.filter((check) => check.status === "warn").length,
    failCount: checks.filter((check) => check.status === "fail").length
  };
}

function overallStatus(checks: ProductionReadinessCheck[]): IntegrationReadinessCheckStatus {
  const requiredFailCount = checks.filter((check) => check.required && check.status === "fail").length;
  if (requiredFailCount > 0) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function getIntegrationReadinessChecks(): ProductionReadinessCheck[] {
  const billingMode = getBillingMode();
  const checks: ProductionReadinessCheck[] = [
    checkAppUrl(),
    checkDemoModeSafety(),
    checkSupabaseEnv(),
    checkWebhookSecret(),
    checkBillingModeConfig(billingMode),
    checkStripeConfig(billingMode),
    checkEnrichmentConfig(),
    checkEmailConfig(),
    checkTwilioConfig(),
    checkHubSpotConfig(),
    checkSmartleadConfig(),
    checkInngestConfig()
  ];

  return checks;
}

export function getIntegrationReadinessSummary(): IntegrationReadinessSummary {
  const checks = getIntegrationReadinessChecks();
  const counts = countStatus(checks);
  return {
    overallStatus: overallStatus(checks),
    passCount: counts.passCount,
    warnCount: counts.warnCount,
    failCount: counts.failCount,
    requiredFailCount: checks.filter((check) => check.required && check.status === "fail").length,
    checks
  };
}

export async function getProductionReadinessSummary({
  supabase
}: {
  supabase: SupabaseClient | null;
}): Promise<ProductionReadinessSummary> {
  const integrationReadiness = getIntegrationReadinessSummary();
  const checks = [...integrationReadiness.checks];
  const tenant = await resolveTenantSummary(supabase);
  checks.push(checkV2Flags());

  if (!supabase) {
    checks.push(warn("supabase_client", true, "Supabase client is unavailable for tenant validation.", "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."));
  } else {
    checks.push(await checkSupabaseHealth());
    checks.push(await checkSupabaseRestAccess(supabase));
    checks.push(...(await checkTenantReadiness(tenant)));
  }

  const counts = countStatus(checks);
  return {
    checkedAt: new Date().toISOString(),
    status: overallStatus(checks),
    passCount: counts.passCount,
    warnCount: counts.warnCount,
    failCount: counts.failCount,
    checks,
    integrationReadiness,
    tenant: tenant?.tenantId ? tenant : null
  };
}

function checkAppUrl(): ProductionReadinessCheck {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) return fail("app_url", true, "NEXT_PUBLIC_APP_URL is missing.");

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return fail("app_url", true, "NEXT_PUBLIC_APP_URL must use http or https.");
    }
    return pass("app_url", true, "Public app URL is configured.");
  } catch {
    return fail("app_url", true, "NEXT_PUBLIC_APP_URL is not a valid URL.");
  }
}

function checkDemoModeSafety(): ProductionReadinessCheck {
  const demoEnabled = envEnabled("DEMO_MODE");
  const allowNonDevDemo = envEnabled("ALLOW_NON_DEV_DEMO_MODE");

  if (!demoEnabled) {
    return pass("demo_mode", true, "Demo mode is disabled.");
  }

  if (process.env.NODE_ENV === "development") {
    return warn("demo_mode", true, "Demo mode is enabled in development.");
  }

  if (allowNonDevDemo) {
    return fail("demo_mode", true, "Demo mode is enabled outside development.");
  }

  return pass("demo_mode", true, "Demo mode env is set but blocked outside development.");
}

function checkSupabaseEnv(): ProductionReadinessCheck {
  const requiredKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return fail("supabase_env", true, `Missing Supabase env vars: ${missing.join(", ")}.`);
  }
  return pass("supabase_env", true, "Supabase environment variables are present.");
}

function checkWebhookSecret(): ProductionReadinessCheck {
  if (!process.env.WEBHOOK_SHARED_SECRET) {
    return fail("webhook_secret", true, "WEBHOOK_SHARED_SECRET is missing.");
  }
  return pass("webhook_secret", true, "Webhook secret is configured.");
}

async function checkSupabaseHealth(): Promise<ProductionReadinessCheck> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return fail("supabase_auth", true, "Supabase URL is missing.");
  }

  try {
    const url = new URL("/auth/v1/health", baseUrl);
    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      }
    });

    if (!res.ok) {
      return fail("supabase_auth", true, `Supabase auth health returned ${res.status}.`);
    }

    return pass("supabase_auth", true, "Supabase auth health check passed.");
  } catch (error) {
    return fail("supabase_auth", true, formatError("Supabase auth health failed", error));
  }
}

async function checkSupabaseRestAccess(supabase: SupabaseClient): Promise<ProductionReadinessCheck> {
  try {
    const { error } = await supabase.from("accounts").select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      return fail("supabase_rest", true, `Supabase REST probe returned an error: ${error.message}.`);
    }
    return pass("supabase_rest", true, "Supabase REST access succeeded.");
  } catch (error) {
    return fail("supabase_rest", true, formatError("Supabase REST probe failed", error));
  }
}

function checkV2Flags(): ProductionReadinessCheck {
  const reads = envEnabled("SB_USE_V2_READS");
  const writes = envEnabled("SB_USE_V2_WRITES");

  if (reads && writes) {
    return pass("v2_flags", true, "SB_USE_V2_READS=true and SB_USE_V2_WRITES=true.");
  }

  return fail("v2_flags", true, "V2 rollout flags must both be enabled: SB_USE_V2_READS=true and SB_USE_V2_WRITES=true.");
}

function checkBillingModeConfig(billingMode: ReturnType<typeof getBillingMode>): ProductionReadinessCheck {
  if (billingMode === "stripe") {
    return pass("billing_mode", true, "Billing mode is set to stripe.");
  }
  return warn("billing_mode", false, "Billing mode is disabled.");
}

function checkStripeConfig(billingMode: ReturnType<typeof getBillingMode>): ProductionReadinessCheck {
  if (billingMode !== "stripe") {
    return warn("stripe", false, "Stripe is not required because billing mode is disabled.");
  }

  const missing = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return fail("stripe", true, `Missing Stripe env vars: ${missing.join(", ")}.`);
  }

  try {
    getStripeClient();
    return pass("stripe", true, "Stripe client initialized.");
  } catch (error) {
    return fail("stripe", true, formatError("Stripe initialization failed", error));
  }
}

function checkEnrichmentConfig(): ProductionReadinessCheck {
  const endpoint = process.env.SERVICE_BUTLER_ENRICHMENT_URL;
  if (!endpoint) {
    return warn("enrichment", false, "Premium enrichment provider is not configured. Public-record enrichment will still work.");
  }

  try {
    new URL(endpoint);
  } catch {
    return fail("enrichment", false, "SERVICE_BUTLER_ENRICHMENT_URL is not a valid URL.");
  }

  return pass("enrichment", false, "Premium enrichment provider is configured.");
}

function checkEmailConfig(): ProductionReadinessCheck {
  const fromEmail = process.env.FROM_EMAIL;
  const hasProvider = Boolean(process.env.POSTMARK_SERVER_TOKEN || process.env.SENDGRID_API_KEY);

  if (!fromEmail || !hasProvider) {
    return warn("email", false, "Email provider is incomplete. Configure FROM_EMAIL plus Postmark or SendGrid for outbound email.");
  }

  return pass("email", false, "Email provider is configured.");
}

function checkTwilioConfig(): ProductionReadinessCheck {
  if (envEnabled("SB_DISABLE_TWILIO")) {
    return pass("twilio", false, "Twilio is explicitly disabled.");
  }

  const configured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  if (!configured) {
    return warn("twilio", false, "Twilio is not fully configured.");
  }

  if (!envEnabled("SB_TWILIO_SAFE_MODE")) {
    return warn("twilio", false, "Twilio credentials are present but SB_TWILIO_SAFE_MODE is not enabled.");
  }

  return pass("twilio", false, "Twilio is configured in safe mode.");
}

function checkHubSpotConfig(): ProductionReadinessCheck {
  if (envEnabled("SB_DISABLE_HUBSPOT")) {
    return pass("hubspot", false, "HubSpot is explicitly disabled.");
  }

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return warn("hubspot", false, "HubSpot is not configured.");
  }

  if (!envEnabled("SB_HUBSPOT_SAFE_MODE")) {
    return warn("hubspot", false, "HubSpot access token is present but SB_HUBSPOT_SAFE_MODE is not enabled.");
  }

  return pass("hubspot", false, "HubSpot is configured in safe mode.");
}

function checkSmartleadConfig(): ProductionReadinessCheck {
  if (!process.env.SMARTLEAD_API_KEY) {
    return warn("smartlead", false, "Smartlead is not configured.");
  }
  return pass("smartlead", false, "Smartlead is configured.");
}

function checkInngestConfig(): ProductionReadinessCheck {
  const configured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
  if (!configured) {
    return warn("inngest", false, "Inngest is not fully configured.");
  }
  return pass("inngest", false, "Inngest is configured.");
}

async function resolveTenantSummary(
  supabase: SupabaseClient | null
): Promise<ProductionReadinessTenantSummary | null> {
  if (!supabase) return null;

  const explicitTenantId = asText(process.env.OPERATOR_TENANT_ID);
  const tenantName = asText(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group");
  const tenantQuery = explicitTenantId
    ? supabase.from("v2_tenants").select("id,name,parent_tenant_id,type").eq("id", explicitTenantId).maybeSingle()
    : supabase.from("v2_tenants").select("id,name,parent_tenant_id,type").eq("name", tenantName).eq("type", "franchise").maybeSingle();

  const { data, error } = await tenantQuery;
  if (error || !data?.id) return null;

  const tenantId = String(data.id);
  const activeTerritories = await countActiveRows(supabase, "v2_territories", tenantId);
  const activeDataSources = await countActiveRows(supabase, "v2_data_sources", tenantId, "status", "active");
  const liveSafeDataSources = await countLiveSafeSources(supabase, tenantId);
  const serviceAreaConfigured = await hasConfiguredServiceArea(supabase, tenantId);

  return {
    tenantId,
    tenantName: String(data.name || tenantName),
    activeTerritories,
    serviceAreaConfigured,
    activeDataSources,
    liveSafeDataSources
  };
}

async function countActiveRows(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  column = "active",
  value: unknown = true
) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq(column, value);

  if (error) return 0;
  return Number(count || 0);
}

async function hasConfiguredServiceArea(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("v2_territories")
    .select("zip_codes,service_lines,active")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .limit(50);

  if (error) return false;

  return Boolean(
    (data || []).some((row: Record<string, unknown>) => {
      const zipCodes = Array.isArray(row.zip_codes) ? row.zip_codes : [];
      const serviceLines = Array.isArray(row.service_lines) ? row.service_lines : [];
      return zipCodes.length > 0 || serviceLines.length > 0;
    })
  );
}

async function countLiveSafeSources(supabase: SupabaseClient, tenantId: string) {
  try {
    const sources = await getDataSourceSummaries({ supabase, tenantId });
    return sources.filter((source) => source.status === "active" && source.runtimeMode !== "simulated").length;
  } catch {
    return 0;
  }
}

async function checkTenantReadiness(tenant: ProductionReadinessTenantSummary | null): Promise<ProductionReadinessCheck[]> {
  if (!tenant) {
    return [
      warn("operator_tenant", false, "Operator tenant could not be resolved for tenant-specific validation.", "Set OPERATOR_TENANT_ID or OPERATOR_TENANT_NAME."),
      warn("active_territories", false, "No tenant context available for territory validation."),
      warn("service_area", false, "No tenant context available for service area validation."),
      warn("active_data_sources", false, "No tenant context available for data source validation."),
      warn("live_safe_sources", false, "No tenant context available for live-safe source validation.")
    ];
  }

  const checks: ProductionReadinessCheck[] = [
    pass("operator_tenant", true, `Operator tenant resolved (${tenant.tenantName}).`, tenant.tenantId)
  ];

  if (tenant.activeTerritories > 0) {
    checks.push(pass("active_territories", true, `Active territories: ${tenant.activeTerritories}.`, String(tenant.activeTerritories)));
  } else {
    checks.push(fail("active_territories", true, "No active territories found.", String(tenant.activeTerritories)));
  }

  if (tenant.serviceAreaConfigured) {
    checks.push(pass("service_area", true, "Service area is configured.", "true"));
  } else {
    checks.push(fail("service_area", true, "Active territories exist but no service area configuration was found.", "false"));
  }

  if (tenant.activeDataSources > 0) {
    checks.push(pass("active_data_sources", true, `Active data sources: ${tenant.activeDataSources}.`, String(tenant.activeDataSources)));
  } else {
    checks.push(fail("active_data_sources", true, "No active data sources found.", String(tenant.activeDataSources)));
  }

  if (tenant.liveSafeDataSources > 0) {
    checks.push(pass("live_safe_sources", true, `Live-safe data sources: ${tenant.liveSafeDataSources}.`, String(tenant.liveSafeDataSources)));
  } else {
    checks.push(fail("live_safe_sources", true, "No live-safe data sources are active.", String(tenant.liveSafeDataSources)));
  }

  return checks;
}

function formatError(message: string, error: unknown) {
  return `${message}: ${error instanceof Error ? error.message : String(error)}`;
}
