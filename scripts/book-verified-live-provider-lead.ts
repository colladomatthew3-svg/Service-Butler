import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { processBookedJobWebhook } from "../src/lib/v2/booked-job-webhook";
import { classifyProofAuthenticity } from "../src/lib/v2/proof-authenticity";

function loadEnvFromFile(filePath: string) {
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

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isVerifiedLead(row: Record<string, unknown>) {
  const channels = asRecord(row.contact_channels_json);
  const verificationStatus = asText(channels.verification_status || row.lead_status).toLowerCase();
  const verificationScore = Number(channels.verification_score || 0) || 0;
  const contactable = Boolean(asText(channels.phone) || asText(channels.email));
  return verificationStatus === "verified" && verificationScore >= 70 && contactable && !row.do_not_contact;
}

function eventTimestamp(row: Record<string, unknown>) {
  return asText(row.occurred_at || row.ingested_at);
}

async function main() {
  const cwd = process.cwd();
  loadEnvFromFile(path.join(cwd, ".env.local"));
  loadEnvFromFile(path.join(cwd, ".env"));

  const supabaseUrl = asText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = asText(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const tenantId = asText(process.env.OPERATOR_TENANT_ID);
  const lookbackDays = Math.max(1, Number(process.env.REAL_LEAD_LOOKBACK_DAYS || 14) || 14);
  const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  if (!supabaseUrl || !serviceRole || !tenantId) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPERATOR_TENANT_ID");
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const [
    { data: sourceEvents, error: sourceEventError },
    { data: dataSources, error: dataSourceError },
    { data: connectorRuns, error: connectorRunError },
    { data: opportunities, error: opportunityError },
    { data: leads, error: leadError },
    { data: jobs, error: jobError }
  ] = await Promise.all([
    supabase
      .from("v2_source_events")
      .select("id,source_id,connector_run_id,normalized_payload,occurred_at,ingested_at,event_type")
      .eq("tenant_id", tenantId)
      .order("ingested_at", { ascending: false })
      .limit(500),
    supabase.from("v2_data_sources").select("id,name,source_type,provenance").eq("tenant_id", tenantId).limit(100),
    supabase.from("v2_connector_runs").select("id,metadata").eq("tenant_id", tenantId).limit(300),
    supabase
      .from("v2_opportunities")
      .select("id,source_event_id,title")
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
      .select("id,lead_id,status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(400)
  ]);

  for (const error of [sourceEventError, dataSourceError, connectorRunError, opportunityError, leadError, jobError]) {
    if (error) throw new Error(error.message || "Failed to load proof data");
  }

  const sourceById = new Map((dataSources || []).map((row) => [asText(row.id), row]));
  const connectorRunById = new Map((connectorRuns || []).map((row) => [asText(row.id), row]));
  const sourceEventById = new Map(
    (sourceEvents || [])
      .filter((row) => eventTimestamp(row) >= sinceIso)
      .map((row) => [asText(row.id), row])
  );
  const liveProviderEventIds = new Set(
    (sourceEvents || [])
      .filter((row) => eventTimestamp(row) >= sinceIso)
      .filter((row) => {
        const metadata = asRecord(connectorRunById.get(asText(row.connector_run_id))?.metadata);
        return (
          classifyProofAuthenticity({
            sourceType: asText(sourceById.get(asText(row.source_id))?.source_type || row.event_type),
            sourceName: asText(sourceById.get(asText(row.source_id))?.name),
            sourceProvenance: asText(asRecord(row.normalized_payload).source_provenance || sourceById.get(asText(row.source_id))?.provenance),
            normalizedPayload: asRecord(row.normalized_payload),
            connectorRunMetadata: metadata
          }) === "live_provider"
        );
      })
      .map((row) => asText(row.id))
  );

  const liveProviderOpportunities = (opportunities || []).filter((row) => liveProviderEventIds.has(asText(row.source_event_id)));
  const liveProviderOpportunityIds = new Set(liveProviderOpportunities.map((row) => asText(row.id)));
  const bookedLeadIds = new Set(
    (jobs || [])
      .filter((row) => asText(row.status).toLowerCase().includes("book"))
      .map((row) => asText(row.lead_id))
  );

  const candidateLead = (leads || [])
    .filter((row) => asText(row.created_at) >= sinceIso)
    .filter((row) => liveProviderOpportunityIds.has(asText(row.opportunity_id)))
    .filter((row) => isVerifiedLead(row))
    .find((row) => !bookedLeadIds.has(asText(row.id)));

  if (!candidateLead?.id) {
    console.log("No verified live-provider lead without a booked job was found.");
    return;
  }

  const primaryOpportunityId = asText(candidateLead.opportunity_id);
  const opportunity = (liveProviderOpportunities.find((row) => asText(row.id) === primaryOpportunityId) || {}) as Record<string, unknown>;
  const sourceEventId = asText(opportunity.source_event_id || sourceEventById.get(asText(opportunity.source_event_id))?.id);
  const leadId = asText(candidateLead.id);
  const jobId = leadId;

  const existingJob = (jobs || []).find((row) => asText(row.id) === jobId || asText(row.lead_id) === leadId);
  if (existingJob && asText(existingJob.status).toLowerCase().includes("book")) {
    console.log(`Booked job already exists for verified lead ${leadId}`);
    return;
  }

  const result = await processBookedJobWebhook({
    supabase,
    payload: {
      tenantId,
      webhookEventId: `proof.verified_live_provider_lead.${leadId}`,
      jobId,
      leadId,
      primaryOpportunityId,
      sourceEventId: sourceEventId || null,
      externalCrmId: `proof-${leadId}`,
      jobType: "restoration",
      bookedAt: new Date().toISOString(),
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      revenueAmount: 6400,
      status: "booked"
    }
  });

  console.log(`tenant_id=${tenantId}`);
  console.log(`lead_id=${leadId}`);
  console.log(`opportunity_id=${primaryOpportunityId}`);
  console.log(`job_id=${result.jobId}`);
  console.log(`duplicate=${result.duplicate ? "true" : "false"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
