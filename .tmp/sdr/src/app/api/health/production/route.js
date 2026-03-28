"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const billing_mode_1 = require("@/lib/services/billing-mode");
const stripe_1 = require("@/lib/services/stripe");
exports.dynamic = "force-dynamic";
async function GET() {
    const checks = await runReadinessChecks();
    const hasFailure = checks.some((check) => check.required && check.status === "fail");
    const hasWarning = checks.some((check) => check.status === "warn");
    return server_1.NextResponse.json({
        status: hasFailure ? "fail" : hasWarning ? "warn" : "pass",
        checkedAt: new Date().toISOString(),
        checks
    }, {
        status: hasFailure ? 503 : 200,
        headers: {
            "cache-control": "no-store"
        }
    });
}
async function runReadinessChecks() {
    const billingMode = (0, billing_mode_1.getBillingMode)();
    const checks = [
        checkAppUrl(),
        checkDemoModeSafety(),
        checkSupabaseEnv(),
        await checkSupabaseAuthHealth(),
        await checkSupabaseRestAccess(),
        checkBillingModeConfig(billingMode),
        checkStripeConfig(billingMode),
        checkEnrichmentConfig(),
        checkEmailConfig(),
        checkTwilioConfig(),
        checkSmartleadConfig(),
        checkInngestConfig()
    ];
    return checks;
}
function checkAppUrl() {
    const value = process.env.NEXT_PUBLIC_APP_URL;
    if (!value) {
        return fail("app_url", true, "NEXT_PUBLIC_APP_URL is missing.");
    }
    try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) {
            return fail("app_url", true, "NEXT_PUBLIC_APP_URL must use http or https.");
        }
        return pass("app_url", true, "Public app URL is configured.");
    }
    catch {
        return fail("app_url", true, "NEXT_PUBLIC_APP_URL is not a valid URL.");
    }
}
function checkDemoModeSafety() {
    const demoEnabled = flagEnabled(process.env.DEMO_MODE);
    const allowNonDevDemo = flagEnabled(process.env.ALLOW_NON_DEV_DEMO_MODE);
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
function checkSupabaseEnv() {
    const requiredKeys = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
    ];
    const missing = requiredKeys.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        return fail("supabase_env", true, `Missing Supabase env vars: ${missing.join(", ")}.`);
    }
    return pass("supabase_env", true, "Supabase environment variables are present.");
}
async function checkSupabaseAuthHealth() {
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
    }
    catch (error) {
        return fail("supabase_auth", true, formatError("Supabase auth health failed", error));
    }
}
async function checkSupabaseRestAccess() {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) {
        return fail("supabase_rest", true, "Supabase REST credentials are missing.");
    }
    try {
        const url = new URL("/rest/v1/accounts?select=id&limit=1", baseUrl);
        const res = await fetchWithTimeout(url.toString(), {
            headers: {
                apikey: serviceRoleKey,
                authorization: `Bearer ${serviceRoleKey}`
            }
        });
        if (!res.ok) {
            return fail("supabase_rest", true, `Supabase REST probe returned ${res.status}.`);
        }
        return pass("supabase_rest", true, "Supabase REST access succeeded.");
    }
    catch (error) {
        return fail("supabase_rest", true, formatError("Supabase REST probe failed", error));
    }
}
function checkBillingModeConfig(billingMode) {
    if (billingMode === "stripe") {
        return pass("billing_mode", true, "Billing mode is set to stripe.");
    }
    return warn("billing_mode", true, "Billing mode is disabled.");
}
function checkStripeConfig(billingMode) {
    if (billingMode !== "stripe") {
        return warn("stripe", false, "Stripe is not required because billing mode is disabled.");
    }
    const missing = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"].filter((key) => !process.env[key]);
    if (missing.length > 0) {
        return fail("stripe", true, `Missing Stripe env vars: ${missing.join(", ")}.`);
    }
    try {
        (0, stripe_1.getStripeClient)();
        return pass("stripe", true, "Stripe client initialized.");
    }
    catch (error) {
        return fail("stripe", true, formatError("Stripe initialization failed", error));
    }
}
function checkEnrichmentConfig() {
    const endpoint = process.env.SERVICE_BUTLER_ENRICHMENT_URL;
    if (!endpoint) {
        return warn("enrichment", false, "Premium enrichment provider is not configured. Public-record enrichment will still work.");
    }
    try {
        new URL(endpoint);
    }
    catch {
        return fail("enrichment", false, "SERVICE_BUTLER_ENRICHMENT_URL is not a valid URL.");
    }
    return pass("enrichment", false, "Premium enrichment provider is configured.");
}
function checkEmailConfig() {
    const fromEmail = process.env.FROM_EMAIL;
    const hasProvider = Boolean(process.env.POSTMARK_SERVER_TOKEN || process.env.SENDGRID_API_KEY);
    if (!fromEmail || !hasProvider) {
        return warn("email", false, "Email provider is incomplete. Configure FROM_EMAIL plus Postmark or SendGrid for outbound email.");
    }
    return pass("email", false, "Email provider is configured.");
}
function checkTwilioConfig() {
    const keys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"];
    const configured = keys.every((key) => Boolean(process.env[key]));
    if (!configured) {
        return warn("twilio", false, "Twilio is not fully configured.");
    }
    return pass("twilio", false, "Twilio is configured.");
}
function checkSmartleadConfig() {
    if (!process.env.SMARTLEAD_API_KEY) {
        return warn("smartlead", false, "Smartlead is not configured.");
    }
    return pass("smartlead", false, "Smartlead is configured.");
}
function checkInngestConfig() {
    const configured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
    if (!configured) {
        return warn("inngest", false, "Inngest is not fully configured.");
    }
    return pass("inngest", false, "Inngest is configured.");
}
async function fetchWithTimeout(url, init, timeoutMs = 3500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            cache: "no-store",
            signal: controller.signal
        });
    }
    finally {
        clearTimeout(timeout);
    }
}
function flagEnabled(value) {
    return typeof value === "string" && ["1", "true", "on", "yes"].includes(value.toLowerCase());
}
function formatError(prefix, error) {
    return `${prefix}: ${error instanceof Error ? error.message : "unknown error"}.`;
}
function pass(name, required, message) {
    return { name, required, status: "pass", message };
}
function warn(name, required, message) {
    return { name, required, status: "warn", message };
}
function fail(name, required, message) {
    return { name, required, status: "fail", message };
}
