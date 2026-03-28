"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permitsConnector = void 0;
const providers_1 = require("@/lib/v2/connectors/permits/providers");
const CONNECTOR_VERSION = "v2.2.0";
function toIso(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return new Date().toISOString();
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()))
        return new Date().toISOString();
    return date.toISOString();
}
function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function computeFreshnessScore(occurredAtIso) {
    const occurred = new Date(occurredAtIso).getTime();
    const ageHours = Math.max(0, (Date.now() - occurred) / 3_600_000);
    return Math.max(0, Math.min(100, Math.round(100 - ageHours * 4)));
}
function normalizeText(value) {
    return String(value || "").toLowerCase();
}
function classifyPermitCategory(record) {
    const text = `${record.permit_type || ""} ${record.work_class || ""} ${record.description || ""} ${record.scope || ""}`.toLowerCase();
    if (text.includes("roof") || text.includes("shingle"))
        return "roof";
    if (text.includes("plumb") || text.includes("sewer") || text.includes("pipe") || text.includes("drain"))
        return "plumbing";
    if (text.includes("hvac") || text.includes("furnace") || text.includes("boiler") || text.includes("ac ") || text.includes("air condition"))
        return "hvac";
    if (text.includes("electrical") || text.includes("panel") || text.includes("wiring"))
        return "electrical";
    if (text.includes("remediation") || text.includes("repair") || text.includes("restoration") || text.includes("mitigation")) {
        return "remediation_repair";
    }
    return "renovation";
}
function categoryToServiceLines(category) {
    if (category === "roof")
        return ["roofing", "restoration"];
    if (category === "plumbing")
        return ["plumbing", "restoration"];
    if (category === "hvac")
        return ["hvac"];
    if (category === "electrical")
        return ["electrical"];
    if (category === "remediation_repair")
        return ["restoration", "general"];
    return ["general"];
}
function inferDemandTiming(record, category) {
    const text = `${record.description || ""} ${record.scope || ""}`.toLowerCase();
    const immediateKeywords = ["emergency", "damage", "leak", "burst", "fire", "flood", "mitigation", "unsafe"];
    const immediate = immediateKeywords.some((keyword) => text.includes(keyword));
    if (immediate) {
        return {
            demandTiming: "immediate_service_demand",
            severityHint: 76,
            urgencyHint: 80,
            likelyJobType: category === "roof"
                ? "roof damage inspection"
                : category === "plumbing"
                    ? "emergency plumbing"
                    : category === "remediation_repair"
                        ? "water mitigation"
                        : category === "hvac"
                            ? "HVAC outage"
                            : "repair dispatch"
        };
    }
    return {
        demandTiming: "downstream_upsell",
        severityHint: category === "renovation" ? 38 : 52,
        urgencyHint: category === "renovation" ? 35 : 48,
        likelyJobType: category === "roof"
            ? "roof damage inspection"
            : category === "plumbing"
                ? "plumbing service"
                : category === "hvac"
                    ? "HVAC replacement consult"
                    : category === "electrical"
                        ? "electrical safety inspection"
                        : "renovation follow-up"
    };
}
function classifyOpportunityType(category) {
    if (category === "roof")
        return "roof_permit_signal";
    if (category === "plumbing")
        return "plumbing_permit_signal";
    if (category === "hvac")
        return "hvac_permit_signal";
    if (category === "electrical")
        return "electrical_permit_signal";
    if (category === "remediation_repair")
        return "restoration_permit_signal";
    return "permit_signal";
}
exports.permitsConnector = {
    key: "permits.production",
    async pull(input) {
        const provider = (0, providers_1.resolvePermitsProvider)(input);
        return provider.fetchRecords(input);
    },
    async normalize(records, input) {
        const provider = (0, providers_1.resolvePermitsProvider)(input);
        const termsStatus = provider.termsStatus(input);
        const sourceProvenance = provider.sourceProvenance(input);
        return records.map((record, index) => {
            const title = String(record.title || record.permit_type || `Permit event ${index + 1}`);
            const occurredAt = toIso(record.occurred_at || record.issued_at || record.created_at);
            const freshnessScore = computeFreshnessScore(occurredAt);
            const category = classifyPermitCategory(record);
            const serviceLineCandidates = categoryToServiceLines(category);
            const demand = inferDemandTiming(record, category);
            const primaryServiceLine = serviceLineCandidates[0] || "general";
            const contactName = String(record.owner_name || record.applicant_name || record.contractor_name || record.contact_name || record.business_name || "").trim();
            const contactPhone = String(record.owner_phone || record.applicant_phone || record.contractor_phone || record.contact_phone || record.phone || "").trim();
            const contactEmail = String(record.owner_email || record.applicant_email || record.contractor_email || record.contact_email || record.email || "").trim();
            return {
                occurredAt,
                dedupeKey: `${record.id || record.permit_number || title}|${occurredAt}`,
                eventType: String(record.event_type || "permit_signal"),
                eventCategory: "permit",
                title,
                description: String(record.description || record.scope || ""),
                locationText: String(record.location || record.address || record.city || ""),
                addressText: String(record.address || record.location || ""),
                city: String(record.city || ""),
                state: String(record.state || ""),
                postalCode: String(record.postal_code || record.zip || ""),
                latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
                longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
                serviceLine: primaryServiceLine,
                serviceLineCandidates,
                severity: toNumber(record.severity, demand.severityHint),
                severityHint: demand.severityHint,
                urgencyHint: demand.urgencyHint,
                likelyJobType: demand.likelyJobType,
                estimatedResponseWindow: demand.demandTiming === "immediate_service_demand" ? "0-4h" : "24-72h",
                sourceName: String(input.config.connector_name || input.config.source_name || "Permits Provider"),
                sourceProvenance,
                sourceReliability: toNumber(record.source_reliability, 74),
                supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
                catastropheSignal: toNumber(record.catastrophe_signal, category === "remediation_repair" ? 40 : 12),
                rawPayload: record,
                normalizedPayload: {
                    permit_id: record.id || record.permit_number || null,
                    permit_type: record.permit_type || null,
                    work_class: record.work_class || record.scope || null,
                    contact_name: contactName || null,
                    contact_phone: contactPhone || null,
                    contact_email: contactEmail || null,
                    permit_category: category,
                    demand_timing: demand.demandTiming,
                    service_line_candidates: serviceLineCandidates,
                    likely_job_type: demand.likelyJobType,
                    source_provenance: sourceProvenance,
                    terms_status: termsStatus,
                    data_freshness_score: freshnessScore,
                    connector_version: CONNECTOR_VERSION,
                    provider_key: provider.key
                }
            };
        });
    },
    dedupeKey(event) {
        return event.dedupeKey;
    },
    classify(event) {
        const category = normalizeText(event.normalizedPayload.permit_category);
        if (category === "roof")
            return { opportunityType: "roof_permit_signal", serviceLine: "roofing" };
        if (category === "plumbing")
            return { opportunityType: "plumbing_permit_signal", serviceLine: "plumbing" };
        if (category === "hvac")
            return { opportunityType: "hvac_permit_signal", serviceLine: "hvac" };
        if (category === "electrical")
            return { opportunityType: "electrical_permit_signal", serviceLine: "electrical" };
        if (category === "remediation_repair")
            return { opportunityType: "restoration_permit_signal", serviceLine: "restoration" };
        return { opportunityType: classifyOpportunityType("renovation"), serviceLine: event.serviceLine || "general" };
    },
    compliancePolicy(input) {
        const provider = (0, providers_1.resolvePermitsProvider)(input);
        const termsStatus = provider.termsStatus(input);
        const approved = termsStatus === "approved";
        return {
            termsStatus,
            ingestionAllowed: approved,
            outboundAllowed: approved,
            requiresLegalReview: !approved,
            notes: approved
                ? "Permits provider approved for ingestion"
                : "Permits ingestion blocked until terms_status=approved"
        };
    },
    async healthcheck(input) {
        const provider = (0, providers_1.resolvePermitsProvider)(input);
        const start = Date.now();
        const records = await provider.fetchRecords(input).catch(() => []);
        const latencyMs = Date.now() - start;
        return {
            ok: true,
            latencyMs,
            detail: `Provider ${provider.key} reachable; sample_count=${records.length}`
        };
    }
};
