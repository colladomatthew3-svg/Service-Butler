import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { addDemoScannerEvents, getDemoWeatherSettings } from "@/lib/demo/store";
import { hasVerifiedOwnerContact } from "@/lib/services/contact-proof";
import { runScanner } from "@/lib/services/scanner";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { classifyProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { computeOpportunityScores } from "@/lib/v2/scoring";
import type { OpportunityQualificationStatus } from "@/lib/v2/opportunity-qualification";

type ScannerRunRequestBody = {
  mode?: "demo" | "live";
  location?: string;
  categories?: string[];
  limit?: number;
  lat?: number;
  lon?: number;
  radius?: number;
  campaignMode?: "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";
  triggers?: string[];
};

function buildScannerQualificationFields(op: { source: string; raw?: Record<string, unknown> }, hasVerifiedContact: boolean) {
  const qualificationStatus: OpportunityQualificationStatus = hasVerifiedContact ? "qualified_contactable" : "research_only";
  return {
    qualification_status: qualificationStatus,
    qualification_reason_code: hasVerifiedContact ? "verified_contact_present" : "missing_verified_contact",
    next_recommended_action: hasVerifiedContact ? "create_lead" : "route_to_sdr",
    research_only: !hasVerifiedContact,
    requires_sdr_qualification: !hasVerifiedContact,
    proof_authenticity: classifyProofAuthenticity({
      sourceType: op.source,
      sourceName: String(op.raw?.source_name || op.source || "scanner_signal"),
      sourceProvenance: String(op.raw?.source_provenance || op.source || "scanner_signal"),
      normalizedPayload: {
        ...(op.raw || {}),
        source_type: op.source
      }
    })
  };
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const body = await readScannerRunBody(req);

    const settings = await getDemoWeatherSettings();
    const location = String(body.location || "").trim() || settings.weather_location_label;
    const lat = Number.isFinite(body.lat) ? Number(body.lat) : settings.weather_lat;
    const lon = Number.isFinite(body.lon) ? Number(body.lon) : settings.weather_lng;

    const result = await runScanner({
      mode: "demo",
      location,
      categories: Array.isArray(body.categories) ? body.categories : undefined,
      limit: Number.isFinite(body.limit) ? Number(body.limit) : 20,
      lat,
      lon,
      radius: Number.isFinite(body.radius) ? Number(body.radius) : 25,
      campaignMode: body.campaignMode,
      triggers: Array.isArray(body.triggers) ? body.triggers : undefined
    });

    addDemoScannerEvents(result.opportunities);

    return NextResponse.json({
      mode: result.mode,
      requestedMode: result.requestedMode,
      runtimeMode: result.runtimeMode,
      warnings: result.warnings,
      weatherRisk: result.weatherRisk,
      locationResolved: result.locationResolved,
      opportunities: result.opportunities
    });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = await readScannerRunBody(req);

  const mode = "live";
  const location = String(body.location || "").trim();

  let lat = Number(body.lat);
  let lon = Number(body.lon);
  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && !location) {
    const { data: settings } = await supabase
      .from("account_settings")
      .select("weather_lat,weather_lng,weather_location_label,home_base_city,home_base_state")
      .eq("account_id", accountId)
      .maybeSingle();

    if (settings?.weather_lat != null && settings?.weather_lng != null) {
      lat = Number(settings.weather_lat);
      lon = Number(settings.weather_lng);
    }

    if (!location) {
      const fallbackLabel = settings?.weather_location_label || [settings?.home_base_city, settings?.home_base_state].filter(Boolean).join(", ");
      if (fallbackLabel) {
        body.location = fallbackLabel;
      }
    }
  }

  const result = await runScanner({
    mode,
    location: String(body.location || location || "Service Area"),
    categories: Array.isArray(body.categories) ? body.categories : undefined,
    limit: Number.isFinite(body.limit) ? Number(body.limit) : 20,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    radius: Number.isFinite(body.radius) ? Number(body.radius) : 25,
    campaignMode: body.campaignMode,
    triggers: Array.isArray(body.triggers) ? body.triggers : undefined
  });
  const warnings = [...(result.warnings || [])];

  if (result.opportunities.length > 0) {
    const sourceRows = result.opportunities.map((op) => ({
      account_id: accountId,
      source_type: "scanner_signal",
      platform: op.source,
      source_url: typeof op.raw?.source_url === "string" ? op.raw.source_url : null,
      headline: op.title,
      body_text: op.description,
      published_at: op.createdAtIso || new Date().toISOString(),
      raw_location_text: op.locationText,
      signal_category: op.category,
      service_category_candidate: String(op.raw?.service_type || op.category || "general"),
      damage_keywords: op.tags,
      urgency_keywords: [String(op.raw?.urgency_window || op.priorityLabel || "monitor")],
      media_count: Array.isArray(op.raw?.media_urls) ? op.raw.media_urls.length : 0,
      raw_payload_json: {
        ...op.raw,
        scanner_opportunity_id: op.id
      }
    }));

    const { data: sourceEvents, error: sourceEventsError } = await supabase.from("source_events").insert(sourceRows).select("id");
    if (sourceEventsError) {
      warnings.push("Source event persistence is unavailable right now. The live scan still completed.");
    }
    const sourceEventIds = (sourceEvents || []).map((item) => String(item.id));

    const rows = result.opportunities.map((op) => {
      const hasVerifiedContact = hasVerifiedOwnerContact(op.raw?.enrichment);
      return {
        account_id: accountId,
        source: op.source,
        category: op.category,
        title: op.title,
        description: op.description,
        location_text: op.locationText,
        lat: op.lat,
        lon: op.lon,
        intent_score: op.intentScore,
        confidence: op.confidence,
        tags: op.tags,
        raw: {
          ...op.raw,
          scanner_opportunity_id: op.id,
          next_action: op.nextAction,
          reason_summary: op.reasonSummary,
          recommended_create_mode: op.recommendedCreateMode,
          recommended_schedule_iso: op.recommendedScheduleIso,
          ...buildScannerQualificationFields(op, hasVerifiedContact)
        }
      };
    });

    const { data: persistedScannerEvents, error: scannerEventsError } = await supabase.from("scanner_events").insert(rows).select("id,raw");
    if (scannerEventsError) {
      warnings.push("Scanner feed persistence is unavailable, so this run is shown directly from the live response.");
    }
    const scannerEventIdsByGeneratedId = new Map(
      ((persistedScannerEvents || []) as Array<{ id: string; raw?: Record<string, unknown> | null }>).map((row) => [
        String(row.raw?.scanner_opportunity_id || ""),
        String(row.id || "")
      ])
    );

    const { error: opportunitiesError } = await supabase.from("opportunities").insert(
      result.opportunities.map((op, index) => {
        const hasVerifiedContact = hasVerifiedOwnerContact(op.raw?.enrichment);
        return {
        account_id: accountId,
        source_id: null,
        category: op.category,
        lead_type: String(op.raw?.lead_type || "direct"),
        title: op.title,
        description: op.description,
        service_category: String(op.raw?.service_type || op.category || "general"),
        location_text: op.locationText,
        city: typeof op.raw?.property_city === "string" ? op.raw.property_city : null,
        state: typeof op.raw?.property_state === "string" ? op.raw.property_state : null,
        zip: typeof op.raw?.property_postal_code === "string" ? op.raw.property_postal_code : null,
        territory: typeof op.raw?.territory === "string" ? op.raw.territory : typeof op.raw?.service_area_label === "string" ? op.raw.service_area_label : null,
        lat: op.lat,
        lon: op.lon,
        intent_score: op.intentScore,
        confidence: op.confidence,
        urgency_score: Number(op.raw?.urgency_score || 0),
        tags: op.tags,
        suggested_action: op.nextAction,
        recommended_action: op.nextAction,
        source_event_ids: sourceEventIds[index] ? [sourceEventIds[index]] : [],
        status: "new",
        raw: {
          ...op.raw,
          source: op.source,
          scanner_opportunity_id: op.id,
          next_action: op.nextAction,
          reason_summary: op.reasonSummary,
          recommended_create_mode: op.recommendedCreateMode,
          recommended_schedule_iso: op.recommendedScheduleIso,
          ...buildScannerQualificationFields(op, hasVerifiedContact)
        }
      };
      })
    );
    if (opportunitiesError) {
      warnings.push("Opportunity persistence is unavailable, so the live scan did not write into the legacy pipeline tables.");
    }

    if (featureFlags.useV2Writes) {
      const { data: map } = await supabase
        .from("v2_account_tenant_map")
        .select("franchise_tenant_id")
        .eq("account_id", accountId)
        .maybeSingle();

      const franchiseTenantId = map?.franchise_tenant_id ? String(map.franchise_tenant_id) : null;

      if (franchiseTenantId) {
        let { data: sourceRow } = await supabase
          .from("v2_data_sources")
          .select("id")
          .eq("tenant_id", franchiseTenantId)
          .eq("source_type", "scanner_signal")
          .limit(1)
          .maybeSingle();

        if (!sourceRow?.id) {
          const { data: insertedSource } = await supabase
            .from("v2_data_sources")
            .insert({
              tenant_id: franchiseTenantId,
              source_type: "scanner_signal",
              name: "Legacy Scanner Signals",
              status: "active",
              terms_status: "approved",
              reliability_score: 72,
              compliance_flags: { source: "scanner" },
              provenance: "api/scanner/run",
              freshness_timestamp: new Date().toISOString()
            })
            .select("id")
            .single();
          sourceRow = insertedSource || null;
        }

        if (sourceRow?.id) {
          const sourceId = String(sourceRow.id);
          for (const op of result.opportunities) {
            const occurredAt = op.createdAtIso || new Date().toISOString();
            const dedupeKey = `${op.id}|${occurredAt}`;
            const hasVerifiedContact = hasVerifiedOwnerContact(op.raw?.enrichment);

            const { data: sourceEvent } = await supabase
              .from("v2_source_events")
              .upsert(
                {
                  source_id: sourceId,
                  tenant_id: franchiseTenantId,
                  occurred_at: occurredAt,
                  ingested_at: new Date().toISOString(),
                  raw_payload: {
                    ...op.raw,
                    scanner_opportunity_id: op.id
                  },
                  normalized_payload: {
                    title: op.title,
                    description: op.description,
                    category: op.category,
                    platform: op.source,
                    source_provenance: typeof op.raw?.source_provenance === "string" ? op.raw.source_provenance : op.source,
                    connector_key: typeof op.raw?.connector_key === "string" ? op.raw.connector_key : null
                  },
                  source_provenance: typeof op.raw?.source_provenance === "string" ? op.raw.source_provenance : null,
                  location_text: op.locationText,
                  confidence_score: op.confidence,
                  source_reliability_score: op.confidence,
                  compliance_status: "approved",
                  dedupe_key: dedupeKey,
                  event_type: String(op.category || "scanner_signal")
                },
                { onConflict: "source_id,dedupe_key" }
              )
              .select("id")
              .single();

            const score = computeOpportunityScores({
              sourceType: String(op.source || "scanner_signal"),
              eventRecencyMinutes: 5,
              severity: Number(op.raw?.urgency_score || op.intentScore || 50),
              geographyMatch: op.locationText ? 70 : 35,
              propertyTypeFit: 55,
              serviceLineFit: 78,
              priorCustomerMatch: 40,
              contactAvailability: hasVerifiedContact ? 78 : 18,
              supportingSignalsCount: Array.isArray(op.tags) ? op.tags.length : 1,
              catastropheSignal: Array.isArray(op.tags) && op.tags.some((tag) => /storm|flood|fire/i.test(tag)) ? 80 : 30,
              sourceReliability: op.confidence
            });

            const { data: opportunityRow } = await supabase
              .from("v2_opportunities")
              .insert({
                tenant_id: franchiseTenantId,
                source_event_id: sourceEvent?.id || null,
                opportunity_type: String(op.raw?.service_type || op.category || "general"),
                service_line: String(op.raw?.service_type || op.category || "general"),
                title: op.title,
                description: op.description,
                urgency_score: score.urgencyScore,
                job_likelihood_score: score.jobLikelihoodScore,
                contactability_score: score.contactabilityScore,
                source_reliability_score: score.sourceReliabilityScore,
                revenue_band: score.revenueBand,
                catastrophe_linkage_score: score.catastropheLinkageScore,
                location_text: op.locationText,
                postal_code: typeof op.raw?.property_postal_code === "string" ? op.raw.property_postal_code : null,
                contact_status: hasVerifiedContact ? "identified" : "unknown",
                routing_status: "pending",
                lifecycle_status: "new",
                explainability_json: {
                  ...score.explainability,
                  contact_enrichment_available: hasVerifiedContact,
                  scanner_opportunity_id: op.id,
                  ...buildScannerQualificationFields(op, hasVerifiedContact)
                }
              })
              .select("id")
              .single();

            if (opportunityRow?.id) {
              op.raw = {
                ...op.raw,
                v2_opportunity_id: opportunityRow.id,
                ...buildScannerQualificationFields(op, hasVerifiedContact)
              };
              const scannerEventId = scannerEventIdsByGeneratedId.get(op.id);
              if (scannerEventId) {
                await supabase
                  .from("scanner_events")
                  .update({
                    raw: {
                      ...op.raw,
                      scanner_opportunity_id: op.id,
                      v2_opportunity_id: opportunityRow.id,
                      next_action: op.nextAction,
                      reason_summary: op.reasonSummary,
                      recommended_create_mode: op.recommendedCreateMode,
                      recommended_schedule_iso: op.recommendedScheduleIso
                    }
                  })
                  .eq("account_id", accountId)
                  .eq("id", scannerEventId);
              }
              await supabase.from("v2_opportunity_signals").insert({
                tenant_id: franchiseTenantId,
                opportunity_id: opportunityRow.id,
                signal_key: "job_likelihood_score",
                signal_value: score.jobLikelihoodScore,
                signal_weight: 1,
                explanation: "v2 backfill score from scanner run"
              });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    mode: result.mode,
    requestedMode: result.requestedMode,
    runtimeMode: result.runtimeMode,
    warnings,
    weatherRisk: result.weatherRisk,
    locationResolved: result.locationResolved,
    opportunities: result.opportunities
  });
}

async function readScannerRunBody(req: NextRequest): Promise<ScannerRunRequestBody> {
  try {
    return (await req.json()) as ScannerRunRequestBody;
  } catch {
    return {};
  }
}
