#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_LINES = [
  "connector run",
  "opportunity created",
  "opportunity scored",
  "territory matched",
  "assignment created",
  "outreach sent",
  "webhook booked job received",
  "dashboard updated"
];

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFromFile(path.join(process.cwd(), ".env.local"));
loadEnvFromFile(path.join(process.cwd(), ".env"));

function envTrue(name) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function parseSupabaseHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function parseSupabasePort(url) {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(url) {
  const hostname = parseSupabaseHost(url);
  return hostname === "127.0.0.1" || hostname === "localhost";
}

async function isPortListening(host, port) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function canReachSupabase(supabase) {
  const { error } = await supabase.from("accounts").select("id", { head: true, count: "exact" }).limit(1);
  return !error;
}

function printSimulated() {
  console.log("[operator-test] mode=simulated");
  console.log("[operator-test] reason=missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  for (const line of REQUIRED_LINES) {
    console.log(`${line} (simulated)`);
  }
}

function runtimeMode() {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabase) {
    return {
      mode: "simulated",
      reasons: ["Supabase credentials missing"]
    };
  }

  const reasons = [];
  const hasPermitsSnapshot = Boolean(String(process.env.PERMITS_PROVIDER_SNAPSHOT_PATH || "").trim());
  const hasPermitsProvider = Boolean(String(process.env.PERMITS_PROVIDER_URL || "").trim()) || hasPermitsSnapshot;

  if (!envTrue("SB_USE_V2_WRITES")) reasons.push("SB_USE_V2_WRITES is not enabled");
  if (!envTrue("SB_USE_V2_READS")) reasons.push("SB_USE_V2_READS is not enabled");

  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  );
  const twilioDisabled = envTrue("SB_DISABLE_TWILIO");
  if (!twilioConfigured && !twilioDisabled) {
    reasons.push("Twilio is not configured and not explicitly disabled");
  }

  const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
  const hubspotDisabled = envTrue("SB_DISABLE_HUBSPOT");
  if (!hubspotConfigured && !hubspotDisabled) {
    reasons.push("HubSpot is not configured and not explicitly disabled");
  }

  if (!hasPermitsProvider) reasons.push("PERMITS_PROVIDER_URL or PERMITS_PROVIDER_SNAPSHOT_PATH not set (connector will run in synthetic mode)");
  if (!process.env.WEBHOOK_SHARED_SECRET) reasons.push("WEBHOOK_SHARED_SECRET not set");

  const inngestConfigured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
  if (!inngestConfigured) reasons.push("Inngest keys missing");

  return {
    mode: reasons.length === 0 ? "fully-live" : "live-partially-configured",
    reasons
  };
}

function scoreFromSeverity(severity) {
  const s = Math.max(0, Math.min(100, Number(severity || 50)));
  return {
    urgency: s,
    likelihood: Math.max(0, Math.min(100, Math.round(s * 0.85))),
    contactability: 60,
    sourceReliability: 75,
    catastrophe: Math.max(0, Math.min(100, Math.round(s * 0.8)))
  };
}

async function resolveOperatorTenantId(supabase) {
  const explicit = String(process.env.OPERATOR_TENANT_ID || "").trim();
  if (explicit) return explicit;
  const operatorTenantName = String(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group").trim();

  const { data, error } = await supabase
    .from("v2_tenants")
    .select("id")
    .eq("name", operatorTenantName)
    .eq("type", "franchise")
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) throw new Error(`Operator tenant not found (${operatorTenantName}). Run operator seed first.`);
  return String(data.id);
}

