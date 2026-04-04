#!/usr/bin/env node

const baseUrl = String(process.env.SCANNER_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const minCapturedSignals = Number(process.env.SCANNER_MIN_CAPTURED || 20);
const minVerifiedLeads = Number(process.env.SCANNER_MIN_VERIFIED_LEADS || 1);

async function readJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function main() {
  const runPayload = {
    mode: "live",
    marketScope: "nyc_li_burst",
    location: "NYC + Long Island",
    categories: ["restoration"],
    limit: 120,
    radius: 35
  };

  const run = await readJson(`${baseUrl}/api/scanner/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(runPayload)
  });

  const throughput = await readJson(`${baseUrl}/api/scanner/throughput`, {
    method: "GET"
  });

  const result = {
    runtime_mode: run.runtimeMode || "unknown",
    opportunities_returned: Array.isArray(run.opportunities) ? run.opportunities.length : 0,
    warnings: Array.isArray(run.warnings) ? run.warnings : [],
    throughput
  };

  console.log(JSON.stringify(result, null, 2));

  const capturedRealSignals = Number(throughput?.captured_real_signals || 0);
  const verifiedLeads = Number(throughput?.scanner_verified_leads_created || 0);

  if (capturedRealSignals < minCapturedSignals) {
    console.error(
      `scanner-burst-kpi threshold failed: captured_real_signals=${capturedRealSignals} (required >= ${minCapturedSignals})`
    );
    process.exit(1);
  }

  if (verifiedLeads < minVerifiedLeads) {
    console.error(
      `scanner-burst-kpi threshold failed: scanner_verified_leads_created=${verifiedLeads} (required >= ${minVerifiedLeads})`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
