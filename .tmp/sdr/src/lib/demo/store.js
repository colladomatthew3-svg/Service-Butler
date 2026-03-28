"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDemoAccountContext = getDemoAccountContext;
exports.getDemoWeatherSettings = getDemoWeatherSettings;
exports.createDemoWeatherCookieValue = createDemoWeatherCookieValue;
exports.listDemoRoutingRules = listDemoRoutingRules;
exports.upsertDemoRoutingRule = upsertDemoRoutingRule;
exports.patchDemoRoutingRule = patchDemoRoutingRule;
exports.deleteDemoRoutingRule = deleteDemoRoutingRule;
exports.addDemoScannerEvents = addDemoScannerEvents;
exports.listDemoScannerEvents = listDemoScannerEvents;
exports.getDemoDashboardSnapshot = getDemoDashboardSnapshot;
exports.listDemoLeads = listDemoLeads;
exports.createDemoLead = createDemoLead;
exports.getDemoLead = getDemoLead;
exports.getFirstDemoLeadId = getFirstDemoLeadId;
exports.getDemoJob = getDemoJob;
exports.getDemoLeadSignals = getDemoLeadSignals;
exports.updateDemoLead = updateDemoLead;
exports.convertDemoLeadToJob = convertDemoLeadToJob;
exports.dispatchDemoScannerEvent = dispatchDemoScannerEvent;
exports.listDemoProspects = listDemoProspects;
exports.createDemoProspect = createDemoProspect;
exports.listDemoReferralPartners = listDemoReferralPartners;
exports.createDemoReferralPartner = createDemoReferralPartner;
exports.listDemoOutboundLists = listDemoOutboundLists;
exports.createDemoOutboundList = createDemoOutboundList;
exports.createDemoIncidentTriggeredList = createDemoIncidentTriggeredList;
exports.syncDemoOutboundList = syncDemoOutboundList;
exports.getDemoOutboundListCsv = getDemoOutboundListCsv;
const headers_1 = require("next/headers");
const intent_engine_1 = require("@/lib/services/intent-engine");
const scanner_1 = require("@/lib/services/scanner");
const outbound_1 = require("@/lib/services/outbound");
const DEMO_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const WEATHER_COOKIE = "sb_demo_weather";
const DEFAULT_WEATHER = {
    weather_location_label: "Brentwood, NY 11717",
    weather_lat: 40.7812,
    weather_lng: -73.2462,
    home_base_city: "Brentwood",
    home_base_state: "NY",
    home_base_postal_code: "11717"
};
function nowIso() {
    return new Date().toISOString();
}
function generateId(prefix, seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${Math.abs(hash >>> 0).toString(16)}`;
}
function initialRoutingRules() {
    const createdAt = nowIso();
    return [
        {
            id: "rule-restoration",
            account_id: DEMO_ACCOUNT_ID,
            category: "restoration",
            default_assignee: "Storm Desk",
            default_create_mode: "job",
            default_job_value_cents: 95000,
            default_sla_minutes: 45,
            enabled: true,
            created_at: createdAt,
            updated_at: createdAt
        },
        {
            id: "rule-plumbing",
            account_id: DEMO_ACCOUNT_ID,
            category: "plumbing",
            default_assignee: "Dispatch Queue",
            default_create_mode: "lead",
            default_job_value_cents: 65000,
            default_sla_minutes: 60,
            enabled: true,
            created_at: createdAt,
            updated_at: createdAt
        },
        {
            id: "rule-demolition",
            account_id: DEMO_ACCOUNT_ID,
            category: "demolition",
            default_assignee: "Mitigation Crew",
            default_create_mode: "job",
            default_job_value_cents: 120000,
            default_sla_minutes: 90,
            enabled: true,
            created_at: createdAt,
            updated_at: createdAt
        }
    ];
}
function initialLeads() {
    return [
        {
            id: "lead-demo-1",
            created_at: nowIso(),
            status: "new",
            stage: "NEW",
            name: "Sarah Parker",
            phone: "+1 631-555-0142",
            service_type: "Restoration",
            address: "18 Oak Lane",
            city: "Brentwood",
            state: "NY",
            postal_code: "11717",
            requested_timeframe: "ASAP",
            source: "scanner",
            notes: "Recent water intrusion signal after overnight rain.",
            scheduled_for: null,
            converted_job_id: null,
            intentScore: 84,
            signalCount: 4,
            enrichment: null
        },
        {
            id: "lead-demo-2",
            created_at: nowIso(),
            status: "contacted",
            stage: "CONTACTED",
            name: "Miguel Brooks",
            phone: "+1 631-555-0188",
            service_type: "Plumbing",
            address: "204 Pine Street",
            city: "Bay Shore",
            state: "NY",
            postal_code: "11706",
            requested_timeframe: "Today",
            source: "import",
            notes: "Basement pump issue reported during heavy rain band.",
            scheduled_for: null,
            converted_job_id: null,
            intentScore: 71,
            signalCount: 3,
            enrichment: null
        }
    ];
}
function initialJobs() {
    const scheduled = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    return [
        {
            id: "job-demo-1",
            customer_name: "Chris Bennett",
            service_type: "Restoration",
            pipeline_status: "SCHEDULED",
            scheduled_for: scheduled,
            estimated_value: 4200,
            city: "Brentwood",
            state: "NY",
            intent_score: 82,
            lead_id: "lead-demo-1"
        }
    ];
}
function initialProspects() {
    const createdAt = nowIso();
    return [
        {
            id: "prospect-demo-1",
            company_name: "Harbor Point Property Management",
            contact_name: "Dana Reeves",
            title: "Regional Property Manager",
            email: "dana@harborpointpm.example",
            phone: "+1 631-555-1101",
            website: "https://harborpointpm.example",
            city: "Hauppauge",
            state: "NY",
            zip: "11788",
            territory: "Suffolk County, NY",
            prospect_type: "property_manager",
            property_type: "multifamily",
            building_count: 18,
            priority_tier: "tier_1",
            strategic_value: 87,
            near_active_incident: true,
            last_outbound_at: null,
            notes: "Manages multifamily and condo properties across central Suffolk.",
            tags: ["multifamily", "storm-response"],
            source: "seed",
            created_at: createdAt,
            updated_at: createdAt
        },
        {
            id: "prospect-demo-2",
            company_name: "North Shore Facilities Group",
            contact_name: "Julian Marks",
            title: "Facilities Director",
            email: "julian@northshorefg.example",
            phone: "+1 516-555-2230",
            website: "https://northshorefg.example",
            city: "Mineola",
            state: "NY",
            zip: "11501",
            territory: "Nassau County, NY",
            prospect_type: "facilities_manager",
            property_type: "commercial",
            building_count: 9,
            priority_tier: "tier_1",
            strategic_value: 82,
            near_active_incident: true,
            last_outbound_at: null,
            notes: "Operates commercial sites that need emergency vendors on call.",
            tags: ["commercial", "emergency"],
            source: "seed",
            created_at: createdAt,
            updated_at: createdAt
        },
        {
            id: "prospect-demo-3",
            company_name: "Queens Warehouse Portfolio",
            contact_name: "Mina Patel",
            title: "Asset Manager",
            email: "mina@queenswarehouse.example",
            phone: "+1 718-555-0044",
            website: "https://queenswarehouse.example",
            city: "Long Island City",
            state: "NY",
            zip: "11101",
            territory: "Queens, NY",
            prospect_type: "commercial_owner",
            property_type: "industrial",
            building_count: 4,
            priority_tier: "tier_2",
            strategic_value: 74,
            near_active_incident: false,
            last_outbound_at: null,
            notes: "Warehouse owner with regional vendor turnover.",
            tags: ["industrial"],
            source: "seed",
            created_at: createdAt,
            updated_at: createdAt
        }
    ];
}
function initialReferralPartners() {
    const createdAt = nowIso();
    return [
        {
            id: "partner-demo-1",
            company_name: "Mason Public Adjusting",
            contact_name: "Eric Mason",
            title: "Principal Adjuster",
            email: "eric@masonpa.example",
            phone: "+1 631-555-4400",
            website: "https://masonpa.example",
            city: "Patchogue",
            state: "NY",
            zip: "11772",
            territory: "Suffolk County, NY",
            partner_type: "public_adjuster",
            priority_tier: "tier_1",
            strategic_value: 90,
            near_active_incident: true,
            last_outbound_at: null,
            notes: "Good fit for water-loss and fire-loss referrals.",
            tags: ["claims", "restoration"],
            source: "seed",
            created_at: createdAt,
            updated_at: createdAt
        },
        {
            id: "partner-demo-2",
            company_name: "Boro Plumbing Response",
            contact_name: "Kenny Torres",
            title: "Owner",
            email: "kenny@boroplumbing.example",
            phone: "+1 718-555-8420",
            website: "https://boroplumbing.example",
            city: "Brooklyn",
            state: "NY",
            zip: "11211",
            territory: "Brooklyn, NY",
            partner_type: "plumber",
            priority_tier: "tier_1",
            strategic_value: 78,
            near_active_incident: true,
            last_outbound_at: null,
            notes: "Emergency water-loss and burst-pipe referral partner.",
            tags: ["burst-pipe", "after-hours"],
            source: "seed",
            created_at: createdAt,
            updated_at: createdAt
        },
        {
            id: "partner-demo-3",
            company_name: "Tri-State Roofing Alliance",
            contact_name: "Nina Doyle",
            title: "Business Development",
            email: "nina@tristateroof.example",
            phone: "+1 201-555-7781",
            website: "https://tristateroof.example",
            city: "Jersey City",
            state: "NJ",
            zip: "07302",
            territory: "Hudson County, NJ",
            partner_type: "roofer",
            priority_tier: "tier_2",
            strategic_value: 73,
            near_active_incident: false,
            last_outbound_at: null,
            notes: "Storm-damage and tarp referrals across North Jersey.",
            tags: ["storm-response"],
            source: "seed",
            created_at: createdAt,
            updated_at: createdAt
        }
    ];
}
function initialStore() {
    return {
        routingRules: initialRoutingRules(),
        scannerEvents: [],
        opportunities: [],
        leads: initialLeads(),
        jobs: initialJobs(),
        prospects: initialProspects(),
        referralPartners: initialReferralPartners(),
        outboundLists: [],
        outboundListMembers: [],
        smartleadSyncLogs: []
    };
}
function getStore() {
    if (!globalThis.__serviceButlerDemoStore) {
        globalThis.__serviceButlerDemoStore = initialStore();
    }
    return globalThis.__serviceButlerDemoStore;
}
function getDemoAccountContext() {
    return {
        accountId: DEMO_ACCOUNT_ID,
        userId: DEMO_USER_ID,
        email: "owner@servicebutler.local"
    };
}
async function getDemoWeatherSettings() {
    const cookieStore = await (0, headers_1.cookies)();
    const raw = cookieStore.get(WEATHER_COOKIE)?.value;
    if (!raw)
        return DEFAULT_WEATHER;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.weather_location_label !== "string")
            return DEFAULT_WEATHER;
        if (!Number.isFinite(parsed.weather_lat) || !Number.isFinite(parsed.weather_lng))
            return DEFAULT_WEATHER;
        return {
            weather_location_label: parsed.weather_location_label,
            weather_lat: Number(parsed.weather_lat),
            weather_lng: Number(parsed.weather_lng),
            home_base_city: parsed.home_base_city ?? null,
            home_base_state: parsed.home_base_state ?? null,
            home_base_postal_code: parsed.home_base_postal_code ?? null
        };
    }
    catch {
        return DEFAULT_WEATHER;
    }
}
function createDemoWeatherCookieValue(settings) {
    return JSON.stringify(settings);
}
function listDemoRoutingRules() {
    return [...getStore().routingRules].sort((a, b) => a.category.localeCompare(b.category));
}
function upsertDemoRoutingRule(input) {
    const store = getStore();
    const existing = store.routingRules.find((rule) => rule.category === input.category);
    const timestamp = nowIso();
    if (existing) {
        Object.assign(existing, input, { updated_at: timestamp });
        return existing;
    }
    const rule = {
        ...input,
        id: generateId("rule", input.category),
        account_id: DEMO_ACCOUNT_ID,
        created_at: timestamp,
        updated_at: timestamp
    };
    store.routingRules.push(rule);
    return rule;
}
function patchDemoRoutingRule(id, patch) {
    const store = getStore();
    const rule = store.routingRules.find((item) => item.id === id);
    if (!rule)
        return null;
    Object.assign(rule, patch, { updated_at: nowIso() });
    return rule;
}
function deleteDemoRoutingRule(id) {
    const store = getStore();
    const next = store.routingRules.filter((rule) => rule.id !== id);
    const deleted = next.length !== store.routingRules.length;
    store.routingRules = next;
    return deleted;
}
function addDemoScannerEvents(opportunities) {
    const store = getStore();
    const createdAt = nowIso();
    const events = opportunities.map((opportunity) => ({
        id: opportunity.id,
        source: opportunity.source,
        category: opportunity.category,
        title: opportunity.title,
        description: opportunity.description,
        location_text: opportunity.locationText,
        lat: opportunity.lat,
        lon: opportunity.lon,
        intent_score: opportunity.intentScore,
        confidence: opportunity.confidence,
        tags: opportunity.tags,
        raw: {
            ...opportunity.raw,
            next_action: opportunity.nextAction,
            reason_summary: opportunity.reasonSummary,
            recommended_create_mode: opportunity.recommendedCreateMode,
            recommended_schedule_iso: opportunity.recommendedScheduleIso
        },
        created_at: opportunity.createdAtIso || createdAt
    }));
    store.scannerEvents = [...events, ...store.scannerEvents].slice(0, 120);
    for (const opportunity of opportunities) {
        if (!store.opportunities.some((item) => item.id === opportunity.id)) {
            store.opportunities.unshift({
                id: opportunity.id,
                category: opportunity.category,
                title: opportunity.title,
                location_text: opportunity.locationText,
                intent_score: opportunity.intentScore,
                confidence: opportunity.confidence,
                created_at: opportunity.createdAtIso || createdAt,
                status: "new",
                raw: opportunity.raw
            });
        }
    }
    store.opportunities = store.opportunities.slice(0, 120);
    return events;
}
function listDemoScannerEvents({ source, category, limit, query }) {
    const q = String(query || "").trim().toLowerCase();
    const items = getStore().scannerEvents.filter((event) => {
        if (source && source !== "all" && event.source !== source)
            return false;
        if (category && category !== "all" && event.category !== category)
            return false;
        if (!q)
            return true;
        const haystack = `${event.title} ${event.description} ${event.location_text}`.toLowerCase();
        return haystack.includes(q);
    });
    return items.slice(0, limit || 50);
}
function getDemoDashboardSnapshot() {
    const store = getStore();
    const leads = [...store.leads];
    const jobs = [...store.jobs];
    const opportunities = [...store.opportunities];
    const prospects = [...store.prospects];
    const referralPartners = [...store.referralPartners];
    const outboundLists = [...store.outboundLists];
    return { leads, jobs, opportunities, prospects, referralPartners, outboundLists };
}
function listDemoLeads({ status, service, search }) {
    const q = String(search || "").trim().toLowerCase();
    const leads = [...getStore().leads]
        .filter((lead) => {
        if (status && status !== "all" && lead.status !== status)
            return false;
        if (service && service !== "all" && lead.service_type !== service)
            return false;
        if (!q)
            return true;
        const haystack = `${lead.name} ${lead.phone} ${lead.address} ${lead.city} ${lead.state}`.toLowerCase();
        return haystack.includes(q);
    })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const enriched = leads.map((lead) => ({
        ...lead,
        intentScore: lead.intentScore ?? 0,
        signalCount: lead.signalCount ?? getDemoLeadSignals(lead.id).length
    }));
    const counts = enriched.reduce((acc, lead) => {
        const key = String(lead.status || "new");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    return { leads: enriched, counts };
}
function createDemoLead(input) {
    const store = getStore();
    const leadId = generateId("lead", `${input.name}:${input.phone}:${input.address || input.city || nowIso()}`);
    const leadSignals = (0, intent_engine_1.generateSignals)({
        lead: {
            id: leadId,
            service_type: input.service_type.trim(),
            requested_timeframe: input.requested_timeframe?.trim() || "ASAP",
            city: input.city?.trim() || "",
            state: input.state?.trim() || ""
        }
    });
    const lead = {
        id: leadId,
        created_at: nowIso(),
        status: "new",
        stage: "NEW",
        name: input.name.trim(),
        phone: input.phone.trim(),
        service_type: input.service_type.trim(),
        address: input.address?.trim() || "",
        city: input.city?.trim() || "",
        state: input.state?.trim() || "",
        postal_code: input.postal_code?.trim() || "",
        requested_timeframe: input.requested_timeframe?.trim() || "ASAP",
        source: input.source?.trim() || "manual",
        notes: input.notes?.trim() || "",
        scheduled_for: null,
        converted_job_id: null,
        intentScore: leadSignals.length ? Math.round(leadSignals.reduce((sum, signal) => sum + Number(signal.score || 0), 0) / leadSignals.length) : 0,
        signalCount: leadSignals.length,
        enrichment: null
    };
    store.leads.unshift(lead);
    return lead;
}
function getDemoLead(id) {
    return getStore().leads.find((lead) => lead.id === id) || null;
}
function getFirstDemoLeadId() {
    return getStore().leads[0]?.id || null;
}
function getDemoJob(id) {
    return getStore().jobs.find((job) => job.id === id) || null;
}
function getDemoLeadSignals(id) {
    const lead = getDemoLead(id);
    if (!lead)
        return [];
    return (0, intent_engine_1.generateSignals)({
        lead: {
            id: lead.id,
            service_type: lead.service_type,
            requested_timeframe: lead.requested_timeframe,
            city: lead.city,
            state: lead.state
        }
    }).map((signal, index) => ({
        id: `${lead.id}-signal-${index + 1}`,
        created_at: nowIso(),
        ...signal
    }));
}
function updateDemoLead(id, patch) {
    const lead = getStore().leads.find((item) => item.id === id);
    if (!lead)
        return null;
    Object.assign(lead, patch);
    return lead;
}
function convertDemoLeadToJob(id) {
    const store = getStore();
    const lead = store.leads.find((item) => item.id === id);
    if (!lead)
        return null;
    if (lead.converted_job_id) {
        return { jobId: lead.converted_job_id, created: false };
    }
    const existing = store.jobs.find((job) => job.lead_id === id);
    if (existing) {
        lead.converted_job_id = existing.id;
        lead.status = "scheduled";
        lead.stage = "BOOKED";
        lead.scheduled_for = existing.scheduled_for;
        return { jobId: existing.id, created: false };
    }
    const scheduledFor = lead.requested_timeframe?.toLowerCase().includes("today")
        ? new Date(new Date().setHours(14, 0, 0, 0)).toISOString()
        : lead.requested_timeframe?.toLowerCase().includes("tomorrow")
            ? new Date(new Date().setDate(new Date().getDate() + 1)).toISOString()
            : new Date(Date.now() + 90 * 60_000).toISOString();
    const scores = getDemoLeadSignals(id).map((signal) => Number(signal.score) || 0);
    const intent = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : lead.intentScore;
    const jobId = generateId("job", `${id}:converted`);
    store.jobs.unshift({
        id: jobId,
        customer_name: lead.name,
        service_type: lead.service_type,
        pipeline_status: "NEW",
        scheduled_for: scheduledFor,
        estimated_value: 0,
        city: lead.city,
        state: lead.state,
        intent_score: intent,
        lead_id: lead.id
    });
    lead.converted_job_id = jobId;
    lead.status = "scheduled";
    lead.stage = "BOOKED";
    lead.scheduled_for = scheduledFor;
    return { jobId, created: true };
}
function dispatchDemoScannerEvent(id, createMode) {
    const store = getStore();
    const event = store.scannerEvents.find((item) => item.id === id);
    if (!event)
        return null;
    const rule = store.routingRules.find((item) => item.category === event.category && item.enabled);
    const mode = createMode || rule?.default_create_mode || (event.intent_score >= 76 ? "job" : "lead");
    const leadPayload = (0, scanner_1.opportunityToLeadPayload)({
        id: event.id,
        source: event.source,
        category: event.category,
        title: event.title,
        description: event.description,
        locationText: event.location_text,
        lat: event.lat,
        lon: event.lon,
        intentScore: event.intent_score,
        priorityLabel: event.intent_score >= 82 ? "Call now" : event.intent_score >= 68 ? "Follow up" : "Schedule later",
        confidence: event.confidence,
        tags: event.tags,
        nextAction: String(event.raw.next_action || "Call within SLA."),
        reasonSummary: String(event.raw.reason_summary || "Weather and service signals matched."),
        recommendedCreateMode: mode,
        recommendedScheduleIso: typeof event.raw.recommended_schedule_iso === "string" ? event.raw.recommended_schedule_iso : null,
        raw: event.raw,
        createdAtIso: event.created_at
    });
    const leadId = generateId("lead", `${id}:${mode}`);
    const lead = {
        id: leadId,
        created_at: nowIso(),
        status: mode === "job" ? "scheduled" : "new",
        stage: mode === "job" ? "BOOKED" : "NEW",
        name: leadPayload.name,
        phone: leadPayload.phone,
        service_type: leadPayload.service_type,
        address: leadPayload.address || "",
        city: leadPayload.city,
        state: leadPayload.state,
        postal_code: leadPayload.postal_code,
        requested_timeframe: leadPayload.requested_timeframe,
        source: "scanner",
        notes: leadPayload.notes || "",
        scheduled_for: null,
        converted_job_id: null,
        intentScore: event.intent_score,
        signalCount: event.tags.length,
        enrichment: event.raw.enrichment || null
    };
    store.leads.unshift(lead);
    let jobId = null;
    if (mode === "job") {
        jobId = generateId("job", `${id}:${mode}`);
        const scheduleIso = (typeof event.raw.recommended_schedule_iso === "string" && event.raw.recommended_schedule_iso) ||
            new Date(Date.now() + (rule?.default_sla_minutes || 60) * 60_000).toISOString();
        const job = {
            id: jobId,
            customer_name: lead.name,
            service_type: lead.service_type,
            pipeline_status: "SCHEDULED",
            scheduled_for: scheduleIso,
            estimated_value: Math.round((rule?.default_job_value_cents || 65000) / 100),
            city: lead.city,
            state: lead.state,
            intent_score: event.intent_score,
            lead_id: lead.id
        };
        lead.status = "scheduled";
        lead.stage = "BOOKED";
        lead.scheduled_for = scheduleIso;
        lead.converted_job_id = job.id;
        store.jobs.unshift(job);
    }
    store.opportunities = store.opportunities.map((item) => (item.id === id ? { ...item, status: "claimed" } : item));
    return {
        mode,
        leadId,
        jobId,
        message: mode === "job"
            ? "Signal detected, opportunity converted, and inspection scheduled in the demo flow."
            : "Signal detected, opportunity surfaced, and lead created in the demo inbox."
    };
}
function listDemoProspects({ territory, segment, search, nearIncident }) {
    const q = String(search || "").trim().toLowerCase();
    return [...getStore().prospects]
        .filter((item) => {
        if (territory && territory !== "all" && item.territory !== territory)
            return false;
        if (segment && segment !== "all" && item.prospect_type !== segment)
            return false;
        if (nearIncident != null && item.near_active_incident !== nearIncident)
            return false;
        if (!q)
            return true;
        const haystack = `${item.company_name} ${item.contact_name || ""} ${item.city || ""} ${item.state || ""}`.toLowerCase();
        return haystack.includes(q);
    })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function createDemoProspect(input) {
    const createdAt = nowIso();
    const prospect = {
        id: generateId("prospect", `${input.company_name}:${input.email}:${createdAt}`),
        company_name: String(input.company_name || "New Prospect").trim(),
        contact_name: input.contact_name || null,
        title: input.title || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        city: input.city || null,
        state: input.state || null,
        zip: input.zip || null,
        territory: input.territory || (0, outbound_1.buildTerritory)([input.city, input.state]),
        prospect_type: String(input.prospect_type || "property_manager"),
        property_type: input.property_type || null,
        building_count: input.building_count ?? null,
        priority_tier: String(input.priority_tier || "standard"),
        strategic_value: Number(input.strategic_value || 50),
        near_active_incident: Boolean(input.near_active_incident),
        last_outbound_at: input.last_outbound_at || null,
        notes: input.notes || null,
        tags: Array.isArray(input.tags) ? input.tags : [],
        source: String(input.source || "manual"),
        created_at: createdAt,
        updated_at: createdAt
    };
    getStore().prospects.unshift(prospect);
    return prospect;
}
function listDemoReferralPartners({ territory, partnerType, search, nearIncident }) {
    const q = String(search || "").trim().toLowerCase();
    return [...getStore().referralPartners]
        .filter((item) => {
        if (territory && territory !== "all" && item.territory !== territory)
            return false;
        if (partnerType && partnerType !== "all" && item.partner_type !== partnerType)
            return false;
        if (nearIncident != null && item.near_active_incident !== nearIncident)
            return false;
        if (!q)
            return true;
        const haystack = `${item.company_name} ${item.contact_name || ""} ${item.city || ""} ${item.state || ""}`.toLowerCase();
        return haystack.includes(q);
    })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function createDemoReferralPartner(input) {
    const createdAt = nowIso();
    const partner = {
        id: generateId("partner", `${input.company_name}:${input.email}:${createdAt}`),
        company_name: String(input.company_name || "New Referral Partner").trim(),
        contact_name: input.contact_name || null,
        title: input.title || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        city: input.city || null,
        state: input.state || null,
        zip: input.zip || null,
        territory: input.territory || (0, outbound_1.buildTerritory)([input.city, input.state]),
        partner_type: String(input.partner_type || "insurance_agent"),
        priority_tier: String(input.priority_tier || "standard"),
        strategic_value: Number(input.strategic_value || 50),
        near_active_incident: Boolean(input.near_active_incident),
        last_outbound_at: input.last_outbound_at || null,
        notes: input.notes || null,
        tags: Array.isArray(input.tags) ? input.tags : [],
        source: String(input.source || "manual"),
        created_at: createdAt,
        updated_at: createdAt
    };
    getStore().referralPartners.unshift(partner);
    return partner;
}
function demoMembersForSegments(territory, segments) {
    const store = getStore();
    const normalized = segments.map((segment) => String(segment).toLowerCase());
    const prospects = store.prospects
        .filter((item) => normalized.includes(item.prospect_type.toLowerCase()))
        .filter((item) => !territory || item.territory === territory || (0, outbound_1.buildTerritory)([item.city, item.state]) === territory)
        .map((item) => ({ record_type: "prospect", record_id: item.id }));
    const partners = store.referralPartners
        .filter((item) => normalized.includes(item.partner_type.toLowerCase()))
        .filter((item) => !territory || item.territory === territory || (0, outbound_1.buildTerritory)([item.city, item.state]) === territory)
        .map((item) => ({ record_type: "referral_partner", record_id: item.id }));
    return [...prospects, ...partners];
}
function listDemoOutboundLists() {
    const store = getStore();
    return [...store.outboundLists]
        .map((list) => ({
        ...list,
        member_count: store.outboundListMembers.filter((member) => member.outbound_list_id === list.id).length
    }))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function createDemoOutboundList(input) {
    const store = getStore();
    const createdAt = nowIso();
    const listId = generateId("olist", `${input.name}:${createdAt}`);
    const list = {
        id: listId,
        name: input.name,
        list_type: input.listType,
        segment_definition_json: input.segmentDefinition || {},
        territory: input.territory || null,
        source_trigger: input.sourceTrigger || null,
        campaign_name: input.campaignName || null,
        smartlead_campaign_id: input.smartleadCampaignId || null,
        export_status: "draft",
        created_at: createdAt,
        updated_at: createdAt
    };
    store.outboundLists.unshift(list);
    for (const member of input.members || []) {
        store.outboundListMembers.push({
            id: generateId("member", `${listId}:${member.record_type}:${member.record_id}`),
            outbound_list_id: listId,
            record_type: member.record_type,
            record_id: member.record_id,
            created_at: createdAt
        });
    }
    return {
        ...list,
        member_count: (input.members || []).length
    };
}
function createDemoIncidentTriggeredList(opportunityId) {
    const store = getStore();
    const opportunity = store.opportunities.find((item) => item.id === opportunityId);
    if (!opportunity)
        return null;
    const territory = (0, outbound_1.deriveOpportunityTerritory)(opportunity);
    const segments = (0, outbound_1.getIncidentTriggeredSegments)(opportunity);
    const members = demoMembersForSegments(territory, segments);
    return createDemoOutboundList({
        name: (0, outbound_1.buildTriggeredListName)(opportunity),
        listType: "incident_triggered",
        territory,
        sourceTrigger: opportunity.title,
        segmentDefinition: {
            segments,
            territory,
            near_incident: true,
            opportunity_id: opportunity.id
        },
        members
    });
}
function syncDemoOutboundList(listId, campaignId) {
    const store = getStore();
    const list = store.outboundLists.find((item) => item.id === listId);
    if (!list)
        return null;
    list.smartlead_campaign_id = campaignId || list.smartlead_campaign_id;
    list.export_status = "synced";
    list.updated_at = nowIso();
    store.smartleadSyncLogs.unshift({
        id: generateId("sync", `${listId}:${list.updated_at}`),
        outbound_list_id: listId,
        smartlead_campaign_id: list.smartlead_campaign_id,
        action_type: "push_leads",
        status: "simulated",
        request_payload_json: { campaign_id: list.smartlead_campaign_id },
        response_payload_json: { accepted: true },
        created_at: list.updated_at
    });
    return list;
}
function getDemoOutboundListCsv(listId) {
    const store = getStore();
    const list = store.outboundLists.find((item) => item.id === listId);
    if (!list)
        return null;
    const members = store.outboundListMembers.filter((item) => item.outbound_list_id === listId);
    const rows = members
        .map((member) => {
        if (member.record_type === "prospect") {
            const record = store.prospects.find((item) => item.id === member.record_id);
            if (!record)
                return null;
            return {
                record_type: "prospect",
                company_name: record.company_name,
                contact_name: record.contact_name || "",
                email: record.email || "",
                phone: record.phone || "",
                segment: record.prospect_type,
                territory: record.territory || "",
                city: record.city || "",
                state: record.state || "",
                source: record.source
            };
        }
        const record = store.referralPartners.find((item) => item.id === member.record_id);
        if (!record)
            return null;
        return {
            record_type: "referral_partner",
            company_name: record.company_name,
            contact_name: record.contact_name || "",
            email: record.email || "",
            phone: record.phone || "",
            segment: record.partner_type,
            territory: record.territory || "",
            city: record.city || "",
            state: record.state || "",
            source: record.source
        };
    })
        .filter(Boolean);
    return (0, outbound_1.buildCsv)(["record_type", "company_name", "contact_name", "email", "phone", "segment", "territory", "city", "state", "source"], rows);
}
