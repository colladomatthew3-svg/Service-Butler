#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SYNTHETIC_PATTERNS = [/synthetic/i, /simulated/i, /\bdemo\b/i, /placeholder/i, /operator\.synthetic/i];
const LIVE_PROVIDER_PATTERNS = [
  /api\.weather\.gov/i,
  /fema\.gov\/api\/open/i,
  /waterservices\.usgs\.gov/i,
  /api\.census\.gov/i,
  /geocoding\.geo\.census\.gov/i,
  /overpass-api/i,
  /data\.cityofnewyork\.us/i,
  /socrata/i,
  /\bopen311\b/i
];
const LIVE_DERIVED_PATTERNS = [/open-meteo/i, /forecast model/i, /forecast \+/i, /cluster/i];
const LIVE_PROVIDER_KEYS = new Set(["weather.noaa", "water.usgs", "open311.generic", "disaster.openfema", "enrichment.census", "property.overpass"]);

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

function asText(value) {
  return String(value ?? "").trim();
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function matchesAny(patterns, values) {
  return values.some((value) => patterns.some((pattern) => pattern.test(value)));
}

function classifyProofAuthenticity({ sourceType, sourceName, sourceProvenance, normalizedPayload, connectorRunMetadata }) {
  const normalized = asRecord(normalizedPayload);
  const metadata = asRecord(connectorRunMetadata);
  const connectorInputMode = asText(metadata.connector_input_mode).toLowerCase();
  const connectorKey = asText(normalized.connector_key || normalized.platform || normalized.source_type || sourceType).toLowerCase();
  const values = [
    asText(sourceType),
    asText(sourceName),
    asText(sourceProvenance),
    asText(normalized.source_provenance),
    asText(normalized.provider),
    asText(normalized.connector_name),
    asText(normalized.connector_key),
    asText(normalized.platform)
  ].filter(Boolean);

  if (connectorInputMode === "live_provider") return "live_provider";
  if (connectorInputMode === "synthetic" || connectorInputMode === "synthetic_fallback") return "synthetic";
  if (matchesAny(SYNTHETIC_PATTERNS, values)) return "synthetic";
  if (LIVE_PROVIDER_KEYS.has(connectorKey)) return "live_provider";
  if (matchesAny(LIVE_PROVIDER_PATTERNS, values)) return "live_provider";
  if (matchesAny(LIVE_DERIVED_PATTERNS, values)) return "live_derived";
  if (connectorKey.includes("forecast") || connectorKey.includes("scanner_signal")) return "live_derived";
  return "unknown";
}

function leadVerificationSnapshot(row) {
  const channels = asRecord(row.contact_channels_json);
  const verificationStatus = asText(channels.verification_status || row.lead_status || "").toLowerCase();
  const verificationScore = Number(channels.verification_score || 0) || 0;
  const phone = asText(channels.phone || "");
  const email = asText(channels.email || "");
  const contactable = Boolean(phone || email);
  const verified = verificationStatus === "verified" && verificationScore >= 70 && contactable;
  const review = verificationStatus === "review" || (!verified && contactable && verificationScore >= 45);
  return {
    verified,
    review,
    contactable,
    verificationStatus,
    verificationScore,
    phone,
    email
  };
}

function issue(level, label, detail) {
  return { level, label, detail };
}

function printMetric(label, value) {
  console.log(`${label}=${value}`);
}

function isOperatorTestArtifact(metadata) {
  return Boolean(asRecord(metadata).operator_test);
}

loadEnvFromFile(path.join(process.cwd(), ".env.local"));
loadEnvFromFile(path.join(process.cwd(), ".env"));

const supabaseUrl = asText(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceRole = asText(process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!supabaseUrl || !serviceRole) {
  console.error("real-lead-qualification=FAIL");
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const lookbackDays = Math.max(1, Number(process.env.REAL_LEAD_LOOKBACK_DAYS || 14) || 14);
const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
const tenantName = asText(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group");
const explicitTenantId = asText(process.env.OPERATOR_TENANT_ID);

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: tenant, error: tenantError } = explicitTenantId
  ? { data: { id: explicitTenantId, name: tenantName }, error: null }
  : await supabase
      .from("v2_tenants")
      .select("id,name")
      .eq("name", tenantName)
      .eq("type", "franchise")
      .limit(1)
      .maybeSingle();

if (tenantError || !tenant?.id) {
  console.error("real-lead-qualification=FAIL");
  console.error(`Operator tenant not found (${tenantName})`);
  process.exit(1);
}

const tenantId = asText(tenant.id);

const [
  { data: sourceEvents, error: sourceEventError },
  { data: dataSources, error: dataSourcesError },
  { data: connectorRuns, error: connectorRunError },
  { data: opportunities, error: opportunityError },
  { data: leads, error: leadsError },
  { data: jobs, error: jobsError },
  { data: outreachEvents, error: outreachError }
] = await Promise.all([
  supabase
    .from("v2_source_events")
    .select("id,source_id,connector_run_id,normalized_payload,occurred_at,ingested_at,event_type")
    .eq("tenant_id", tenantId)
    .order("ingested_at", { ascending: false })
    .limit(500),
  supabase
    .from("v2_data_sources")
    .select("id,name,source_type,provenance")
    .eq("tenant_id", tenantId)
    .limit(100),
  supabase
    .from("v2_connector_runs")
    .select("id,status,completed_at,records_seen,records_created,metadata")
    .eq("tenant_id", tenantId)
    .order("completed_at", { ascending: false })
    .limit(300),
  supabase
    .from("v2_opportunities")
    .select("id,source_event_id,title,contact_status,lifecycle_status,created_at,explainability_json")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(400),
  supabase
    .from("v2_leads")
    .select("id,opportunity_id,lead_status,contact_channels_json,do_not_contact,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(400),
  supabase
    .from("v2_jobs")
    .select("id,lead_id,status,booked_at,revenue_amount,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(400),
  supabase
    .from("v2_outreach_events")
    .select("id,lead_id,channel,event_type,outcome,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500)
]);

for (const error of [sourceEventError, dataSourcesError, connectorRunError, opportunityError, leadsError, jobsError, outreachError]) {
  if (error) {
    console.error("real-lead-qualification=FAIL");
    console.error(error.message || "Failed reading qualification data");
    process.exit(1);
  }
}

const recentSourceEvents = (sourceEvents || []).filter((row) => {
  const timestamp = asText(row.occurred_at || row.ingested_at);
  return !timestamp || timestamp >= sinceIso;
});
const recentOpportunities = (opportunities || []).filter((row) => asText(row.created_at) >= sinceIso);
const recentLeads = (leads || []).filter((row) => asText(row.created_at) >= sinceIso);
const recentJobs = (jobs || []).filter((row) => asText(row.booked_at || row.created_at) >= sinceIso);
const recentOutreach = (outreachEvents || []).filter((row) => asText(row.created_at) >= sinceIso);

const connectorRunById = new Map((connectorRuns || []).map((row) => [asText(row.id), row]));
const sourceById = new Map((dataSources || []).map((row) => [asText(row.id), row]));
const opportunityById = new Map(recentOpportunities.map((row) => [asText(row.id), row]));
const sourceEventById = new Map(recentSourceEvents.map((row) => [asText(row.id), row]));
const operatorTestSourceEventIds = new Set(
  recentOpportunities
    .filter((row) => Boolean(asRecord(row.explainability_json).operator_test))
    .map((row) => asText(row.source_event_id))
    .filter(Boolean)
);

const eventAuthenticityRows = recentSourceEvents.map((row) => ({
  ...row,
  connectorRunMetadata: connectorRunById.get(asText(row.connector_run_id))?.metadata || null,
  authenticity: classifyProofAuthenticity({
    sourceType: asText(row.source_type || sourceById.get(asText(row.source_id))?.source_type || asRecord(row.normalized_payload).source_type || row.event_type),
    sourceName: asText(row.source_name || asRecord(row.normalized_payload).source_name || sourceById.get(asText(row.source_id))?.name),
    sourceProvenance: asText(row.source_provenance || asRecord(row.normalized_payload).source_provenance || sourceById.get(asText(row.source_id))?.provenance),
    normalizedPayload: row.normalized_payload,
    connectorRunMetadata: connectorRunById.get(asText(row.connector_run_id))?.metadata || null
  })
}));

const liveProviderEvents = eventAuthenticityRows.filter((row) => row.authenticity === "live_provider");
const liveDerivedEvents = eventAuthenticityRows.filter((row) => row.authenticity === "live_derived");
const syntheticEvents = eventAuthenticityRows.filter((row) => row.authenticity === "synthetic");
const unknownEvents = eventAuthenticityRows.filter((row) => row.authenticity === "unknown");
const proofCohortEvents = eventAuthenticityRows.filter((row) => {
  if (row.authenticity === "live_provider" || row.authenticity === "live_derived") return true;
  if (row.authenticity !== "synthetic") return false;
  if (operatorTestSourceEventIds.has(asText(row.id))) return false;
  return !isOperatorTestArtifact(row.connectorRunMetadata);
});
const proofCohortSyntheticEvents = proofCohortEvents.filter((row) => row.authenticity === "synthetic");

const liveProviderEventIds = new Set(liveProviderEvents.map((row) => asText(row.id)));
const liveProviderOpportunities = recentOpportunities.filter((row) => liveProviderEventIds.has(asText(row.source_event_id)));
const liveProviderOpportunityIds = new Set(liveProviderOpportunities.map((row) => asText(row.id)));

const recentLeadRows = recentLeads.map((row) => ({
  ...row,
  snapshot: leadVerificationSnapshot(row),
  opportunity: opportunityById.get(asText(row.opportunity_id)) || null
}));

const liveProviderLeadRows = recentLeadRows.filter((row) => liveProviderOpportunityIds.has(asText(row.opportunity_id)));
const liveProviderVerifiedLeadRows = liveProviderLeadRows.filter((row) => row.snapshot.verified && !row.do_not_contact);
const liveProviderContactableLeadRows = liveProviderLeadRows.filter((row) => row.snapshot.contactable && !row.do_not_contact);
const liveProviderReviewLeadRows = liveProviderLeadRows.filter((row) => row.snapshot.review && !row.snapshot.verified);
const liveProviderLeadIds = new Set(liveProviderLeadRows.map((row) => asText(row.id)));
const liveProviderVerifiedLeadIds = new Set(liveProviderVerifiedLeadRows.map((row) => asText(row.id)));

const bookedJobs = recentJobs.filter((row) => String(row.status || "").toLowerCase().includes("book"));
const bookedLiveProviderJobs = bookedJobs.filter((row) => liveProviderLeadIds.has(asText(row.lead_id)));
const bookedFromVerifiedLeadJobs = bookedJobs.filter((row) => liveProviderVerifiedLeadIds.has(asText(row.lead_id)));
const outreachOnLiveProviderLeads = recentOutreach.filter((row) => liveProviderLeadIds.has(asText(row.lead_id)));
const sentOutreachOnVerifiedLeads = recentOutreach.filter(
  (row) =>
    liveProviderVerifiedLeadIds.has(asText(row.lead_id)) &&
    ["sent", "delivered", "replied"].includes(asText(row.event_type).toLowerCase())
);

const identifiedWithoutVerifiedContact = liveProviderOpportunities.filter((row) => {
  if (asText(row.contact_status).toLowerCase() !== "identified") return false;
  return !liveProviderContactableLeadRows.some((lead) => asText(lead.opportunity_id) === asText(row.id));
});

const issues = [];
if (liveProviderEvents.length === 0) {
  issues.push(issue("fail", "No live-provider source events", `No official public-source events found in the last ${lookbackDays} days.`));
}
if (liveProviderOpportunities.length === 0) {
  issues.push(issue("fail", "No live-provider opportunities", `Scanner and connector activity did not produce buyer-qualifiable opportunities in the last ${lookbackDays} days.`));
}
if (liveProviderVerifiedLeadRows.length === 0) {
  issues.push(issue("fail", "No verified live-provider leads", "The system is not yet turning official public signals into verified, contactable leads."));
}
if (liveProviderContactableLeadRows.length === 0) {
  issues.push(issue("fail", "No contactable live-provider leads", "No live-provider opportunities have verified contact channels attached."));
}
if (sentOutreachOnVerifiedLeads.length === 0) {
  issues.push(issue("warn", "No outreach on verified live-provider leads", "There is no recent outbound event proving the verified-lead follow-up loop is running."));
}
if (bookedFromVerifiedLeadJobs.length === 0) {
  issues.push(issue("warn", "No booked jobs from verified live-provider leads", "Revenue attribution from truly verified public-source leads is not yet proven in the recent window."));
}
if (identifiedWithoutVerifiedContact.length > 0) {
  issues.push(
    issue(
      "warn",
      "Identified opportunities without contact proof",
      `${identifiedWithoutVerifiedContact.length} live-provider opportunities are marked identified without a verified contactable lead.`
    )
  );
}

const proofCohortEventCount = proofCohortEvents.length || 1;
const syntheticShare = Number(((proofCohortSyntheticEvents.length / proofCohortEventCount) * 100).toFixed(1));
if (proofCohortSyntheticEvents.length > 0 && syntheticShare >= 40) {
  issues.push(
    issue(
      "warn",
      "Synthetic contamination is high",
      `${syntheticShare}% of proof-cohort source events are synthetic.`
    )
  );
}

const totalRevenue = bookedFromVerifiedLeadJobs.reduce((sum, row) => sum + (Number(row.revenue_amount) || 0), 0);
const status = issues.some((entry) => entry.level === "fail") ? "FAIL" : issues.some((entry) => entry.level === "warn") ? "WARN" : "PASS";

console.log(`real-lead-qualification=${status}`);
printMetric("tenant_id", tenantId);
printMetric("tenant_name", tenant.name || tenantName);
printMetric("lookback_days", lookbackDays);
printMetric("live_provider_source_events", liveProviderEvents.length);
printMetric("live_derived_source_events", liveDerivedEvents.length);
printMetric("synthetic_source_events", syntheticEvents.length);
printMetric("proof_cohort_source_events", proofCohortEvents.length);
printMetric("proof_cohort_synthetic_source_events", proofCohortSyntheticEvents.length);
printMetric("unknown_source_events", unknownEvents.length);
printMetric("live_provider_opportunities", liveProviderOpportunities.length);
printMetric("live_provider_contactable_leads", liveProviderContactableLeadRows.length);
printMetric("live_provider_verified_leads", liveProviderVerifiedLeadRows.length);
printMetric("live_provider_review_leads", liveProviderReviewLeadRows.length);
printMetric("outreach_events_on_live_provider_leads", outreachOnLiveProviderLeads.length);
printMetric("sent_outreach_on_verified_leads", sentOutreachOnVerifiedLeads.length);
printMetric("booked_jobs_from_live_provider_leads", bookedLiveProviderJobs.length);
printMetric("booked_jobs_from_verified_live_provider_leads", bookedFromVerifiedLeadJobs.length);
printMetric("verified_live_provider_revenue", totalRevenue);
printMetric("identified_without_verified_contact", identifiedWithoutVerifiedContact.length);

if (issues.length > 0) {
  console.log("issues:");
  for (const entry of issues) {
    console.log(`- [${entry.level.toUpperCase()}] ${entry.label}: ${entry.detail}`);
  }
}

const sampleTitles = liveProviderOpportunities.slice(0, 5).map((row) => asText(row.title)).filter(Boolean);
if (sampleTitles.length > 0) {
  console.log("sample_live_provider_opportunities:");
  for (const title of sampleTitles) {
    console.log(`- ${title}`);
  }
}

process.exit(status === "FAIL" ? 1 : 0);
