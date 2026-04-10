import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runDataSourceConnector } from "../src/lib/v2/data-sources";
import { deriveDispatchableLeadCandidate } from "../src/lib/v2/dispatchable-leads";

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
    if (!(key in process.env)) process.env[key] = value;
  }
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

async function main() {
  const cwd = process.cwd();
  loadEnvFromFile(path.join(cwd, ".env.local"));
  loadEnvFromFile(path.join(cwd, ".env"));

  const supabase = createClient(String(process.env.NEXT_PUBLIC_SUPABASE_URL || ""), String(process.env.SUPABASE_SERVICE_ROLE_KEY || ""), {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tenantId = String(process.env.OPERATOR_TENANT_ID || "").trim();
  if (!tenantId) throw new Error("OPERATOR_TENANT_ID is required");

  const { data: sourceRow, error: sourceError } = await supabase
    .from("v2_data_sources")
    .select("id,source_type,name")
    .eq("tenant_id", tenantId)
    .eq("source_type", "permits")
    .limit(1)
    .maybeSingle();

  if (sourceError) throw sourceError;
  if (!sourceRow?.id) throw new Error("Permits source not found");

  const runResult = await runDataSourceConnector({
    supabase,
    tenantId,
    sourceId: String(sourceRow.id),
    actorUserId: "codex-permits-tranche"
  });

  const sinceIso = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: opportunities, error: oppError } = await supabase
    .from("v2_opportunities")
    .select("id,source_event_id,opportunity_type,service_line,title,description,location_text,postal_code,routing_status,lifecycle_status,contact_status,source_reliability_score,explainability_json,created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(150);
  if (oppError) throw oppError;

  const sourceEventIds = Array.from(new Set((opportunities || []).map((row) => asText(row.source_event_id)).filter(Boolean)));
  const { data: sourceEvents, error: sourceEventError } = sourceEventIds.length
    ? await supabase
        .from("v2_source_events")
        .select("id,source_id,connector_run_id,occurred_at,ingested_at,compliance_status,normalized_payload")
        .eq("tenant_id", tenantId)
        .in("id", sourceEventIds)
    : { data: [], error: null };
  if (sourceEventError) throw sourceEventError;

  const sourceIds = Array.from(new Set((sourceEvents || []).map((row) => asText((row as Record<string, unknown>).source_id)).filter(Boolean)));
  const connectorRunIds = Array.from(new Set((sourceEvents || []).map((row) => asText((row as Record<string, unknown>).connector_run_id)).filter(Boolean)));

  const [{ data: sources, error: sourcesError }, { data: runs, error: runsError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    sourceIds.length
      ? supabase
          .from("v2_data_sources")
          .select("id,source_type,name,status,terms_status,compliance_status,rollout_state,readiness_status,health_status,freshness_timestamp,freshness_sla_minutes,provenance")
          .eq("tenant_id", tenantId)
          .in("id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
    connectorRunIds.length
      ? supabase.from("v2_connector_runs").select("id,status,metadata").eq("tenant_id", tenantId).in("id", connectorRunIds)
      : Promise.resolve({ data: [], error: null }),
    opportunities && opportunities.length
      ? supabase
          .from("v2_assignments")
          .select("id,opportunity_id,status,assigned_tenant_id,sla_due_at,assignment_reason,created_at")
          .eq("tenant_id", tenantId)
          .in("opportunity_id", opportunities.map((row) => asText(row.id)))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (sourcesError) throw sourcesError;
  if (runsError) throw runsError;
  if (assignmentsError) throw assignmentsError;

  const sourceById = new Map((sources || []).map((row) => [asText((row as Record<string, unknown>).id), row as Record<string, unknown>]));
  const runById = new Map((runs || []).map((row) => [asText((row as Record<string, unknown>).id), row as Record<string, unknown>]));
  const assignmentByOpportunity = new Map<string, Record<string, unknown>>();
  for (const assignment of (assignments || []) as Array<Record<string, unknown>>) {
    const opportunityId = asText(assignment.opportunity_id);
    if (opportunityId && !assignmentByOpportunity.has(opportunityId)) assignmentByOpportunity.set(opportunityId, assignment);
  }

  const sourceEventById = new Map((sourceEvents || []).map((row) => [asText((row as Record<string, unknown>).id), row as Record<string, unknown>]));
  const permitCandidates = ((opportunities || []) as Array<Record<string, unknown>>)
    .map((opportunity) => {
      const sourceEvent = sourceEventById.get(asText(opportunity.source_event_id)) || null;
      const source = sourceEvent ? sourceById.get(asText(sourceEvent.source_id)) || null : null;
      const connectorRun = sourceEvent ? runById.get(asText(sourceEvent.connector_run_id)) || null : null;
      const assignment = assignmentByOpportunity.get(asText(opportunity.id)) || null;
      return deriveDispatchableLeadCandidate({
        opportunity,
        sourceEvent,
        source,
        connectorRun,
        assignment
      });
    })
    .filter((candidate) => (candidate.source_type || "").toLowerCase().includes("permit"));

  const blockedReasonCounts = permitCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.blocked_reason || "dispatchable";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        source: {
          id: sourceRow.id,
          name: sourceRow.name,
          source_type: sourceRow.source_type
        },
        run: runResult.run,
        source_summary: runResult.sourceSummary
          ? {
              id: runResult.sourceSummary.id,
              complianceStatus: runResult.sourceSummary.complianceStatus,
              readinessStatus: runResult.sourceSummary.readinessStatus,
              healthStatus: runResult.sourceSummary.healthStatus,
              latestRunStatus: runResult.sourceSummary.latestRunStatus,
              latestEventAt: runResult.sourceSummary.latestEventAt
            }
          : null,
        candidates: {
          total_permit_candidates: permitCandidates.length,
          contact_attached: permitCandidates.filter((candidate) => Boolean(candidate.phone || candidate.email)).length,
          dispatchable: permitCandidates.filter((candidate) => candidate.dispatch_eligible).length,
          blocked_reason_counts: blockedReasonCounts
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(JSON.stringify(error, null, 2));
  }
  process.exit(1);
});
