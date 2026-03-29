#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

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

function run(command, args, env, options = {}) {
  try {
    execFileSync(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env }
    });
    return true;
  } catch (error) {
    if (options.allowFailure) {
      console.warn(`Non-blocking step failed: ${command} ${args.join(" ")}`);
      return false;
    }
    throw error;
  }
}

function printHeader(label) {
  console.log(`\n=== ${label} ===`);
}

const cwd = process.cwd();
loadEnvFromFile(path.join(cwd, ".env.local"));
loadEnvFromFile(path.join(cwd, ".env"));

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!supabaseUrl || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const baseEnv = {
  OPERATOR_PROFILE: "suffolk_restoration",
  OPERATOR_TENANT_NAME: "Suffolk Restoration Group",
  SB_USE_V2_WRITES: "true",
  SB_USE_V2_READS: "true",
  SB_DISABLE_TWILIO: "true",
  SB_DISABLE_HUBSPOT: "true",
  WEBHOOK_SHARED_SECRET: process.env.WEBHOOK_SHARED_SECRET || "local-dev-secret"
};

if (String(process.env.SB_SUFFOLK_SKIP_SEED || "").trim().toLowerCase() === "true") {
  printHeader("Skip Suffolk Seed");
  console.log("SB_SUFFOLK_SKIP_SEED=true, using the existing Suffolk tenant if present.");
} else {
  printHeader("Seed Suffolk Operator");
  run("npm", ["run", "operator:seed"], baseEnv);
}

const femaBase =
  "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state%20eq%20%27NY%27%20and%20designatedArea%20eq%20%27Suffolk%20(County)%27&$orderby=declarationDate%20desc";

const providerUrls = [
  `${femaBase}&$top=1&$skip=0`,
  `${femaBase}&$top=1&$skip=1`,
  "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01304500,01308000&parameterCd=00065,00060&siteStatus=all"
];

for (const providerUrl of providerUrls) {
  printHeader(`Run Operator Test Source: ${providerUrl}`);
  run("node", ["scripts/operator-test.mjs"], { ...baseEnv, PERMITS_PROVIDER_URL: providerUrl }, { allowFailure: true });
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: tenant, error: tenantError } = await supabase
  .from("v2_tenants")
  .select("id")
  .eq("name", "Suffolk Restoration Group")
  .eq("type", "franchise")
  .limit(1)
  .maybeSingle();

if (tenantError || !tenant?.id) {
  console.error("Could not resolve Suffolk operator tenant after seed.");
  process.exit(1);
}

const tenantId = String(tenant.id);

const { data: leads, error: leadsError } = await supabase
  .from("v2_leads")
  .select("id,opportunity_id,created_at")
  .eq("tenant_id", tenantId)
  .order("created_at", { ascending: false })
  .limit(20);

if (leadsError) {
  console.error(`Failed reading leads: ${leadsError.message}`);
  process.exit(1);
}

const liveRows = [];
for (const lead of leads || []) {
  const { data: opp } = await supabase
    .from("v2_opportunities")
    .select("source_event_id,title,opportunity_type,service_line")
    .eq("id", lead.opportunity_id)
    .maybeSingle();
  if (!opp?.source_event_id) continue;

  const { data: event } = await supabase
    .from("v2_source_events")
    .select("connector_run_id,normalized_payload")
    .eq("id", opp.source_event_id)
    .maybeSingle();
  if (!event?.connector_run_id) continue;

  const { data: runRow } = await supabase
    .from("v2_connector_runs")
    .select("metadata")
    .eq("id", event.connector_run_id)
    .maybeSingle();

  const mode = runRow?.metadata?.connector_input_mode || "unknown";
  if (mode !== "live_provider") continue;

  liveRows.push({
    lead_id: lead.id,
    created_at: lead.created_at,
    service_line: opp.service_line,
    title: opp.title,
    opportunity_type: opp.opportunity_type,
    source: event.normalized_payload?.source_provenance || "unknown"
  });
}

printHeader("Suffolk Live Lead Proof");
if (liveRows.length === 0) {
  console.error("No live_provider leads found. Verify source endpoints and rerun.");
  console.error("If Suffolk is already seeded, rerun with SB_SUFFOLK_SKIP_SEED=true to avoid reseeding.");
  process.exit(1);
}

for (const row of liveRows.slice(0, 12)) {
  console.log(
    [
      `lead_id=${row.lead_id}`,
      `created_at=${row.created_at}`,
      `service_line=${row.service_line || "restoration"}`,
      `title=${row.title || "untitled"}`,
      `opportunity_type=${row.opportunity_type || "signal"}`,
      `source=${row.source}`
    ].join(" | ")
  );
}

console.log(`\nLive leads generated: ${liveRows.length}`);
