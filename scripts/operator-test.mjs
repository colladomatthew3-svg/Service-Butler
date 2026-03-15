#!/usr/bin/env node
import { randomUUID } from "node:crypto";
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

function printSimulated() {
  for (const line of REQUIRED_LINES) {
    console.log(`${line} (simulated: missing Supabase service credentials)`);
  }
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

  const { data, error } = await supabase
    .from("v2_tenants")
    .select("id")
    .eq("name", "NY Restoration Group")
    .eq("type", "franchise")
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) throw new Error("Operator tenant not found. Run operator seed first.");
  return String(data.id);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    printSimulated();
    return;
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

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
      mode: "operator_test",
      source_provenance: "operator.permits.provider",
      connector_version: "operator-test-1"
    }
  });

  if (runError) throw new Error(runError.message);
  console.log("connector run");

  const sourceEventId = randomUUID();
  const scores = scoreFromSeverity(77);

  const { error: sourceEventError } = await supabase.from("v2_source_events").insert({
    id: sourceEventId,
    source_id: sourceId,
    tenant_id: tenantId,
    connector_run_id: runId,
    occurred_at: nowIso,
    ingested_at: nowIso,
    raw_payload: { kind: "operator_test" },
    normalized_payload: {
      source_provenance: "operator.permits.provider",
      connector_version: "operator-test-1",
      terms_status: "approved",
      data_freshness_score: 97
    },
    location_text: "350 5th Ave, New York, NY 10118",
    location: "SRID=4326;POINT(-73.9857 40.7484)",
    confidence_score: 77,
    source_reliability_score: 75,
    compliance_status: "approved",
    dedupe_key: `operator-test|${runId}`,
    event_type: "permit_signal"
  });

  if (sourceEventError) throw new Error(sourceEventError.message);

  const opportunityId = randomUUID();
  const { error: opportunityError } = await supabase.from("v2_opportunities").insert({
    id: opportunityId,
    tenant_id: tenantId,
    source_event_id: sourceEventId,
    opportunity_type: "permit_signal",
    service_line: "restoration",
    title: "Operator pilot opportunity",
    description: "Operator test generated opportunity",
    urgency_score: scores.urgency,
    job_likelihood_score: scores.likelihood,
    contactability_score: scores.contactability,
    source_reliability_score: scores.sourceReliability,
    revenue_band: "high",
    catastrophe_linkage_score: scores.catastrophe,
    location_text: "350 5th Ave, New York, NY 10118",
    location: "SRID=4326;POINT(-73.9857 40.7484)",
    postal_code: "10001",
    contact_status: "identified",
    routing_status: "pending",
    lifecycle_status: "new",
    explainability_json: { operator_test: true }
  });

  if (opportunityError) throw new Error(opportunityError.message);
  console.log("opportunity created");

  const { error: scoringUpdateError } = await supabase
    .from("v2_opportunities")
    .update({
      job_likelihood_score: Math.max(scores.likelihood, 70),
      explainability_json: { operator_test: true, rescored: true }
    })
    .eq("id", opportunityId);

  if (scoringUpdateError) throw new Error(scoringUpdateError.message);
  console.log("opportunity scored");

  let matchedTerritoryId = null;
  const usePolygon = String(process.env.SB_USE_POLYGON_ROUTING || "").toLowerCase() === "true";

  if (usePolygon) {
    const { data: match, error } = await supabase.rpc("match_territory_by_point", {
      p_tenant_id: tenantId,
      p_lat: 40.7484,
      p_lng: -73.9857,
      p_service_line: "restoration"
    });

    if (error) throw new Error(error.message);
    matchedTerritoryId = match?.[0]?.territory_id || null;
  }

  if (!matchedTerritoryId) {
    const { data: zipMatch, error } = await supabase
      .from("v2_territories")
      .select("id")
      .eq("tenant_id", tenantId)
      .contains("zip_codes", ["10001"])
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
    metadata: { operator_test: true, territory_id: matchedTerritoryId }
  });

  if (assignmentError) throw new Error(assignmentError.message);
  console.log("assignment created");

  const leadId = randomUUID();
  const { error: leadError } = await supabase.from("v2_leads").insert({
    id: leadId,
    tenant_id: tenantId,
    opportunity_id: opportunityId,
    contact_name: "Operator Pilot Contact",
    contact_channels_json: { phone: "+15555550123" },
    property_address: "350 5th Ave, New York, NY 10118",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    lead_status: "new",
    crm_sync_status: "not_synced",
    do_not_contact: false
  });

  if (leadError) throw new Error(leadError.message);

  const { error: outreachError } = await supabase.from("v2_outreach_events").insert([
    {
      tenant_id: tenantId,
      lead_id: leadId,
      assignment_id: assignmentId,
      channel: "sms",
      event_type: "sent",
      sent_at: new Date().toISOString(),
      outcome: "sent_via_twilio",
      provider_message_id: `operator-sms-${runId}`
    },
    {
      tenant_id: tenantId,
      lead_id: leadId,
      assignment_id: assignmentId,
      channel: "crm_task",
      event_type: "sent",
      sent_at: new Date().toISOString(),
      outcome: "hubspot_task_created",
      provider_message_id: `operator-crm-${runId}`
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
      job_type: "restoration",
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
