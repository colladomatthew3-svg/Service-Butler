"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const scanner_1 = require("@/lib/services/scanner");
const review_mode_1 = require("@/lib/services/review-mode");
const feature_flags_1 = require("@/lib/config/feature-flags");
const scoring_1 = require("@/lib/v2/scoring");
async function POST(req) {
    if ((0, review_mode_1.isDemoMode)()) {
        const body = await readScannerRunBody(req);
        const settings = await (0, store_1.getDemoWeatherSettings)();
        const location = String(body.location || "").trim() || settings.weather_location_label;
        const lat = Number.isFinite(body.lat) ? Number(body.lat) : settings.weather_lat;
        const lon = Number.isFinite(body.lon) ? Number(body.lon) : settings.weather_lng;
        const result = await (0, scanner_1.runScanner)({
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
        (0, store_1.addDemoScannerEvents)(result.opportunities);
        return server_1.NextResponse.json({
            mode: result.mode,
            weatherRisk: result.weatherRisk,
            locationResolved: result.locationResolved,
            opportunities: result.opportunities
        });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
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
    const result = await (0, scanner_1.runScanner)({
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
        const { data: sourceEvents } = await supabase.from("source_events").insert(sourceRows).select("id");
        const sourceEventIds = (sourceEvents || []).map((item) => String(item.id));
        const rows = result.opportunities.map((op) => ({
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
                recommended_schedule_iso: op.recommendedScheduleIso
            }
        }));
        await supabase.from("scanner_events").insert(rows);
        await supabase.from("opportunities").insert(result.opportunities.map((op, index) => ({
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
                recommended_schedule_iso: op.recommendedScheduleIso
            }
        })));
        if (feature_flags_1.featureFlags.useV2Writes) {
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
                        const { data: sourceEvent } = await supabase
                            .from("v2_source_events")
                            .upsert({
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
                                platform: op.source
                            },
                            location_text: op.locationText,
                            confidence_score: op.confidence,
                            source_reliability_score: op.confidence,
                            compliance_status: "approved",
                            dedupe_key: dedupeKey,
                            event_type: String(op.category || "scanner_signal")
                        }, { onConflict: "source_id,dedupe_key" })
                            .select("id")
                            .single();
                        const score = (0, scoring_1.computeOpportunityScores)({
                            sourceType: String(op.source || "scanner_signal"),
                            eventRecencyMinutes: 5,
                            severity: Number(op.raw?.urgency_score || op.intentScore || 50),
                            geographyMatch: op.locationText ? 70 : 35,
                            propertyTypeFit: 55,
                            serviceLineFit: 78,
                            priorCustomerMatch: 40,
                            contactAvailability: 45,
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
                            contact_status: "identified",
                            routing_status: "pending",
                            lifecycle_status: "new",
                            explainability_json: score.explainability
                        })
                            .select("id")
                            .single();
                        if (opportunityRow?.id) {
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
    return server_1.NextResponse.json({
        mode: result.mode,
        weatherRisk: result.weatherRisk,
        locationResolved: result.locationResolved,
        opportunities: result.opportunities
    });
}
async function readScannerRunBody(req) {
    try {
        return (await req.json());
    }
    catch {
        return {};
    }
}
