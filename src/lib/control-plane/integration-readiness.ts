/* eslint-disable @typescript-eslint/no-explicit-any */
import { featureFlags } from "@/lib/config/feature-flags";
import type { IntegrationReadinessCheck, IntegrationReadinessSummary } from "@/lib/control-plane/types";
import { getBillingMode } from "@/lib/services/billing-mode";
import { getStripeClient } from "@/lib/services/stripe";

type TenantProbeInput = {
  accountId?: string;
  tenantId?: string;
  supabase?: {
    from: (table: string) => {
      select: (columns: string, options?: Record<string, unknown>) => any;
      eq: (column: string, value: unknown) => any;
      limit: (value: number) => any;
      maybeSingle: () => any;
    };
  } | null;
};

function envTrue(value: string | undefined) {
  return typeof value === "string" && ["1", "true", "on", "yes"].includes(value.toLowerCase());
}

function pass(name: string, required: boolean, message: string): IntegrationReadinessCheck {
  return { name, required, status: "pass", message };
}

function warn(name: string, required: boolean, message: string): IntegrationReadinessCheck {
  return { name, required, status: "warn", message };
}

function fail(name: string, required: boolean, message: string): IntegrationReadinessCheck {
  return { name, required, status: "fail", message };
}

function formatError(prefix: string, error: unknown) {
  return `${prefix}: ${error instanceof Error ? error.message : "unknown error"}.`;
}

function getStatus(checks: IntegrationReadinessCheck[]): IntegrationReadinessSummary["status"] {
  const hasFailure = checks.some((check) => check.required && check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warn");
  return hasFailure ? "fail" : hasWarning ? "warn" : "pass";
}

async function checkSupabaseRestAccess() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) {
    return fail("supabase", true, "Supabase REST credentials are missing.");
  }

  try {
    const url = new URL("/rest/v1/accounts?select=id&limit=1", baseUrl);
    const res = await fetch(url.toString(), {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      },
      cache: "no-store"
    });

    if (!res.ok) {
      return fail("supabase", true, `Supabase REST probe returned ${res.status}.`);
    }

    return pass("supabase", true, "Supabase REST access succeeded.");
  } catch (error) {
    return fail("supabase", true, formatError("Supabase REST probe failed", error));
  }
}

function checkWebhookSecret() {
  return process.env.WEBHOOK_SHARED_SECRET
    ? pass("webhook_secret", true, "Webhook shared secret is configured.")
    : warn("webhook_secret", true, "Webhook shared secret is not configured.");
}

function checkTwilio() {
  const configured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  if (envTrue(process.env.SB_DISABLE_TWILIO)) {
    return warn("twilio", false, "Twilio is explicitly disabled.");
  }
  if (!configured) {
    return warn("twilio", false, "Twilio is not fully configured.");
  }
  const safeMode = process.env.SB_TWILIO_SAFE_MODE;
  return pass("twilio", false, envTrue(safeMode || "true") ? "Twilio is configured in safe mode." : "Twilio is configured for live traffic.");
}

function checkHubSpot() {
  if (envTrue(process.env.SB_DISABLE_HUBSPOT)) {
    return warn("hubspot", false, "HubSpot is explicitly disabled.");
  }
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return warn("hubspot", false, "HubSpot is not configured.");
  }
  return pass(
    "hubspot",
    false,
    envTrue(process.env.SB_HUBSPOT_SAFE_MODE || "true") ? "HubSpot is configured in safe mode." : "HubSpot is configured for live sync."
  );
}

function checkSmartlead() {
  return process.env.SMARTLEAD_API_KEY
    ? pass("smartlead", false, "Smartlead is configured.")
    : warn("smartlead", false, "Smartlead is not configured.");
}

function checkInngest() {
  return process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY
    ? pass("inngest", false, "Inngest is configured.")
    : warn("inngest", false, "Inngest is not fully configured.");
}

function checkEnrichment() {
  const endpoint = process.env.SERVICE_BUTLER_ENRICHMENT_URL;
  if (!endpoint) {
    return warn("enrichment", false, "Premium enrichment provider is not configured.");
  }

  try {
    new URL(endpoint);
  } catch {
    return fail("enrichment", false, "Premium enrichment endpoint is not a valid URL.");
  }

  return pass("enrichment", false, "Premium enrichment provider is configured.");
}

function checkStripe() {
  const billingMode = getBillingMode();
  if (billingMode !== "stripe") {
    return warn("stripe", false, "Stripe is not required because billing is disabled.");
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

function checkV2Flags() {
  if (featureFlags.useV2Writes && featureFlags.useV2Reads) {
    return pass("v2_flags", true, "SB_USE_V2_WRITES and SB_USE_V2_READS are enabled.");
  }
  return fail("v2_flags", true, "Enable SB_USE_V2_WRITES and SB_USE_V2_READS for the acquisition-ready live path.");
}

async function checkTenantTables({ supabase, tenantId, accountId }: TenantProbeInput) {
  if (!supabase || !tenantId || !accountId) {
    return [
      warn("territories", false, "Tenant-specific readiness checks unavailable for the current request."),
      warn("data_sources", false, "Tenant-specific readiness checks unavailable for the current request."),
      warn("service_area", false, "Tenant-specific readiness checks unavailable for the current request.")
    ];
  }

  const [
    territoryResponse,
    sourceResponse,
    settingsResponse
  ] = await Promise.all([
    (supabase as any)
      .from("v2_territories")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("active", true),
    (supabase as any)
      .from("v2_data_sources")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    (supabase as any)
      .from("account_settings")
      .select("weather_location_label,weather_lat,weather_lng")
      .eq("account_id", accountId)
      .maybeSingle()
  ]);

  const checks: IntegrationReadinessCheck[] = [];

  if (territoryResponse.error) {
    checks.push(fail("territories", true, territoryResponse.error.message));
  } else if (Number(territoryResponse.count || 0) > 0) {
    checks.push(pass("territories", true, `Active territories: ${territoryResponse.count}.`));
  } else {
    checks.push(fail("territories", true, "No active territories configured."));
  }

  if (sourceResponse.error) {
    checks.push(fail("data_sources", true, sourceResponse.error.message));
  } else if (Number(sourceResponse.count || 0) > 0) {
    checks.push(pass("data_sources", true, `Active data sources: ${sourceResponse.count}.`));
  } else {
    checks.push(fail("data_sources", true, "No active data sources configured."));
  }

  const settings = settingsResponse.data || {};
  if (settingsResponse.error) {
    checks.push(fail("service_area", true, settingsResponse.error.message));
  } else if (settings?.weather_location_label && settings?.weather_lat != null && settings?.weather_lng != null) {
    checks.push(pass("service_area", true, `Service area set to ${String(settings.weather_location_label)}.`));
  } else {
    checks.push(fail("service_area", true, "Service area is not configured."));
  }

  return checks;
}

export async function buildIntegrationReadinessSummary(input: TenantProbeInput = {}): Promise<IntegrationReadinessSummary> {
  const checks: IntegrationReadinessCheck[] = [
    checkV2Flags(),
    await checkSupabaseRestAccess(),
    checkWebhookSecret(),
    checkTwilio(),
    checkHubSpot(),
    checkSmartlead(),
    checkInngest(),
    checkEnrichment(),
    checkStripe(),
    ...(await checkTenantTables(input))
  ];

  return {
    status: getStatus(checks),
    checkedAt: new Date().toISOString(),
    checks
  };
}
