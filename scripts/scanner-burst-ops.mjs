#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function loadEnvFromFile(filePath) {
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

function asText(value) {
  return String(value ?? "").trim();
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envTrue(name) {
  const value = asText(process.env[name]).toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function parseList(value, fallback) {
  const text = asText(value);
  if (!text) return [...fallback];
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveAppUrl() {
  const base = asText(process.env.SCANNER_BURST_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000");
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(`SCANNER_BURST_APP_URL/NEXT_PUBLIC_APP_URL must start with http:// or https:// (received: ${base || "<empty>"})`);
  }
  return base.replace(/\/+$/, "");
}

function splitSetCookieHeader(headerValue) {
  return String(headerValue)
    .split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractCookieHeader(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.has("set-cookie")
        ? splitSetCookieHeader(response.headers.get("set-cookie") || "")
        : [];

  return values
    .map((entry) => entry.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchJson(url, { method = "GET", headers = {}, body, timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal
    });
    const rawText = await response.text();
    const json = rawText ? safeJson(rawText) : null;

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: json,
      text: rawText
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function resolveAuthCookie(appUrl) {
  const manualCookie = asText(process.env.SCANNER_BURST_COOKIE);
  if (manualCookie) {
    return { cookie: manualCookie, mode: "manual-cookie" };
  }

  if (envTrue("DEMO_MODE") || envTrue("REVIEW_MODE")) {
    return { cookie: "", mode: "local-bypass" };
  }

  const loginResponse = await fetchJson(`${appUrl}/api/dev/quick-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email: asText(process.env.SCANNER_BURST_EMAIL || "owner@servicebutler.local")
    }),
    timeoutMs: 15_000
  });

  if (!loginResponse.ok) {
    const detail = loginResponse.data?.error || loginResponse.text || `${loginResponse.status} ${loginResponse.statusText}`;
    throw new Error(
      `Unable to establish local auth for scanner burst ops (${detail}). Run the app in DEMO_MODE/REVIEW_MODE or set SCANNER_BURST_COOKIE.`
    );
  }

  const cookie = extractCookieHeader({ headers: loginResponse.headers });
  if (!cookie) {
    throw new Error("Dev quick login succeeded but did not return session cookies. Set SCANNER_BURST_COOKIE or run in DEMO_MODE/REVIEW_MODE.");
  }

  return { cookie, mode: "dev-quick-login" };
}

function printRunSummary(result) {
  console.log("\nScanner burst summary");
  console.log(`mode=${String(result.mode || "unknown")}`);
  console.log(`requested_mode=${String(result.requestedMode || "unknown")}`);
  console.log(`runtime_mode=${String(result.runtimeMode || "unknown")}`);
  console.log(`opportunities_returned=${Array.isArray(result.opportunities) ? result.opportunities.length : 0}`);
  if (result.locationResolved?.label) {
    console.log(`location=${String(result.locationResolved.label)}`);
  }

  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  if (warnings.length > 0) {
    console.log("warnings:");
    for (const warning of warnings) {
      console.log(`- ${String(warning)}`);
    }
  }
}

function printThroughputSummary(summary) {
  console.log("\n24h KPI summary");
  console.log(`window_hours=${Number(summary.window_hours || 24)}`);
  console.log(`captured_real_signals=${Number(summary.captured_real_signals || 0)}`);
  console.log(`qualified_contactable_signals=${Number(summary.qualified_contactable_signals || 0)}`);
  console.log(`research_only_signals=${Number(summary.research_only_signals || 0)}`);
  console.log(`scanner_verified_leads_created=${Number(summary.scanner_verified_leads_created || 0)}`);
  if (summary.warning) {
    console.log(`warning=${String(summary.warning)}`);
  }
}

async function main() {
  loadEnvFromFile(path.join(process.cwd(), ".env.local"));
  loadEnvFromFile(path.join(process.cwd(), ".env"));

  const appUrl = resolveAppUrl();
  const auth = await resolveAuthCookie(appUrl);
  const headers = {
    accept: "application/json",
    ...(auth.cookie ? { cookie: auth.cookie } : {})
  };

  const payload = {
    mode: "live",
    marketScope: "nyc_li_burst",
    location: asText(process.env.SCANNER_BURST_LOCATION || "NYC + Long Island"),
    categories: parseList(process.env.SCANNER_BURST_CATEGORIES, ["restoration"]),
    limit: Math.max(20, Math.min(200, asNumber(process.env.SCANNER_BURST_LIMIT, 80))),
    radius: Math.max(1, Math.min(100, asNumber(process.env.SCANNER_BURST_RADIUS, 25)))
  };

  console.log(`[scanner-burst-ops] app=${appUrl}`);
  console.log(`[scanner-burst-ops] auth=${auth.mode}`);
  console.log(`[scanner-burst-ops] market_scope=${payload.marketScope}`);
  console.log(`[scanner-burst-ops] limit=${payload.limit}`);
  console.log(`[scanner-burst-ops] radius=${payload.radius}`);
  console.log(`[scanner-burst-ops] categories=${payload.categories.join(",")}`);

  const runResponse = await fetchJson(`${appUrl}/api/scanner/run`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    timeoutMs: 120_000
  });

  if (!runResponse.ok || !runResponse.data) {
    const detail = runResponse.data?.error || runResponse.text || `${runResponse.status} ${runResponse.statusText}`;
    throw new Error(`Scanner burst API failed (${detail}).`);
  }

  printRunSummary(runResponse.data);

  const throughputResponse = await fetchJson(`${appUrl}/api/scanner/throughput`, {
    headers,
    timeoutMs: 20_000
  });

  if (!throughputResponse.ok || !throughputResponse.data) {
    const detail = throughputResponse.data?.error || throughputResponse.text || `${throughputResponse.status} ${throughputResponse.statusText}`;
    throw new Error(`Scanner throughput API failed (${detail}).`);
  }

  const summary = throughputResponse.data;
  printThroughputSummary(summary);

  const capturedRealSignals = Number(summary.captured_real_signals || 0);
  const verifiedLeadsCreated = Number(summary.scanner_verified_leads_created || 0);
  const failures = [];

  if (capturedRealSignals < 20) {
    failures.push(`captured_real_signals is below threshold (${capturedRealSignals} < 20)`);
  }

  if (verifiedLeadsCreated < 1) {
    failures.push(`scanner_verified_leads_created is below threshold (${verifiedLeadsCreated} < 1)`);
  }

  if (failures.length > 0) {
    console.error("\n[scanner-burst-ops] FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("\n[scanner-burst-ops] PASS");
}

main().catch((error) => {
  console.error(`[scanner-burst-ops] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