async function fetchPermitsSignal() {
  const providerUrl = String(process.env.PERMITS_PROVIDER_URL || "").trim();
  const providerToken = String(process.env.PERMITS_PROVIDER_TOKEN || "").trim();
  const snapshotPath = String(process.env.PERMITS_PROVIDER_SNAPSHOT_PATH || "").trim();
  const snapshotProvenance = String(process.env.PERMITS_PROVIDER_SOURCE_PROVENANCE || providerUrl || "").trim();

  if (snapshotPath) {
    const payload = readSnapshotJson(snapshotPath);
    const records = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.records)
        ? payload.records
        : Array.isArray(payload)
          ? payload
          : [];

    const first = records[0];
    if (first && typeof first === "object") {
      return {
        mode: "live_provider",
        record: first,
        sourceProvenance: snapshotProvenance || snapshotPath
      };
    }
  }

  if (!providerUrl) {
    return {
      mode: "synthetic",
      record: {
        id: `synthetic-${Date.now()}`,
        event_type: "permit_signal",
        title: "Synthetic permits signal",
        description: "Synthetic record used because PERMITS_PROVIDER_URL is not configured",
        occurred_at: new Date().toISOString(),
        location: "350 5th Ave, New York, NY 10118",
        latitude: 40.7484,
        longitude: -73.9857,
        severity: 77,
        service_line: "restoration",
        source_reliability: 72
      },
      sourceProvenance: "operator.synthetic.permits"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const headers = {
      accept: "application/json",
      ...(providerToken ? { authorization: `Bearer ${providerToken}` } : {})
    };

    const response = await fetch(providerUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal
    }).catch(() => null);

    const payload = response?.ok ? await response.json().catch(() => null) : await fetchJsonWithCurl({ providerUrl, providerToken });
    if (!response?.ok && !payload) {
      return {
        mode: "synthetic_fallback",
        record: {
          id: `fallback-${Date.now()}`,
          event_type: "permit_signal",
          title: "Fallback permits signal",
          description: `Permits provider returned ${response.status}; using fallback record`,
          occurred_at: new Date().toISOString(),
          location: "350 5th Ave, New York, NY 10118",
          latitude: 40.7484,
          longitude: -73.9857,
          severity: 74,
          service_line: "restoration",
          source_reliability: 68
        },
        sourceProvenance: providerUrl
      };
    }

    const records = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.records)
        ? payload.records
        : payload && typeof payload === "object"
          ? (() => {
              const firstArray = Object.values(payload).find((value) => Array.isArray(value));
              return Array.isArray(firstArray) ? firstArray : [];
            })()
        : Array.isArray(payload)
          ? payload
          : [];

    const first = records[0];
    if (!first || typeof first !== "object") {
      return {
        mode: "synthetic_fallback",
        record: {
          id: `empty-${Date.now()}`,
          event_type: "permit_signal",
          title: "Empty provider payload fallback",
          description: "Provider returned no records; using fallback record",
          occurred_at: new Date().toISOString(),
          location: "350 5th Ave, New York, NY 10118",
          latitude: 40.7484,
          longitude: -73.9857,
          severity: 70,
          service_line: "restoration",
          source_reliability: 65
        },
        sourceProvenance: providerUrl
      };
    }

    return {
      mode: "live_provider",
      record: first,
      sourceProvenance: providerUrl
    };
  } catch {
    return {
      mode: "synthetic_fallback",
      record: {
        id: `error-${Date.now()}`,
        event_type: "permit_signal",
        title: "Provider error fallback",
        description: "Provider fetch failed; using fallback record",
        occurred_at: new Date().toISOString(),
        location: "350 5th Ave, New York, NY 10118",
        latitude: 40.7484,
        longitude: -73.9857,
        severity: 72,
        service_line: "restoration",
        source_reliability: 64
      },
      sourceProvenance: providerUrl || "operator.synthetic.permits"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithCurl({ providerUrl, providerToken }) {
  const args = ["-sS", "--max-time", "8", "-H", "accept: application/json"];
  if (providerToken) {
    args.push("-H", `authorization: Bearer ${providerToken}`);
  }
  args.push(providerUrl);

  const result = spawnSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function readSnapshotJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeFreshnessScore(occurredAt) {
  const ts = new Date(String(occurredAt || "")).getTime();
  if (!Number.isFinite(ts)) return 0;
  const ageHours = Math.max(0, (Date.now() - ts) / 3_600_000);
  return Math.max(0, Math.min(100, Math.round(100 - ageHours * 5)));
}

function textField(...values) {
  for (const value of values) {
    if (value && typeof value === "object") continue;
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function inferServiceLine(record) {
  const text = `${textField(record.service_line, record.service_name, record.complaint_type, record.descriptor, record.title, record.description)}`.toLowerCase();
  if (text.includes("plumb") || text.includes("pipe") || text.includes("sewer") || text.includes("leak")) return "plumbing";
  if (text.includes("roof") || text.includes("hail")) return "roofing";
  if (text.includes("heat") || text.includes("hvac") || text.includes("ac") || text.includes("air conditioning")) return "hvac";
  if (text.includes("streamflow") || text.includes("gage") || text.includes("flood") || text.includes("storm")) return "restoration";
  if (text.includes("fire") || text.includes("smoke") || text.includes("flood") || text.includes("water")) return "restoration";
  return "restoration";
}

function locationFromRecord(record) {
  const locationObj = record.location && typeof record.location === "object" ? record.location : null;
  const designatedArea = textField(record.designatedArea).toLowerCase();
  const suffolkHint = designatedArea.includes("suffolk");
  const lat = toNumber(
    record.latitude ??
      record.lat ??
      locationObj?.latitude ??
      locationObj?.lat ??
      locationObj?.y ??
      record.sourceInfo?.geoLocation?.geogLocation?.latitude,
    suffolkHint ? 40.869 : 40.7484
  );
  const lng = toNumber(
    record.longitude ??
      record.long ??
      locationObj?.longitude ??
      locationObj?.lng ??
      locationObj?.x ??
      record.sourceInfo?.geoLocation?.geogLocation?.longitude,
    suffolkHint ? -72.941 : -73.9857
  );

  const line1 = textField(
    record.location,
    record.address,
    record.incident_address,
    record.street_address,
    record.property_address,
    record.designatedArea,
    record.sourceInfo?.siteName
  );
  const city = textField(record.city, record.borough, suffolkHint ? "Ronkonkoma" : "New York");
  const state = textField(record.state, "NY");
  const postal = textField(record.postal_code, record.zip, record.incident_zip, suffolkHint ? "11779" : "10001");
  const locationText = line1 ? `${line1}, ${city}, ${state} ${postal}` : `350 5th Ave, ${city}, ${state} ${postal}`;

  return { lat, lng, locationText, city, state, postal };
}

async function main() {
  const mode = runtimeMode();

  if (mode.mode === "simulated") {
    printSimulated();
    return;
  }

  console.log(`[operator-test] mode=${mode.mode}`);
  if (mode.reasons.length > 0) {
    for (const reason of mode.reasons) {
      console.log(`[operator-test] config-note: ${reason}`);
    }
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  if (!(await canReachSupabase(supabase))) {
    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const host = parseSupabaseHost(supabaseUrl);
    const port = parseSupabasePort(supabaseUrl);
    const localDbDown = isLocalSupabaseUrl(supabaseUrl) && host && port !== null && !(await isPortListening(host, port));

    throw new Error(
      localDbDown
        ? "Local Supabase is not reachable. Start it with `npm run db:start`, run `npm run db:push`, then retry `npm run operator:seed` and `npm run operator-test`."
        : "Operator test could not reach Supabase. Confirm the configured URL/key pair and that the target project is reachable."
    );
  }

  const tenantId = await resolveOperatorTenantId(supabase);

  const { data: source, error: sourceError } = await supabase
    .from("v2_data_sources")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source_type", "permits")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sourceError) throw new Error(sourceError.message);

  const sourceId = source?.id || null;
  if (!sourceId) throw new Error("Permits source missing. Run operator seed first.");

  const pulled = await fetchPermitsSignal();
  console.log(`[operator-test] connector-input-mode=${pulled.mode}`);
  if (envTrue("SB_REQUIRE_LIVE_PROVIDER_PROOF") && pulled.mode !== "live_provider") {
    throw new Error(`Live-provider proof required, but connector input mode was ${pulled.mode}`);
  }

  const runId = randomUUID();
  const nowIso = new Date().toISOString();

  const { error: runError } = await supabase.from("v2_connector_runs").insert({
    id: runId,
    source_id: sourceId,
    tenant_id: tenantId,
    status: "completed",
    started_at: new Date(Date.now() - 25_000).toISOString(),
    completed_at: nowIso,
    records_seen: 1,
    records_created: 1,
    metadata: {
      mode: mode.mode,
      connector_input_mode: pulled.mode,
      source_provenance: pulled.sourceProvenance,
      connector_version: "operator-test-2"
    }
  });

  if (runError) throw new Error(runError.message);
  console.log("connector run");

  const record = pulled.record;
  const occurredAt = new Date(
    String(record.occurred_at || record.issued_at || record.requested_datetime || record.created_date || record.created_at || nowIso)
  ).toISOString();
  const { lat, lng, locationText, city, state, postal } = locationFromRecord(record);
  const severity = toNumber(record.severity, 75);
  const sourceReliability = toNumber(record.source_reliability, 72);
  const serviceLine = inferServiceLine(record);
  const title = textField(
    record.title,
    record.permit_type,
    record.service_name,
    record.complaint_type,
    record.descriptor,
    record.incidentType,
    record.sourceInfo?.siteName,
    "Operator pilot opportunity"
  );
  const description = textField(
    record.description,
    record.declarationTitle,
    record.incidentType,
    record.variable?.variableName,
    record.status_notes,
    record.resolution_description,
    record.descriptor,
    "Operator test generated opportunity"
  );

  const sourceEventId = randomUUID();
  const scores = scoreFromSeverity(severity);

  const { error: sourceEventError } = await supabase.from("v2_source_events").insert({
    id: sourceEventId,
    source_id: sourceId,
    tenant_id: tenantId,
    connector_run_id: runId,
    occurred_at: occurredAt,
    ingested_at: nowIso,
    raw_payload: record,
    normalized_payload: {
      source_provenance: pulled.sourceProvenance,
      connector_version: "operator-test-2",
      terms_status: String(process.env.PERMITS_TERMS_STATUS || "approved"),
      data_freshness_score: computeFreshnessScore(occurredAt),
      city,
      state,
      postal_code: postal
    },
    location_text: locationText,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    confidence_score: severity,
    source_reliability_score: sourceReliability,
    compliance_status: "approved",
    dedupe_key: `operator-test|${runId}`,
    event_type: String(record.event_type || "permit_signal")
  });

  if (sourceEventError) throw new Error(sourceEventError.message);

  const opportunityId = randomUUID();
  const { error: opportunityError } = await supabase.from("v2_opportunities").insert({
    id: opportunityId,
    tenant_id: tenantId,
    source_event_id: sourceEventId,
    opportunity_type: String(record.event_type || "permit_signal"),
    service_line: serviceLine,
    title,
    description,
    urgency_score: scores.urgency,
    job_likelihood_score: scores.likelihood,
    contactability_score: scores.contactability,
    source_reliability_score: sourceReliability,
    revenue_band: "high",
    catastrophe_linkage_score: scores.catastrophe,
    location_text: locationText,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    postal_code: postal,
    contact_status: "unknown",
    routing_status: "pending",
    lifecycle_status: "new",
    explainability_json: {
      operator_test: true,
      mode: mode.mode,
      connector_input_mode: pulled.mode,
      contact_proof: "synthetic_test_only"
    }
  });

  if (opportunityError) throw new Error(opportunityError.message);
  console.log("opportunity created");

  const { error: scoringUpdateError } = await supabase
    .from("v2_opportunities")
    .update({
      job_likelihood_score: Math.max(scores.likelihood, 70),
      explainability_json: {
        operator_test: true,
        rescored: true,
        mode: mode.mode,
        connector_input_mode: pulled.mode
      }
    })
    .eq("id", opportunityId);

  if (scoringUpdateError) throw new Error(scoringUpdateError.message);
  console.log("opportunity scored");

  let matchedTerritoryId = null;
  const usePolygon = envTrue("SB_USE_POLYGON_ROUTING");

  if (usePolygon) {
    const { data: match, error } = await supabase.rpc("match_territory_by_point", {
      p_tenant_id: tenantId,
      p_lat: lat,
      p_lng: lng,
      p_service_line: serviceLine
    });

    if (error) throw new Error(error.message);
    matchedTerritoryId = match?.[0]?.territory_id || null;
  }

  if (!matchedTerritoryId) {
    const { data: zipMatch, error } = await supabase
      .from("v2_territories")
      .select("id")
      .eq("tenant_id", tenantId)
      .contains("zip_codes", [postal])
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    matchedTerritoryId = zipMatch?.id || null;
  }

  if (!matchedTerritoryId) throw new Error("Territory match failed");
  console.log("territory matched");

  const assignmentId = randomUUID();
  const { error: assignmentError } = await supabase.from("v2_assignments").insert({
    id: assignmentId,
    tenant_id: tenantId,
    opportunity_id: opportunityId,
    assigned_tenant_id: tenantId,
    backup_tenant_id: null,
    escalation_tenant_id: tenantId,
    assignment_reason: usePolygon ? "polygon_match" : "zip_match",
    status: "pending_acceptance",
    assigned_at: new Date().toISOString(),
    sla_due_at: new Date(Date.now() + 45 * 60_000).toISOString(),
    metadata: { operator_test: true, territory_id: matchedTerritoryId, mode: mode.mode }
  });

  if (assignmentError) throw new Error(assignmentError.message);
  console.log("assignment created");

  const leadId = randomUUID();
  const { error: leadError } = await supabase.from("v2_leads").insert({
    id: leadId,
    tenant_id: tenantId,
    opportunity_id: opportunityId,
    contact_name: "Operator Pilot Contact",
    contact_channels_json: {
      verification_status: "rejected",
      verification_score: 0,
      verification_reasons: ["operator test synthetic contact"],
      contact_provenance: "operator_test"
    },
    property_address: locationText,
    city,
    state,
    postal_code: postal,
    lead_status: "research_required",
    crm_sync_status: "not_synced",
    do_not_contact: true
  });

  if (leadError) throw new Error(leadError.message);

  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  );
  const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);

  const { error: outreachError } = await supabase.from("v2_outreach_events").insert([
    {
      tenant_id: tenantId,
      lead_id: leadId,
      assignment_id: assignmentId,
      channel: "sms",
      event_type: "sent",
      sent_at: new Date().toISOString(),
      outcome: twilioConfigured ? "sent_via_twilio" : "twilio_not_configured",
      provider_message_id: `operator-sms-${runId}`,
      metadata: { mode: mode.mode }
    },
    {
      tenant_id: tenantId,
      lead_id: leadId,
      assignment_id: assignmentId,
      channel: "crm_task",
      event_type: "sent",
      sent_at: new Date().toISOString(),
      outcome: hubspotConfigured ? "hubspot_task_created" : "hubspot_not_configured",
      provider_message_id: `operator-crm-${runId}`,
      metadata: { mode: mode.mode }
    }
  ]);

  if (outreachError) throw new Error(outreachError.message);
  console.log("outreach sent");

  const jobId = randomUUID();
  const { error: jobError } = await supabase.from("v2_jobs").upsert(
    {
      id: jobId,
      tenant_id: tenantId,
      lead_id: leadId,
      external_crm_id: `operator-crm-${runId}`,
      job_type: serviceLine,
      booked_at: new Date().toISOString(),
      scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
      revenue_amount: 5200,
      status: "booked"
    },
    { onConflict: "id" }
  );

  if (jobError) throw new Error(jobError.message);

  const { error: attributionError } = await supabase.from("v2_job_attributions").upsert(
    {
      tenant_id: tenantId,
      job_id: jobId,
      primary_opportunity_id: opportunityId,
      source_event_id: sourceEventId,
      attribution_confidence: 90,
      locked: true
    },
    { onConflict: "job_id" }
  );

  if (attributionError) throw new Error(attributionError.message);
  console.log("webhook booked job received");

  const { count, error: dashboardError } = await supabase
    .from("v2_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "booked");

  if (dashboardError) throw new Error(dashboardError.message);
  if (!Number.isFinite(count) || Number(count || 0) < 1) {
    throw new Error("Dashboard read model check failed");
  }

  console.log("dashboard updated");
}

main().catch((error) => {
  if (error instanceof Error && error.message.includes("Local Supabase is not reachable")) {
    console.error(error.message);
    process.exit(1);
  }

  if (error instanceof Error && error.message.includes("Operator test could not reach Supabase")) {
    console.error(error.message);
    process.exit(1);
  }

  if (error instanceof TypeError && error.message === "fetch failed") {
    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const host = parseSupabaseHost(supabaseUrl);
    const port = parseSupabasePort(supabaseUrl);

    const finish = async () => {
      const localDbDown = isLocalSupabaseUrl(supabaseUrl) && host && port !== null && !(await isPortListening(host, port));
      if (localDbDown) {
        console.error("Local Supabase is not reachable. Start it with `npm run db:start`, run `npm run db:push`, then retry `npm run operator:seed` and `npm run operator-test`.");
      } else {
        console.error("Operator test could not reach Supabase. Confirm the configured URL/key pair and that the target project is reachable.");
      }
      process.exit(1);
    };

    finish().catch(() => {
      console.error("Operator test could not reach Supabase. Confirm the configured URL/key pair and that the target project is reachable.");
      process.exit(1);
    });
    return;
  }

  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
