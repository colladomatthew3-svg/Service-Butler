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
    const value = line.slice(separator + 1).trim();
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

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function normalizeEmail(raw) {
  const email = asText(raw).toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeQualificationStatus(value) {
  const normalized = asText(value).toLowerCase();
  if (normalized === "research_only" || normalized === "queued_for_sdr" || normalized === "qualified_contactable" || normalized === "rejected") {
    return normalized;
  }
  return null;
}

function normalizeProofAuthenticity(value) {
  const normalized = asText(value).toLowerCase();
  if (normalized === "live_provider" || normalized === "live_derived" || normalized === "synthetic" || normalized === "unknown") {
    return normalized;
  }
  return null;
}

function matchesAny(patterns, values) {
  return values.some((value) => patterns.some((pattern) => pattern.test(value)));
}

function classifyProofAuthenticity({ sourceType, sourceName, sourceProvenance, normalizedPayload, connectorRunMetadata }) {
  const normalized = asRecord(normalizedPayload);
  const metadata = asRecord(connectorRunMetadata);
  const connectorInputMode = asText(metadata.connector_input_mode).toLowerCase();
  const connectorKey = asText(
    normalized.connector_key ||
      normalized.platform ||
      normalized.source_type ||
      sourceType
  ).toLowerCase();
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

function getOpportunityQualificationSnapshot({ explainability, proofAuthenticity, lifecycleStatus, contactStatus }) {
  const current = asRecord(explainability);
  const qualificationContact = asRecord(current.qualification_contact);
  const lifecycle = asText(lifecycleStatus).toLowerCase();
  const contact = asText(contactStatus).toLowerCase();
  let qualificationStatus = normalizeQualificationStatus(current.qualification_status);
  if (!qualificationStatus) {
    if (current.research_only === true || current.requires_sdr_qualification === true) {
      qualificationStatus = "research_only";
    } else if ((lifecycle === "qualified" || lifecycle === "assigned" || lifecycle === "booked_job") && contact === "identified") {
      qualificationStatus = "qualified_contactable";
    } else {
      qualificationStatus = "research_only";
    }
  }

  const qualificationReasonCode = asText(current.qualification_reason_code) || null;
  const nextRecommendedAction =
    asText(current.next_recommended_action) ||
    (qualificationStatus === "qualified_contactable"
      ? "dispatch_to_lead_queue"
      : qualificationStatus === "queued_for_sdr"
        ? "await_sdr_review"
        : qualificationStatus === "rejected"
          ? "hold"
          : "route_to_sdr");

  return {
    qualificationStatus,
    qualificationReasonCode,
    nextRecommendedAction,
    researchOnly: qualificationStatus === "research_only" || qualificationStatus === "queued_for_sdr",
    requiresSdrQualification: qualificationStatus !== "qualified_contactable",
    proofAuthenticity: proofAuthenticity || normalizeProofAuthenticity(current.proof_authenticity) || "unknown",
    sourceType: asText(current.source_type) || null,
    scannerEventId: asText(current.scanner_event_id) || asText(current.scanner_opportunity_id) || null,
    contactName: asText(qualificationContact.contact_name ?? current.contact_name) || null,
    phone: normalizePhone(qualificationContact.phone ?? current.phone),
    email: normalizeEmail(qualificationContact.email ?? current.email),
    verificationStatus: asText(qualificationContact.verification_status ?? current.verification_status) || null,
    qualificationSource: asText(current.qualification_source) || null,
    qualificationNotes: asText(current.qualification_notes) || null,
    qualifiedAt: asText(current.qualified_at ?? current.sdr_verified_at) || null,
    qualifiedBy: asText(current.qualified_by) || null
  };
}

function mergeOpportunityQualification(explainability, input) {
  const current = asRecord(explainability);
  const existingContact = asRecord(current.qualification_contact);
  return {
    ...current,
    qualification_status: input.qualificationStatus,
    qualification_reason_code: input.qualificationReasonCode,
    next_recommended_action: input.nextRecommendedAction,
    research_only: input.qualificationStatus !== "qualified_contactable",
    requires_sdr_qualification: input.qualificationStatus !== "qualified_contactable",
    proof_authenticity: input.proofAuthenticity ?? current.proof_authenticity ?? "unknown",
    source_type: input.sourceType ?? (asText(current.source_type) || null),
    scanner_event_id: input.scannerEventId ?? (asText(current.scanner_event_id) || null),
    qualification_source: input.qualificationSource ?? (asText(current.qualification_source) || null),
    qualification_notes: input.qualificationNotes ?? (asText(current.qualification_notes) || null),
    qualified_at: input.qualifiedAt ?? (asText(current.qualified_at) || null),
    qualified_by: input.qualifiedBy ?? (asText(current.qualified_by) || null),
    qualification_contact: {
      ...existingContact,
      contact_name: input.contactName ?? (asText(existingContact.contact_name) || null),
      phone: normalizePhone(input.phone) ?? normalizePhone(existingContact.phone),
      email: normalizeEmail(input.email) ?? normalizeEmail(existingContact.email),
      verification_status: input.verificationStatus ?? (asText(existingContact.verification_status) || null)
    }
  };
}

function buildQualificationBackfill({ explainability, lifecycleStatus, contactStatus, proofAuthenticity, scannerEventId, contactEvidence }) {
  const current = asRecord(explainability);
  const existingStatus = normalizeQualificationStatus(current.qualification_status);
  const snapshot = getOpportunityQualificationSnapshot({
    explainability: current,
    lifecycleStatus,
    contactStatus,
    proofAuthenticity
  });

  if (existingStatus) {
    return { explainability: current, snapshot, changed: false };
  }

  const merged = mergeOpportunityQualification(current, {
    qualificationStatus: snapshot.qualificationStatus,
    qualificationReasonCode: snapshot.qualificationStatus === "qualified_contactable" ? "historical_contactable_status" : "missing_verified_contact",
    nextRecommendedAction: snapshot.qualificationStatus === "qualified_contactable" ? "create_lead" : "route_to_sdr",
    proofAuthenticity: proofAuthenticity ?? snapshot.proofAuthenticity,
    sourceType: snapshot.sourceType,
    scannerEventId: scannerEventId ?? snapshot.scannerEventId,
    contactName: asText(contactEvidence?.contactName) || snapshot.contactName,
    phone: normalizePhone(contactEvidence?.phone) ?? snapshot.phone,
    email: normalizeEmail(contactEvidence?.email) ?? snapshot.email,
    verificationStatus: asText(contactEvidence?.verificationStatus) || snapshot.verificationStatus,
    qualificationSource: asText(contactEvidence?.qualificationSource) || snapshot.qualificationSource,
    qualificationNotes: asText(contactEvidence?.qualificationNotes) || snapshot.qualificationNotes,
    qualifiedAt: asText(contactEvidence?.qualifiedAt) || snapshot.qualifiedAt,
    qualifiedBy: asText(contactEvidence?.qualifiedBy) || snapshot.qualifiedBy
  });

  return {
    explainability: merged,
    snapshot: getOpportunityQualificationSnapshot({
      explainability: merged,
      lifecycleStatus,
      contactStatus,
      proofAuthenticity: proofAuthenticity ?? snapshot.proofAuthenticity
    }),
    changed: true
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === "--apply") {
      options.apply = true;
      continue;
    }
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function extractLeadContactEvidence(row) {
  if (!row) return null;
  const channels = asRecord(row.contact_channels_json);
  const verificationStatus = asText(channels.verification_status).toLowerCase();
  const phone = normalizePhone(channels.phone);
  const email = normalizeEmail(channels.email);
  if (verificationStatus !== "verified" || (!phone && !email)) return null;

  const evidence = Array.isArray(channels.verification_reasons)
    ? channels.verification_reasons.map((value) => asText(value)).filter(Boolean)
    : [];

  return {
    contactName: asText(row.contact_name) || null,
    phone,
    email,
    verificationStatus,
    qualificationSource: asText(channels.contact_provenance || channels.source_type) || null,
    qualificationNotes: evidence.length > 0 ? evidence.join(" | ") : null,
    qualifiedAt: asText(row.created_at) || null
  };
}

function updateCounts(counter, key) {
  counter[key] = (counter[key] || 0) + 1;
}

async function main() {
  const cwd = process.cwd();
  loadEnvFromFile(path.join(cwd, ".env.local"));
  loadEnvFromFile(path.join(cwd, ".env"));

  const options = parseArgs(process.argv.slice(2));
  const apply = options.apply === true;
  const limit = Math.max(1, Number(options.limit || 500) || 500);

  const supabaseUrl = asText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = asText(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tenantIdArg = asText(options["tenant-id"] || process.env.OPERATOR_TENANT_ID);
  const tenantNameArg = asText(options["tenant-name"] || process.env.OPERATOR_TENANT_NAME);

  const tenantLookup = tenantIdArg
    ? { data: { id: tenantIdArg, name: tenantNameArg || tenantIdArg }, error: null }
    : await supabase
        .from("v2_tenants")
        .select("id,name")
        .eq("type", "franchise")
        .eq("name", tenantNameArg)
        .maybeSingle();

  if (tenantLookup.error || !tenantLookup.data?.id) {
    throw new Error(`Could not resolve tenant (${tenantNameArg || tenantIdArg || "missing tenant"})`);
  }

  const tenantId = asText(tenantLookup.data.id);
  const tenantName = asText(tenantLookup.data.name) || tenantId;

  const { data: opportunities, error: opportunitiesError } = await supabase
    .from("v2_opportunities")
    .select("id,source_event_id,lifecycle_status,contact_status,explainability_json,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opportunitiesError) throw opportunitiesError;

  const opportunityRows = (opportunities || []).map((row) => ({
    ...row,
    explainability_json: asRecord(row.explainability_json)
  }));

  const sourceEventIds = Array.from(new Set(opportunityRows.map((row) => asText(row.source_event_id)).filter(Boolean)));
  const { data: sourceEvents, error: sourceEventsError } = sourceEventIds.length
    ? await supabase
        .from("v2_source_events")
        .select("id,connector_run_id,source_name,source_type,source_provenance,normalized_payload")
        .in("id", sourceEventIds)
    : { data: [], error: null };
  if (sourceEventsError) throw sourceEventsError;

  const connectorRunIds = Array.from(new Set((sourceEvents || []).map((row) => asText(row.connector_run_id)).filter(Boolean)));
  const { data: connectorRuns, error: connectorRunsError } = connectorRunIds.length
    ? await supabase.from("v2_connector_runs").select("id,metadata").in("id", connectorRunIds)
    : { data: [], error: null };
  if (connectorRunsError) throw connectorRunsError;

  const { data: leads, error: leadsError } = await supabase
    .from("v2_leads")
    .select("id,opportunity_id,contact_name,contact_channels_json,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (leadsError) throw leadsError;

  const { data: accountTenantMap, error: accountMapError } = await supabase
    .from("v2_account_tenant_map")
    .select("account_id")
    .eq("franchise_tenant_id", tenantId);
  if (accountMapError) throw accountMapError;

  const accountIds = Array.from(new Set((accountTenantMap || []).map((row) => asText(row.account_id)).filter(Boolean)));
  const { data: scannerEvents, error: scannerEventsError } = accountIds.length
    ? await supabase
        .from("scanner_events")
        .select("id,account_id,raw,created_at")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(limit * 3)
    : { data: [], error: null };
  if (scannerEventsError) throw scannerEventsError;

  const sourceEventById = new Map((sourceEvents || []).map((row) => [asText(row.id), row]));
  const connectorRunById = new Map((connectorRuns || []).map((row) => [asText(row.id), row]));
  const bestLeadByOpportunityId = new Map();
  for (const row of leads || []) {
    const opportunityId = asText(row.opportunity_id);
    if (!opportunityId || bestLeadByOpportunityId.has(opportunityId)) continue;
    const evidence = extractLeadContactEvidence(row);
    if (!evidence) continue;
    bestLeadByOpportunityId.set(opportunityId, evidence);
  }

  const scannerEventsByOpportunityKey = new Map();
  for (const row of scannerEvents || []) {
    const raw = asRecord(row.raw);
    const scannerOpportunityId = asText(raw.scanner_opportunity_id);
    if (!scannerOpportunityId) continue;
    const group = scannerEventsByOpportunityKey.get(scannerOpportunityId) || [];
    group.push({ ...row, raw });
    scannerEventsByOpportunityKey.set(scannerOpportunityId, group);
  }

  const counts = {
    opportunities_scanned: opportunityRows.length,
    scanner_rows_scanned: (scannerEvents || []).length
  };

  for (const opportunity of opportunityRows) {
    const explainability = asRecord(opportunity.explainability_json);
    const scannerOpportunityId = asText(explainability.scanner_opportunity_id);
    const matchingScannerEvents = scannerOpportunityId ? scannerEventsByOpportunityKey.get(scannerOpportunityId) || [] : [];
    const uniqueScannerEvent = matchingScannerEvents.length === 1 ? matchingScannerEvents[0] : null;
    const sourceEvent = sourceEventById.get(asText(opportunity.source_event_id));
    const connectorRun = sourceEvent ? connectorRunById.get(asText(sourceEvent.connector_run_id)) : null;

    const proofAuthenticity = sourceEvent
      ? classifyProofAuthenticity({
          sourceType: sourceEvent.source_type,
          sourceName: sourceEvent.source_name,
          sourceProvenance: sourceEvent.source_provenance,
          normalizedPayload: asRecord(sourceEvent.normalized_payload),
          connectorRunMetadata: asRecord(connectorRun?.metadata)
        })
      : undefined;

    let nextExplainability = explainability;
    let opportunityChanged = false;

    if (!normalizeQualificationStatus(explainability.qualification_status)) {
      const backfill = buildQualificationBackfill({
        explainability,
        lifecycleStatus: opportunity.lifecycle_status,
        contactStatus: opportunity.contact_status,
        proofAuthenticity,
        scannerEventId: uniqueScannerEvent ? asText(uniqueScannerEvent.id) : undefined,
        contactEvidence: bestLeadByOpportunityId.get(asText(opportunity.id)) || null
      });
      nextExplainability = backfill.explainability;
      opportunityChanged = backfill.changed;
      if (backfill.changed) updateCounts(counts, "opportunities_backfilled");
      else updateCounts(counts, "opportunities_unchanged");
    } else {
      updateCounts(counts, "opportunities_with_explicit_status");
    }

    if (proofAuthenticity && !asText(nextExplainability.proof_authenticity)) {
      nextExplainability = {
        ...nextExplainability,
        proof_authenticity: proofAuthenticity
      };
      opportunityChanged = true;
      updateCounts(counts, "proof_authenticity_backfilled");
    }

    if (uniqueScannerEvent && !asText(nextExplainability.scanner_event_id)) {
      nextExplainability = {
        ...nextExplainability,
        scanner_event_id: asText(uniqueScannerEvent.id)
      };
      opportunityChanged = true;
      updateCounts(counts, "scanner_linkage_backfilled");
    } else if (matchingScannerEvents.length > 1) {
      updateCounts(counts, "scanner_linkage_ambiguous");
    } else if (!uniqueScannerEvent && scannerOpportunityId) {
      updateCounts(counts, "scanner_linkage_missing");
    }

    if (opportunityChanged && apply) {
      const { error } = await supabase
        .from("v2_opportunities")
        .update({ explainability_json: nextExplainability })
        .eq("tenant_id", tenantId)
        .eq("id", opportunity.id);
      if (error) throw error;
    }

    if (!uniqueScannerEvent) continue;

    const raw = asRecord(uniqueScannerEvent.raw);
    const snapshot = getOpportunityQualificationSnapshot({
      explainability: nextExplainability,
      lifecycleStatus: opportunity.lifecycle_status,
      contactStatus: opportunity.contact_status,
      proofAuthenticity
    });

    const nextRaw = {
      ...raw,
      v2_opportunity_id: asText(opportunity.id),
      qualification_status: snapshot.qualificationStatus,
      qualification_reason_code: snapshot.qualificationReasonCode,
      proof_authenticity: snapshot.proofAuthenticity,
      next_recommended_action: snapshot.nextRecommendedAction,
      research_only: snapshot.researchOnly,
      requires_sdr_qualification: snapshot.requiresSdrQualification,
      contact_name: snapshot.contactName,
      phone: snapshot.phone,
      email: snapshot.email,
      verification_status: snapshot.verificationStatus,
      qualification_source: snapshot.qualificationSource,
      qualification_notes: snapshot.qualificationNotes,
      qualified_at: snapshot.qualifiedAt,
      qualified_by: snapshot.qualifiedBy
    };

    const scannerChanged =
      JSON.stringify({
        v2_opportunity_id: raw.v2_opportunity_id,
        qualification_status: raw.qualification_status,
        qualification_reason_code: raw.qualification_reason_code,
        proof_authenticity: raw.proof_authenticity,
        next_recommended_action: raw.next_recommended_action,
        research_only: raw.research_only,
        requires_sdr_qualification: raw.requires_sdr_qualification,
        contact_name: raw.contact_name,
        phone: raw.phone,
        email: raw.email,
        verification_status: raw.verification_status,
        qualification_source: raw.qualification_source,
        qualification_notes: raw.qualification_notes,
        qualified_at: raw.qualified_at,
        qualified_by: raw.qualified_by
      }) !==
      JSON.stringify({
        v2_opportunity_id: nextRaw.v2_opportunity_id,
        qualification_status: nextRaw.qualification_status,
        qualification_reason_code: nextRaw.qualification_reason_code,
        proof_authenticity: nextRaw.proof_authenticity,
        next_recommended_action: nextRaw.next_recommended_action,
        research_only: nextRaw.research_only,
        requires_sdr_qualification: nextRaw.requires_sdr_qualification,
        contact_name: nextRaw.contact_name,
        phone: nextRaw.phone,
        email: nextRaw.email,
        verification_status: nextRaw.verification_status,
        qualification_source: nextRaw.qualification_source,
        qualification_notes: nextRaw.qualification_notes,
        qualified_at: nextRaw.qualified_at,
        qualified_by: nextRaw.qualified_by
      });

    if (!scannerChanged) continue;
    updateCounts(counts, "scanner_rows_backfilled");

    if (apply) {
      const { error } = await supabase
        .from("scanner_events")
        .update({ raw: nextRaw })
        .eq("account_id", uniqueScannerEvent.account_id)
        .eq("id", uniqueScannerEvent.id);
      if (error) throw error;
    }
  }

  console.log(JSON.stringify({ apply, tenantId, tenantName, counts }, null, 2));
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message || "Qualification metadata backfill failed")
        : "Qualification metadata backfill failed";
  console.error(message);
  process.exit(1);
});
