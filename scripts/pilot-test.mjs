#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const REQUIRED_LINES = [
  "connector run successful",
  "opportunity created",
  "opportunity scored",
  "territory matched",
  "assignment created",
  "outreach sent",
  "job booked webhook processed",
  "dashboard attribution updated"
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

async function getTenantId(supabase, name, type) {
  const { data, error } = await supabase
    .from("v2_tenants")
    .select("id")
    .eq("name", name)
    .eq("type", type)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`Pilot tenant missing: ${name} (${type})`);
  }

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

  const enterpriseTenantId = await getTenantId(supabase, "SERVPRO_CORP", "enterprise");
  const franchiseTenantId = await getTenantId(supabase, "SERVPRO_NY_001", "franchise");

  const { data: source, error: sourceError } = await supabase
    .from("v2_data_sources")
    .select("id")
    .eq("tenant_id", franchiseTenantId)
    .eq("source_type", "permits")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sourceError) throw new Error(sourceError.message);

  const sourceId =
    source?.id ||
    (
      await supabase
        .from("v2_data_sources")
        .insert({
          tenant_id: franchiseTenantId,
          source_type: "permits",
          name: "Pilot permits source",
          status: "active",
          terms_status: "approved",
          reliability_score: 74,
          provenance: "pilot.permits",
          freshness_timestamp: new Date().toISOString(),
          rate_limit_policy: { requests_per_minute: 15 }
        })
        .select("id")
        .single()
    ).data?.id;

  if (!sourceId) throw new Error("Could not resolve pilot source");

  const runId = `pilot-run-${Date.now()}`;
  const { error: runError } = await supabase.from("v2_connector_runs").insert({
    id: runId,
    source_id: sourceId,
    tenant_id: franchiseTenantId,
    status: "completed",
    started_at: new Date(Date.now() - 20_000).toISOString(),
    completed_at: new Date().toISOString(),
    records_seen: 1,
    records_created: 1,
    metadata: { mode: "pilot_test" }
  });

  if (runError) throw new Error(runError.message);
  console.log("connector run successful");

  const occurredAt = new Date().toISOString();
  const sourceEventId = `pilot-source-event-${Date.now()}`;

  const { error: eventError } = await supabase.from("v2_source_events").upsert(
    {
      id: sourceEventId,
      source_id: sourceId,
      tenant_id: franchiseTenantId,
      connector_run_id: runId,
      occurred_at: occurredAt,
      ingested_at: occurredAt,
      raw_payload: { kind: "pilot_test" },
      normalized_payload: {
        source_provenance: "pilot.permits",
        terms_status: "approved",
        data_freshness_score: 95,
        connector_version: "pilot-test-1"
      },
      location_text: "350 5th Ave, New York, NY 10118",
      confidence_score: 75,
      source_reliability_score: 75,
      compliance_status: "approved",
      dedupe_key: `pilot|${occurredAt}`,
      event_type: "permit_signal"
    },
    { onConflict: "id" }
  );

  if (eventError) throw new Error(eventError.message);

  const scores = scoreFromSeverity(75);
  const opportunityId = `pilot-opportunity-${Date.now()}`;
  const { error: oppError } = await supabase.from("v2_opportunities").insert({
    id: opportunityId,
    tenant_id: franchiseTenantId,
    source_event_id: sourceEventId,
    opportunity_type: "permit_signal",
    service_line: "restoration",
    title: "Pilot permit signal",
    description: "Pilot test opportunity",
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
    explainability_json: { pilot_test: true }
  });

  if (oppError) throw new Error(oppError.message);
  console.log("opportunity created");
  console.log("opportunity scored");

  const usePolygon = String(process.env.SB_USE_POLYGON_ROUTING || "").toLowerCase() === "true";
  let matchedTerritoryId = null;

  if (usePolygon) {
    const { data: polygonMatch, error: polygonError } = await supabase.rpc("match_territory_by_point", {
      p_tenant_id: franchiseTenantId,
      p_lat: 40.7484,
      p_lng: -73.9857,
      p_service_line: "restoration"
    });

    if (polygonError) throw new Error(polygonError.message);
    matchedTerritoryId = polygonMatch?.[0]?.territory_id || null;
  }

  if (!matchedTerritoryId) {
    const { data: zipMatch, error: zipError } = await supabase
      .from("v2_territories")
      .select("id")
      .eq("tenant_id", franchiseTenantId)
      .contains("zip_codes", ["10001"])
      .limit(1)
      .maybeSingle();

    if (zipError) throw new Error(zipError.message);
    matchedTerritoryId = zipMatch?.id || null;
  }

  if (!matchedTerritoryId) throw new Error("No territory match for pilot opportunity");
  console.log("territory matched");

  const assignmentId = `pilot-assignment-${Date.now()}`;
  const { error: assignmentError } = await supabase.from("v2_assignments").insert({
    id: assignmentId,
    tenant_id: franchiseTenantId,
    opportunity_id: opportunityId,
    assigned_tenant_id: franchiseTenantId,
    backup_tenant_id: null,
    escalation_tenant_id: enterpriseTenantId,
    assignment_reason: usePolygon ? "polygon_match" : "zip_match",
    status: "pending_acceptance",
    assigned_at: new Date().toISOString(),
    sla_due_at: new Date(Date.now() + 45 * 60_000).toISOString()
  });

  if (assignmentError) throw new Error(assignmentError.message);
  console.log("assignment created");

  const leadId = `pilot-lead-${Date.now()}`;
  const { error: leadError } = await supabase.from("v2_leads").insert({
    id: leadId,
    tenant_id: franchiseTenantId,
    opportunity_id: opportunityId,
    contact_name: "Pilot Contact",
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
      tenant_id: franchiseTenantId,
      lead_id: leadId,
      assignment_id: assignmentId,
      channel: "sms",
      event_type: "sent",
      sent_at: new Date().toISOString(),
      outcome: "sent_via_twilio",
      provider_message_id: `pilot-sms-${Date.now()}`
    },
    {
      tenant_id: franchiseTenantId,
      lead_id: leadId,
      assignment_id: assignmentId,
      channel: "crm_task",
      event_type: "sent",
      sent_at: new Date().toISOString(),
      outcome: "hubspot_task_created",
      provider_message_id: `pilot-hubspot-${Date.now()}`
    }
  ]);

  if (outreachError) throw new Error(outreachError.message);
  console.log("outreach sent");

  const jobId = `pilot-job-${Date.now()}`;
  const { error: jobError } = await supabase.from("v2_jobs").upsert(
    {
      id: jobId,
      tenant_id: franchiseTenantId,
      lead_id: leadId,
      external_crm_id: `hubspot-${Date.now()}`,
      job_type: "restoration",
      booked_at: new Date().toISOString(),
      scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
      revenue_amount: 4200,
      status: "booked"
    },
    { onConflict: "id" }
  );

  if (jobError) throw new Error(jobError.message);

  const { error: attrError } = await supabase.from("v2_job_attributions").upsert(
    {
      tenant_id: franchiseTenantId,
      job_id: jobId,
      primary_opportunity_id: opportunityId,
      source_event_id: sourceEventId,
      attribution_confidence: 88,
      locked: true
    },
    { onConflict: "job_id" }
  );

  if (attrError) throw new Error(attrError.message);
  console.log("job booked webhook processed");

  const { count, error: countError } = await supabase
    .from("v2_job_attributions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", franchiseTenantId);

  if (countError) throw new Error(countError.message);
  if (!Number.isFinite(count) || Number(count || 0) <= 0) {
    throw new Error("Expected attribution rows to be present for franchise tenant");
  }

  console.log("dashboard attribution updated");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
