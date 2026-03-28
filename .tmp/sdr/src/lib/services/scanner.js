"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weatherRisk = weatherRisk;
exports.resolveOpportunityAddress = resolveOpportunityAddress;
exports.runScanner = runScanner;
exports.fetchGooglePlacesLeads = fetchGooglePlacesLeads;
exports.generateSyntheticScannerLeads = generateSyntheticScannerLeads;
exports.opportunityToLeadPayload = opportunityToLeadPayload;
const intent_engine_1 = require("@/lib/services/intent-engine");
const enrichment_1 = require("@/lib/services/enrichment");
const tri_state_markets_1 = require("@/lib/services/tri-state-markets");
const weather_1 = require("@/lib/services/weather");
const DEMO_MARKET_LOOKUP = {
    "11717": { city: "Brentwood", state: "NY", postalCode: "11717" },
    "11705": { city: "Bayport", state: "NY", postalCode: "11705" },
    "11706": { city: "Bay Shore", state: "NY", postalCode: "11706" },
    "11722": { city: "Central Islip", state: "NY", postalCode: "11722" },
    "11772": { city: "Patchogue", state: "NY", postalCode: "11772" },
    "11788": { city: "Hauppauge", state: "NY", postalCode: "11788" },
    "10019": { city: "Midtown West", state: "NY", postalCode: "10019" },
    "33602": { city: "Tampa", state: "FL", postalCode: "33602" }
};
const VALID_CATEGORIES = ["restoration", "plumbing", "demolition", "asbestos", "general"];
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
}
function pseudo(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(value)));
}
function normalizeCategories(input) {
    if (!Array.isArray(input) || input.length === 0)
        return [...VALID_CATEGORIES];
    const set = new Set();
    for (const raw of input) {
        const c = String(raw || "").toLowerCase().trim();
        if (VALID_CATEGORIES.includes(c))
            set.add(c);
    }
    return set.size > 0 ? Array.from(set) : [...VALID_CATEGORIES];
}
function parseLatLon(location, lat, lon) {
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const trimmedLocation = String(location || "").trim();
        const locationLooksLikeCoords = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.test(trimmedLocation);
        return {
            lat: Number(lat),
            lon: Number(lon),
            label: trimmedLocation && !locationLooksLikeCoords ? trimmedLocation : `${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}`
        };
    }
    const match = String(location || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) {
        return { lat: Number(match[1]), lon: Number(match[2]), label: `${Number(match[1]).toFixed(3)}, ${Number(match[2]).toFixed(3)}` };
    }
    return null;
}
async function fetchJsonWithTimeout(url, timeoutMs = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            cache: "no-store",
            headers: { "user-agent": "ServiceButler-Scanner/1.0" },
            signal: controller.signal
        });
        if (!res.ok)
            return null;
        return (await res.json());
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
function weatherRisk(forecast) {
    if (!forecast)
        return { highRisk: false, label: "Weather stable" };
    const precip = forecast.current.precipitationChance ?? 0;
    const wind = forecast.current.windKph ?? 0;
    const wetHours = forecast.next6Hours.filter((h) => h.precipChance >= 45).length;
    const highRisk = precip >= 55 || wind >= 30 || wetHours >= 2;
    return {
        highRisk,
        label: highRisk ? "Storm/high-wind pressure expected" : "Weather stable"
    };
}
function weatherBoost(category, forecast) {
    if (!forecast)
        return 0;
    const precip = forecast.current.precipitationChance ?? 0;
    const wind = forecast.current.windKph ?? 0;
    if (category === "restoration")
        return precip * 0.35 + wind * 0.45;
    if (category === "plumbing")
        return precip * 0.25 + wind * 0.1;
    if (category === "demolition")
        return wind * 0.2 + precip * 0.08;
    if (category === "asbestos")
        return precip * 0.15;
    return precip * 0.12;
}
function scoreOpportunity(category, tags, forecast, confidenceBase = 55) {
    const baseByCategory = {
        plumbing: 62,
        demolition: 58,
        asbestos: 54,
        restoration: 66,
        general: 49
    };
    const tagWeight = tags.length * 4;
    const weatherWeight = weatherBoost(category, forecast);
    const intentScore = clamp(baseByCategory[category] + tagWeight + weatherWeight);
    const confidence = clamp(confidenceBase + tags.length * 3 + Math.min(weatherWeight * 0.3, 16));
    return { intentScore, confidence };
}
function priorityLabelForOpportunity({ intentScore, tags, title, description, reasonSummary, raw }) {
    const normalizedTags = tags.map((tag) => String(tag || "").toLowerCase());
    const text = `${title} ${description} ${reasonSummary}`.toLowerCase();
    // Deterministic thresholding strategy:
    // - Base score from model intent.
    // - Add urgency points when explicit emergency signals are present.
    // - Apply conservative penalties for lower urgency signals.
    // Final threshold mapping:
    //   >= 86 => Call now
    //   >= 68 => Follow up
    //   < 68 => Schedule later
    let weightedScore = intentScore;
    const immediateSignals = ["emergency", "urgent", "immediate", "burst pipe", "flood", "fire damage", "collapsed ceiling"];
    if (immediateSignals.some((signal) => normalizedTags.includes(signal) || text.includes(signal))) {
        weightedScore += 10;
    }
    const mediumSignals = ["storm", "insurance claim", "water damage", "inspection", "asbestos", "weather"];
    if (mediumSignals.some((signal) => normalizedTags.includes(signal) || text.includes(signal))) {
        weightedScore += 4;
    }
    if (normalizedTags.includes("quote") || text.includes("this week") || text.includes("scheduled")) {
        weightedScore -= 6;
    }
    if (String(raw?.urgency || "").toLowerCase() === "immediate") {
        weightedScore += 8;
    }
    if (weightedScore >= 86)
        return "Call now";
    if (weightedScore >= 68)
        return "Follow up";
    return "Schedule later";
}
function suggestedNextAction(category, intentScore, locationText) {
    if (intentScore >= 80) {
        return `Call within 10 minutes and offer same-day dispatch near ${locationText}.`;
    }
    if (category === "asbestos") {
        return `Qualify safety scope and schedule site inspection for ${locationText}.`;
    }
    return `Dispatch to lead inbox and follow up within 30 minutes for ${locationText}.`;
}
function distanceSummary(index, locationText) {
    const miles = 4 + (index % 5) * 6;
    return `${miles} mi from ${locationText}`;
}
function parseMarketLocation(location) {
    const normalized = String(location || "").trim();
    const zipMatch = normalized.match(/\b\d{5}\b/);
    if (zipMatch?.[0] && DEMO_MARKET_LOOKUP[zipMatch[0]]) {
        return DEMO_MARKET_LOOKUP[zipMatch[0]];
    }
    const stateMatch = normalized.match(/\b([A-Z]{2})\b/);
    const firstPart = normalized.split(",")[0]?.trim() || "Brentwood";
    const city = /^\d{5}$/.test(firstPart) ? "Brentwood" : firstPart;
    return {
        city,
        state: stateMatch?.[1] || "NY",
        postalCode: zipMatch?.[0] || "11717"
    };
}
function generateDemoAddress(seed, location) {
    const { city, state, postalCode } = parseMarketLocation(location);
    const number = 118 + (hash(seed) % 700);
    const streets = ["Cedar Ridge", "Maple Crest", "Oak Hollow", "Bayview", "Harbor Lane", "Riverview", "Spruce Hill", "Chestnut"];
    const suffixes = ["Drive", "Lane", "Avenue", "Court", "Road", "Place"];
    const street = streets[hash(`${seed}:street`) % streets.length];
    const suffix = suffixes[hash(`${seed}:suffix`) % suffixes.length];
    return `${number} ${street} ${suffix}, ${city}, ${state} ${postalCode}`;
}
function parseAddressParts(address) {
    const [street = "", city = "", region = ""] = address.split(",").map((part) => part.trim());
    const regionMatch = region.match(/^([A-Z]{2})\s+(\d{5})$/);
    return {
        street,
        city,
        state: regionMatch?.[1] || "NY",
        postalCode: regionMatch?.[2] || "11717"
    };
}
function isCoordinateLabel(value) {
    return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(value);
}
function looksLikeStreetAddress(value) {
    return /^\d+\s+.+,\s*.+,\s*[A-Z]{2}(?:\s+\d{5})?$/.test(value.trim());
}
function parseMarketLocationParts(value) {
    const normalized = String(value || "").trim();
    const zipOnly = normalized.match(/^\d{5}$/)?.[0];
    if (zipOnly && DEMO_MARKET_LOOKUP[zipOnly]) {
        return DEMO_MARKET_LOOKUP[zipOnly];
    }
    const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const zipMatch = normalized.match(/\b\d{5}\b/);
    if (zipMatch?.[0] && DEMO_MARKET_LOOKUP[zipMatch[0]] && parts.length <= 1) {
        return DEMO_MARKET_LOOKUP[zipMatch[0]];
    }
    const stateZipMatch = last.match(/^([A-Z]{2})(?:\s+(\d{5}))?$/);
    const state = stateZipMatch?.[1] || normalized.match(/\b([A-Z]{2})\b/)?.[1] || "NY";
    const postalCode = stateZipMatch?.[2] || zipMatch?.[0] || parseMarketLocation(normalized).postalCode;
    const city = parts.length >= 2
        ? parts[parts.length - 2] || parseMarketLocation(normalized).city
        : parseMarketLocation(normalized).city;
    return {
        city,
        state,
        postalCode
    };
}
function resolveOpportunityAddress({ locationText, lat, lon, serviceAreaLabel, seed }) {
    const raw = String(locationText || "").trim();
    if (raw && looksLikeStreetAddress(raw) && !isCoordinateLabel(raw)) {
        const exact = parseAddressParts(raw);
        return {
            address: exact.street,
            city: exact.city,
            state: exact.state,
            postalCode: exact.postalCode,
            display: raw,
            quality: "exact"
        };
    }
    const marketSource = raw && !isCoordinateLabel(raw) ? raw : String(serviceAreaLabel || "").trim();
    const marketParts = parseMarketLocationParts(marketSource || "Brentwood, NY 11717");
    const generated = generateDemoAddress(`${seed}:${Number(lat ?? 0).toFixed(3)}:${Number(lon ?? 0).toFixed(3)}`, `${marketParts.city}, ${marketParts.state} ${marketParts.postalCode}`);
    const approx = parseAddressParts(generated);
    return {
        address: approx.street,
        city: approx.city,
        state: approx.state,
        postalCode: approx.postalCode,
        display: generated,
        quality: "approximate"
    };
}
function incidentCatalog(campaignMode) {
    const shared = [
        {
            incidentType: "NOAA flood warning",
            title: "NOAA flood warning impacting low-lying homes",
            description: "NOAA alert plus runoff pressure indicates likely water extraction and mitigation demand.",
            category: "restoration",
            sourceName: "NOAA + Flood Zone Cluster",
            serviceCategory: "Water Mitigation",
            urgencyWindow: "Next 2 hours",
            demandExplanation: "Heavy rainfall overlapping mapped flood-prone parcels usually drives emergency drying and extraction calls.",
            demandSignal: "Rainfall + flood-zone overlap",
            weatherSignal: "Flood warning and heavy rain band",
            tags: ["flood warning", "water damage", "insurance claim", "restoration"]
        },
        {
            incidentType: "Wind damage alert",
            title: "High-wind damage corridor near service area",
            description: "Wind gusts and debris reports point to roof tarping, siding, and emergency board-up demand.",
            category: "restoration",
            sourceName: "NOAA severe weather alert",
            serviceCategory: "Storm Restoration",
            urgencyWindow: "Today",
            demandExplanation: "Wind-driven property damage often converts into immediate inspection and temporary repair work.",
            demandSignal: "High wind + debris chatter",
            weatherSignal: "Severe wind alert",
            tags: ["wind damage", "storm-response", "roof leak", "board-up"]
        },
        {
            incidentType: "Structure fire report",
            title: "Municipal structure fire report with board-up need",
            description: "Active fire-log incident suggests smoke cleanup, emergency board-up, and strip-out opportunities.",
            category: "demolition",
            sourceName: "Municipal fire log",
            serviceCategory: "Emergency Board-Up",
            urgencyWindow: "Immediate",
            demandExplanation: "Structure fire calls frequently require first-response securing, demolition, and mitigation crews.",
            demandSignal: "Fire incident + emergency response",
            tags: ["structure fire", "board-up", "demo needed", "urgent"]
        },
        {
            incidentType: "Unsafe structure notice",
            title: "Unsafe structure notice posted after damage inspection",
            description: "Code notice indicates a likely demolition, shoring, or structural stabilization opportunity.",
            category: "demolition",
            sourceName: "Building violations feed",
            serviceCategory: "Structural Stabilization",
            urgencyWindow: "This week",
            demandExplanation: "Unsafe-structure notices create inspection, stabilization, and demo bids with strong close rates.",
            demandSignal: "Violation notice + structural risk",
            tags: ["unsafe structure", "demolition order", "inspection", "stabilization"]
        },
        {
            incidentType: "Asbestos abatement permit",
            title: "Asbestos abatement permit filed before interior demo",
            description: "Permit activity signals regulated abatement work and adjacent demolition scope.",
            category: "asbestos",
            sourceName: "Permit filings",
            serviceCategory: "Asbestos Abatement",
            urgencyWindow: "This week",
            demandExplanation: "Abatement permits are strong commercial and residential intent signals before larger reconstruction work begins.",
            demandSignal: "Permit filing + hazardous material scope",
            tags: ["asbestos violation", "abatement permit", "regulated work", "inspection"]
        },
        {
            incidentType: "Structural repair permit",
            title: "Structural repair permit filed after damage event",
            description: "Repair permit suggests a property owner is actively moving from incident to contractor selection.",
            category: "restoration",
            sourceName: "Permit filings",
            serviceCategory: "Structural Repair",
            urgencyWindow: "This week",
            demandExplanation: "Repair permits often follow insured losses and create immediate inspection and scoping opportunities.",
            demandSignal: "Permit filing + insured loss follow-up",
            tags: ["repair permit", "insured loss", "inspection", "quote"]
        },
        {
            incidentType: "Demolition permit",
            title: "Demolition permit filed for damaged property",
            description: "Permit filing points to active teardown scope and debris-haul demand.",
            category: "demolition",
            sourceName: "Permit filings",
            serviceCategory: "Selective Demolition",
            urgencyWindow: "Today",
            demandExplanation: "Demo permits indicate funded work and near-term mobilization for teardown crews.",
            demandSignal: "Permit filing + mobilization window",
            tags: ["demolition permit", "debris haul", "demo needed", "urgent"]
        }
    ];
    if (campaignMode === "Roofing") {
        return [
            {
                incidentType: "Roof leak cluster",
                title: "Roof leak calls rising after overnight wind and rain",
                description: "Combined weather pressure and homeowner reports suggest emergency tarping and inspection demand.",
                category: "restoration",
                sourceName: "NOAA + neighborhood reports",
                serviceCategory: "Roof Leak Response",
                urgencyWindow: "Next 2 hours",
                demandExplanation: "Roof leak clusters convert quickly when contractors respond before interior water damage spreads.",
                demandSignal: "Wind-driven leaks + homeowner reports",
                weatherSignal: "High wind and heavy rain",
                tags: ["roof leak", "storm-response", "inspection", "urgent"]
            },
            ...shared
        ];
    }
    if (campaignMode === "HVAC Emergency") {
        return [
            {
                incidentType: "HVAC outage cluster",
                title: "After-hours HVAC failures following grid disruption",
                description: "Outage chatter and temperature swing indicate emergency no-cool and no-heat demand.",
                category: "general",
                sourceName: "Weather + outage chatter",
                serviceCategory: "HVAC Emergency",
                urgencyWindow: "Immediate",
                demandExplanation: "Comfort outages convert fastest when dispatch offers same-day diagnosis and restoration crews can coordinate follow-up.",
                demandSignal: "Outage reports + temperature stress",
                weatherSignal: "Freeze alert or heat spike",
                tags: ["hvac failure", "emergency", "same-day", "dispatch"]
            },
            ...shared
        ];
    }
    if (campaignMode === "Water Damage") {
        return [
            {
                incidentType: "Flood risk cluster",
                title: "Rainfall cluster overlapping mapped FEMA flood zone",
                description: "Runoff intensity and flood-zone overlap suggest crawlspace flooding and basement water loss calls.",
                category: "restoration",
                sourceName: "Rainfall + FEMA flood zone cluster",
                serviceCategory: "Water Mitigation",
                urgencyWindow: "Immediate",
                demandExplanation: "Flood-risk clustering produces realistic mitigation demand where rainfall accumulates over vulnerable parcels.",
                demandSignal: "Flood-zone overlap + rain accumulation",
                weatherSignal: "Heavy rainfall and flood risk",
                tags: ["fema flood zone", "water damage", "mitigation", "urgent"]
            },
            ...shared
        ];
    }
    return shared;
}
function suggestedSchedule(intentScore, slaMinutes = 90) {
    const now = Date.now();
    const target = new Date(now + Math.max(30, slaMinutes) * 60_000);
    if (intentScore >= 80) {
        target.setMinutes(0, 0, 0);
        target.setHours(target.getHours() + 1);
    }
    return target.toISOString();
}
function toCategory(service) {
    const value = String(service || "").toLowerCase();
    if (value.includes("restor") || value.includes("water") || value.includes("fire") || value.includes("mold"))
        return "restoration";
    if (value.includes("plumb"))
        return "plumbing";
    if (value.includes("demo") || value.includes("collapse"))
        return "demolition";
    if (value.includes("asbestos"))
        return "asbestos";
    return "general";
}
function displayService(category) {
    if (category === "plumbing")
        return "Plumbing";
    if (category === "demolition")
        return "Demolition";
    if (category === "asbestos")
        return "Asbestos";
    if (category === "restoration")
        return "Restoration";
    return "General";
}
function displayCampaignService(category, campaignMode) {
    if (campaignMode === "Roofing")
        return "Roofing";
    if (campaignMode === "HVAC Emergency")
        return "HVAC";
    if (campaignMode === "Water Damage" && category === "plumbing")
        return "Pipe Burst";
    if (campaignMode === "Storm Response")
        return category === "restoration" ? "Storm Restoration" : displayService(category);
    return displayService(category);
}
function mkId(parts) {
    return `scan-${hash(parts.join("|"))}`;
}
function toLeadFromOpportunity(op) {
    const addressInfo = resolveOpportunityAddress({
        locationText: String(op.raw?.property_address || op.locationText || ""),
        lat: op.lat,
        lon: op.lon,
        serviceAreaLabel: String(op.raw?.service_area_label || op.locationText || "Service Area"),
        seed: op.id
    });
    const nameSeed = hash(op.title + op.locationText);
    const first = ["Jordan", "Avery", "Mason", "Noah", "Mia", "Liam", "Aria", "Elijah"];
    const last = ["Parker", "Nguyen", "Diaz", "Brooks", "Carter", "Stone", "Bennett", "Reed"];
    const name = `${first[nameSeed % first.length]} ${last[(nameSeed >> 2) % last.length]}`;
    const phone = `+1${String(6310000000 + (nameSeed % 8999999)).slice(0, 10)}`;
    const urgency = op.intentScore >= 80 ? "high" : op.intentScore >= 65 ? "medium" : "low";
    const signalLead = {
        id: op.id,
        service_type: displayService(op.category),
        requested_timeframe: urgency === "high" ? "ASAP" : urgency === "medium" ? "Today" : "This week",
        city: addressInfo.city,
        state: addressInfo.state
    };
    return {
        id: op.id,
        name,
        phone,
        city: addressInfo.city,
        state: addressInfo.state,
        postal: addressInfo.postalCode,
        service_type: displayService(op.category),
        urgency,
        intentScore: op.intentScore,
        priorityLabel: op.priorityLabel,
        reason: op.reasonSummary,
        signals: (0, intent_engine_1.generateSignals)({ lead: signalLead }),
        sourceMode: op.source === "google_places" ? "google_places" : "synthetic"
    };
}
function createDemoOpportunities({ location, categories, forecast, limit, campaignMode, triggers }) {
    const seed = hash(`${location}|${categories.join(",")}|${campaignMode || "none"}|${(triggers || []).join(",")}`);
    const rand = pseudo(seed);
    const templates = incidentCatalog(campaignMode).filter((template) => categories.includes(template.category));
    const catalog = templates.length > 0 ? templates : incidentCatalog(campaignMode);
    const count = Math.max(8, Math.min(20, limit));
    const out = [];
    for (let i = 0; i < count; i += 1) {
        const template = catalog[Math.floor(rand() * catalog.length)] || catalog[0];
        const category = template.category;
        const tags = [...template.tags, campaignMode === "Storm Response" ? "storm-response" : "dispatch"].filter((v, idx, arr) => arr.indexOf(v) === idx);
        const { intentScore, confidence } = scoreOpportunity(category, tags, forecast, 58 + Math.floor(rand() * 14));
        const marketLabel = location.includes(",") ? location : `${location}, NY`;
        const addressInfo = resolveOpportunityAddress({
            locationText: generateDemoAddress(`${template.incidentType}:${i}`, marketLabel),
            serviceAreaLabel: marketLabel,
            seed: `${template.incidentType}:${i}`
        });
        const locationText = addressInfo.display;
        const id = mkId(["demo", category, template.incidentType, template.title, locationText, String(i)]);
        const weatherSignal = template.weatherSignal || (forecast?.current.precipitationChance ? `${forecast.current.precipitationChance}% rain chance` : "stable weather window");
        const timeWindow = intentScore >= 85 ? "Immediate" : intentScore >= 74 ? "Next 2 hours" : intentScore >= 64 ? "Today" : template.urgencyWindow;
        const distance = distanceSummary(i, locationText);
        const distanceMiles = 4 + (i % 5) * 6;
        const serviceType = template.serviceCategory || displayCampaignService(category, campaignMode);
        const demandSignal = template.demandSignal;
        const addressParts = parseAddressParts(locationText);
        const enrichment = (0, enrichment_1.getEnrichmentProvider)("demo")?.enrichOpportunity({
            seed: `${template.incidentType}:${i}`,
            address: locationText,
            city: addressParts.city,
            state: addressParts.state,
            postalCode: addressParts.postalCode,
            serviceType
        });
        const reasonSummary = `Why this opportunity: ${template.incidentType}, ${weatherSignal}, ${timeWindow} demand window, ${distance}, ${serviceType} service match. ${template.demandExplanation}`;
        out.push({
            id,
            source: "demo",
            category,
            title: `${template.title} near ${locationText}`,
            description: template.description,
            locationText,
            lat: null,
            lon: null,
            intentScore,
            priorityLabel: priorityLabelForOpportunity({
                intentScore,
                tags,
                title: `${template.title} near ${locationText}`,
                description: template.description,
                reasonSummary,
                raw: {
                    mode: "demo",
                    category,
                    triggers: triggers || [],
                    incident_type: template.incidentType,
                    signal_source: template.sourceName,
                    weather_signal: weatherSignal,
                    forecast_window: timeWindow,
                    distance_miles: distanceMiles,
                    service_type: serviceType,
                    property_address: addressInfo.address,
                    property_city: addressInfo.city,
                    property_state: addressInfo.state,
                    property_postal_code: addressInfo.postalCode,
                    address_quality: addressInfo.quality,
                    service_area_label: marketLabel,
                    urgency_window: timeWindow,
                    demand_signal: demandSignal,
                    demand_explanation: template.demandExplanation,
                    enrichment
                }
            }),
            confidence,
            tags,
            nextAction: suggestedNextAction(category, intentScore, locationText),
            reasonSummary,
            recommendedCreateMode: intentScore >= 76 ? "job" : "lead",
            recommendedScheduleIso: intentScore >= 70 ? suggestedSchedule(intentScore, 75) : null,
            raw: {
                mode: "demo",
                category,
                triggers: triggers || [],
                incident_type: template.incidentType,
                signal_source: template.sourceName,
                weather_signal: weatherSignal,
                forecast_window: timeWindow,
                distance_miles: distanceMiles,
                service_type: serviceType,
                property_address: addressInfo.address,
                property_city: addressInfo.city,
                property_state: addressInfo.state,
                property_postal_code: addressInfo.postalCode,
                address_quality: addressInfo.quality,
                service_area_label: marketLabel,
                urgency_window: timeWindow,
                demand_signal: demandSignal,
                demand_explanation: template.demandExplanation,
                enrichment
            },
            createdAtIso: new Date().toISOString()
        });
    }
    return out.sort((a, b) => b.intentScore - a.intentScore).slice(0, limit);
}
function categoryFromAlert(eventText) {
    const t = eventText.toLowerCase();
    if (t.includes("flood") || t.includes("storm") || t.includes("tornado") || t.includes("hail"))
        return "restoration";
    if (t.includes("wind") || t.includes("collapse") || t.includes("debris"))
        return "demolition";
    if (t.includes("freeze") || t.includes("pipe"))
        return "plumbing";
    if (t.includes("smoke") || t.includes("air quality"))
        return "asbestos";
    return "general";
}
async function fetchNwsOpportunities({ lat, lon, serviceAreaLabel, categories, forecast, limit }) {
    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const payload = await fetchJsonWithTimeout(url, 9500);
    if (!payload?.features?.length)
        return [];
    const out = [];
    for (const feature of payload.features.slice(0, limit * 2)) {
        const props = feature.properties || {};
        const category = categoryFromAlert(`${props.event || ""} ${props.headline || ""}`);
        if (!categories.includes(category))
            continue;
        const severityWeight = String(props.severity || "").toLowerCase() === "severe" ? 14 : 8;
        const urgencyWeight = String(props.urgency || "").toLowerCase() === "immediate" ? 12 : 6;
        const tags = ["weather", props.event || "alert", props.severity || "moderate"].map((v) => String(v).toLowerCase());
        const scored = scoreOpportunity(category, tags, forecast, 62 + severityWeight / 2);
        const intent = clamp(scored.intentScore + severityWeight + urgencyWeight * 0.5);
        const markets = (0, tri_state_markets_1.getTriStateMarketsForSignal)({
            areaDesc: props.areaDesc,
            serviceAreaLabel,
            serviceLat: lat,
            serviceLon: lon,
            limit: 3
        });
        for (const market of markets) {
            const locationText = `${market.address}, ${market.city}, ${market.state} ${market.postalCode}`;
            const distanceMiles = Math.max(1, Math.round((0, tri_state_markets_1.distanceToMarketMiles)(lat, lon, market)));
            const reasonSummary = `${props.event || "NOAA alert"} is active for ${market.county}, putting ${market.neighborhood} into a ${props.urgency || "today"} response window.`;
            out.push({
                id: mkId(["nws", feature.id || props.headline || "alert", market.id]),
                source: "weather",
                category,
                title: `${props.event || "Weather alert"} near ${market.city}`,
                description: props.description || `Active weather alert affecting ${market.county}.`,
                locationText,
                lat: market.lat,
                lon: market.lon,
                intentScore: intent,
                priorityLabel: priorityLabelForOpportunity({
                    intentScore: intent,
                    tags,
                    title: props.headline || props.event || "Weather alert",
                    description: props.description || `Active weather alert affecting ${market.county}.`,
                    reasonSummary,
                    raw: {
                        provider: "NWS",
                        id: feature.id,
                        incident_type: props.event || "NOAA alert",
                        signal_source: "NOAA alerts",
                        event: props.event,
                        severity: props.severity,
                        urgency: props.urgency,
                        sent: props.sent,
                        property_address: market.address,
                        property_city: market.city,
                        property_state: market.state,
                        property_postal_code: market.postalCode,
                        county: market.county,
                        neighborhood: market.neighborhood,
                        address_quality: "approximate",
                        service_area_label: serviceAreaLabel,
                        service_type: displayCampaignService(category),
                        urgency_window: String(props.urgency || "today"),
                        distance_miles: distanceMiles,
                        weather_signal: props.event || "Weather alert",
                        demand_signal: "Active NOAA alert",
                        demand_explanation: `NOAA alert coverage intersects ${market.county} and suggests elevated demand in ${market.neighborhood}.`
                    }
                }),
                confidence: scored.confidence,
                tags,
                nextAction: suggestedNextAction(category, intent, `${market.city}, ${market.state}`),
                reasonSummary,
                recommendedCreateMode: intent >= 78 ? "job" : "lead",
                recommendedScheduleIso: intent >= 72 ? suggestedSchedule(intent, 45) : null,
                raw: {
                    provider: "NWS",
                    id: feature.id,
                    incident_type: props.event || "NOAA alert",
                    signal_source: "NOAA alerts",
                    event: props.event,
                    severity: props.severity,
                    urgency: props.urgency,
                    sent: props.sent,
                    property_address: market.address,
                    property_city: market.city,
                    property_state: market.state,
                    property_postal_code: market.postalCode,
                    county: market.county,
                    neighborhood: market.neighborhood,
                    address_quality: "approximate",
                    service_area_label: serviceAreaLabel,
                    service_type: displayCampaignService(category),
                    urgency_window: String(props.urgency || "today"),
                    distance_miles: distanceMiles,
                    weather_signal: props.event || "Weather alert",
                    demand_signal: "Active NOAA alert",
                    demand_explanation: `NOAA alert coverage intersects ${market.county} and suggests elevated demand in ${market.neighborhood}.`
                },
                createdAtIso: new Date().toISOString()
            });
        }
    }
    return out
        .sort((a, b) => b.intentScore - a.intentScore)
        .slice(0, limit);
}
function haversineMiles(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 3958.8;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
async function fetchUsgsOpportunities({ lat, lon, serviceAreaLabel, radiusMiles, categories, forecast, limit }) {
    if (!categories.includes("restoration") && !categories.includes("general"))
        return [];
    const payload = await fetchJsonWithTimeout("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson", 9000);
    if (!payload?.features?.length)
        return [];
    const limitMiles = Math.max(80, radiusMiles * 8);
    const out = [];
    for (const feature of payload.features) {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2)
            continue;
        const eLon = Number(coords[0]);
        const eLat = Number(coords[1]);
        const dist = haversineMiles(lat, lon, eLat, eLon);
        if (dist > limitMiles)
            continue;
        const mag = Number(props.mag || 0);
        const tags = ["public_feed", "quake", mag >= 3 ? "infrastructure-risk" : "minor"];
        const scored = scoreOpportunity("restoration", tags, forecast, 52 + mag * 7);
        const intent = clamp(scored.intentScore + mag * 6 + (props.alert ? 10 : 0));
        const addressInfo = resolveOpportunityAddress({
            locationText: props.place || "",
            lat: eLat,
            lon: eLon,
            serviceAreaLabel,
            seed: feature.id || String(props.time || `${eLat},${eLon}`)
        });
        out.push({
            id: mkId(["usgs", feature.id || String(props.time)]),
            source: "public_feed",
            category: "restoration",
            title: props.title || "Local seismic activity",
            description: `USGS event near service area (${Math.round(dist)} mi). Monitor for inspection and emergency requests.`,
            locationText: addressInfo.display,
            lat: eLat,
            lon: eLon,
            intentScore: intent,
            priorityLabel: priorityLabelForOpportunity({
                intentScore: intent,
                tags,
                title: props.title || "Local seismic activity",
                description: `USGS event near service area (${Math.round(dist)} mi). Monitor for inspection and emergency requests.`,
                reasonSummary: "Public seismic feed indicates possible property impact and urgent inspection demand.",
                raw: {
                    provider: "USGS",
                    id: feature.id,
                    incident_type: "structure impact event",
                    signal_source: "Municipal incident mirror",
                    magnitude: props.mag,
                    tsunami: props.tsunami,
                    alert: props.alert,
                    time: props.time,
                    property_address: addressInfo.address,
                    property_city: addressInfo.city,
                    property_state: addressInfo.state,
                    property_postal_code: addressInfo.postalCode,
                    address_quality: addressInfo.quality,
                    service_area_label: serviceAreaLabel,
                    service_type: "Structural Inspection",
                    urgency_window: dist <= 20 ? "Immediate" : "Today",
                    distance_miles: Math.round(dist),
                    demand_signal: "Impact event near properties",
                    demand_explanation: "Incident proximity suggests inspection and stabilization demand for affected structures."
                }
            }),
            confidence: scored.confidence,
            tags,
            nextAction: suggestedNextAction("restoration", intent, props.place || "local area"),
            reasonSummary: "Public seismic feed indicates possible property impact and urgent inspection demand.",
            recommendedCreateMode: intent >= 75 ? "job" : "lead",
            recommendedScheduleIso: intent >= 68 ? suggestedSchedule(intent, 60) : null,
            raw: {
                provider: "USGS",
                id: feature.id,
                incident_type: "structure impact event",
                signal_source: "Municipal incident mirror",
                magnitude: props.mag,
                tsunami: props.tsunami,
                alert: props.alert,
                time: props.time,
                property_address: addressInfo.address,
                property_city: addressInfo.city,
                property_state: addressInfo.state,
                property_postal_code: addressInfo.postalCode,
                address_quality: addressInfo.quality,
                service_area_label: serviceAreaLabel,
                service_type: "Structural Inspection",
                urgency_window: dist <= 20 ? "Immediate" : "Today",
                distance_miles: Math.round(dist),
                demand_signal: "Impact event near properties",
                demand_explanation: "Incident proximity suggests inspection and stabilization demand for affected structures."
            },
            createdAtIso: new Date().toISOString()
        });
        if (out.length >= limit)
            break;
    }
    return out;
}
function categoryFromEonet(categoryTitle) {
    const value = categoryTitle.toLowerCase();
    if (value.includes("wildfire") || value.includes("storm") || value.includes("flood"))
        return "restoration";
    if (value.includes("landslide") || value.includes("severe storm"))
        return "demolition";
    if (value.includes("volcano") || value.includes("dust") || value.includes("smoke"))
        return "asbestos";
    return "general";
}
async function fetchEonetOpportunities({ lat, lon, serviceAreaLabel, radiusMiles, categories, forecast, limit }) {
    const payload = await fetchJsonWithTimeout("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50", 9000);
    if (!payload?.events?.length)
        return [];
    const radiusLimit = Math.max(120, radiusMiles * 10);
    const out = [];
    for (const event of payload.events) {
        const geo = event.geometry?.[event.geometry.length - 1];
        const coords = geo?.coordinates;
        if (!coords || coords.length < 2)
            continue;
        const eLon = Number(coords[0]);
        const eLat = Number(coords[1]);
        if (!Number.isFinite(eLat) || !Number.isFinite(eLon))
            continue;
        const dist = haversineMiles(lat, lon, eLat, eLon);
        if (dist > radiusLimit)
            continue;
        const dominantCategory = categoryFromEonet(event.categories?.[0]?.title || "");
        if (!categories.includes(dominantCategory))
            continue;
        const tags = [
            "public_feed",
            "nasa-eonet",
            String(event.categories?.[0]?.title || "environmental-event").toLowerCase()
        ];
        const scored = scoreOpportunity(dominantCategory, tags, forecast, 60);
        const recencyBoost = geo?.date && Date.now() - new Date(geo.date).getTime() <= 24 * 60 * 60 * 1000 ? 8 : 3;
        const proximityBoost = dist <= 30 ? 10 : dist <= 75 ? 6 : 3;
        const intent = clamp(scored.intentScore + recencyBoost + proximityBoost);
        const addressInfo = resolveOpportunityAddress({
            locationText: event.title || "",
            lat: eLat,
            lon: eLon,
            serviceAreaLabel,
            seed: event.id || event.title || String(geo?.date || `${eLat},${eLon}`)
        });
        out.push({
            id: mkId(["eonet", event.id || event.title || String(geo?.date || Date.now())]),
            source: "public_feed",
            category: dominantCategory,
            title: event.title || "Environmental incident",
            description: event.description || `NASA EONET reported an active environmental event about ${Math.round(dist)} mi from your service area.`,
            locationText: addressInfo.display,
            lat: eLat,
            lon: eLon,
            intentScore: intent,
            priorityLabel: priorityLabelForOpportunity({
                intentScore: intent,
                tags,
                title: event.title || "Environmental incident",
                description: event.description || "NASA EONET environmental event.",
                reasonSummary: "NASA EONET shows an active incident near your market that can increase emergency inbound demand.",
                raw: {
                    provider: "NASA_EONET",
                    id: event.id,
                    incident_type: String(event.categories?.[0]?.title || "environmental incident"),
                    signal_source: "Environmental incident feed",
                    categories: event.categories,
                    geometry_date: geo?.date,
                    distance_miles: Math.round(dist),
                    source_url: event.sources?.[0]?.url,
                    property_address: addressInfo.address,
                    property_city: addressInfo.city,
                    property_state: addressInfo.state,
                    property_postal_code: addressInfo.postalCode,
                    address_quality: addressInfo.quality,
                    service_area_label: serviceAreaLabel,
                    service_type: displayCampaignService(dominantCategory),
                    urgency_window: recencyBoost >= 8 ? "Today" : "This week",
                    demand_signal: "Active incident near service area",
                    demand_explanation: "Recent environmental incidents often trigger urgent cleanup, inspection, or demolition demand."
                }
            }),
            confidence: scored.confidence,
            tags,
            nextAction: suggestedNextAction(dominantCategory, intent, `${Math.round(dist)} mi radius`),
            reasonSummary: "NASA EONET shows an active incident near your market that can increase emergency inbound demand.",
            recommendedCreateMode: intent >= 77 ? "job" : "lead",
            recommendedScheduleIso: intent >= 70 ? suggestedSchedule(intent, 60) : null,
            raw: {
                provider: "NASA_EONET",
                id: event.id,
                incident_type: String(event.categories?.[0]?.title || "environmental incident"),
                signal_source: "Environmental incident feed",
                categories: event.categories,
                geometry_date: geo?.date,
                distance_miles: Math.round(dist),
                source_url: event.sources?.[0]?.url,
                property_address: addressInfo.address,
                property_city: addressInfo.city,
                property_state: addressInfo.state,
                property_postal_code: addressInfo.postalCode,
                address_quality: addressInfo.quality,
                service_area_label: serviceAreaLabel,
                service_type: displayCampaignService(dominantCategory),
                urgency_window: recencyBoost >= 8 ? "Today" : "This week",
                demand_signal: "Active incident near service area",
                demand_explanation: "Recent environmental incidents often trigger urgent cleanup, inspection, or demolition demand."
            },
            createdAtIso: new Date().toISOString()
        });
        if (out.length >= limit)
            break;
    }
    return out;
}
function normalizeNycBorough(value) {
    const borough = String(value || "").trim().toUpperCase();
    if (borough.includes("BRONX"))
        return { city: "Bronx", county: "Bronx County", state: "NY" };
    if (borough.includes("BROOKLYN"))
        return { city: "Brooklyn", county: "Kings County", state: "NY" };
    if (borough.includes("MANHATTAN"))
        return { city: "Manhattan", county: "New York County", state: "NY" };
    if (borough.includes("QUEENS"))
        return { city: "Queens", county: "Queens County", state: "NY" };
    if (borough.includes("RICHMOND") || borough.includes("STATEN"))
        return { city: "Staten Island", county: "Richmond County", state: "NY" };
    return { city: "New York City", county: "New York City", state: "NY" };
}
async function fetchNycFireOpportunities({ lat, lon, serviceAreaLabel, categories, forecast, limit }) {
    if (!categories.includes("restoration") && !categories.includes("demolition"))
        return [];
    const sinceIso = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const url = new URL("https://data.cityofnewyork.us/resource/8m42-w767.json");
    url.searchParams.set("$select", [
        "starfire_incident_id",
        "incident_datetime",
        "alarm_box_location",
        "incident_borough",
        "zipcode",
        "incident_classification",
        "incident_classification_group",
        "highest_alarm_level",
        "dispatch_response_seconds_qy"
    ].join(","));
    url.searchParams.set("$where", `incident_datetime >= '${sinceIso}' AND incident_classification_group = 'Structural Fires'`);
    url.searchParams.set("$order", "incident_datetime DESC");
    url.searchParams.set("$limit", String(Math.max(limit * 4, 20)));
    const rows = await fetchJsonWithTimeout(url.toString(), 9500);
    if (!rows?.length)
        return [];
    const out = [];
    for (const row of rows) {
        const location = String(row.alarm_box_location || "").trim();
        const zip = String(row.zipcode || "").trim();
        const borough = normalizeNycBorough(row.incident_borough);
        const displayAddress = [location || "Fire response location", borough.city, borough.state, zip].filter(Boolean).join(", ").replace(/, NY, (\d{5})$/, ", NY $1");
        const category = String(row.incident_classification || "").toLowerCase().includes("demolition") ? "demolition" : "restoration";
        if (!categories.includes(category))
            continue;
        const markets = (0, tri_state_markets_1.getTriStateMarketsForSignal)({
            areaDesc: `${row.incident_borough || ""} ${row.zipcode || ""} ${row.alarm_box_location || ""}`,
            serviceAreaLabel,
            serviceLat: lat,
            serviceLon: lon,
            limit: 1
        });
        const market = markets[0];
        const distanceMiles = market ? Math.max(1, Math.round((0, tri_state_markets_1.distanceToMarketMiles)(lat, lon, market))) : Math.max(3, Math.round(haversineMiles(lat, lon, lat, lon)));
        const responseSeconds = Number(row.dispatch_response_seconds_qy || 0);
        const tags = ["fdny", "structural-fire", responseSeconds > 300 ? "extended-response" : "active-response"];
        const scored = scoreOpportunity(category, tags, forecast, 70);
        const intent = clamp(scored.intentScore + 12 + (responseSeconds > 300 ? 6 : 0));
        const classification = String(row.incident_classification || "Structural fire").trim();
        const reasonSummary = `${classification} was dispatched in ${borough.city}. Fire-damage, board-up, and strip-out demand usually follows immediately after these incidents.`;
        out.push({
            id: mkId(["fdny", row.starfire_incident_id || row.incident_datetime || displayAddress]),
            source: "public_feed",
            category,
            title: `${classification} near ${borough.city}`,
            description: `FDNY dispatch data shows a recent structural fire incident at ${displayAddress}.`,
            locationText: displayAddress,
            lat: market?.lat ?? null,
            lon: market?.lon ?? null,
            intentScore: intent,
            priorityLabel: priorityLabelForOpportunity({
                intentScore: intent,
                tags,
                title: `${classification} near ${borough.city}`,
                description: `FDNY dispatch data shows a recent structural fire incident at ${displayAddress}.`,
                reasonSummary,
                raw: {
                    provider: "FDNY_OPEN_DATA",
                    incident_type: classification,
                    signal_source: "FDNY fire dispatch",
                    property_address: location || "Fire response location",
                    property_city: borough.city,
                    property_state: borough.state,
                    property_postal_code: zip,
                    county: borough.county,
                    neighborhood: market?.neighborhood || borough.city,
                    address_quality: "approximate",
                    service_area_label: serviceAreaLabel,
                    service_type: category === "demolition" ? "Emergency Board-Up" : "Fire Damage Restoration",
                    urgency_window: "Immediate",
                    distance_miles: distanceMiles,
                    dispatch_response_seconds: responseSeconds || null,
                    highest_alarm_level: row.highest_alarm_level || null,
                    demand_signal: "Recent structural fire dispatch",
                    demand_explanation: "Structural fire incidents create immediate board-up, mitigation, and reconstruction demand once the scene clears."
                }
            }),
            confidence: clamp(scored.confidence + 8),
            tags,
            nextAction: suggestedNextAction(category, intent, displayAddress),
            reasonSummary,
            recommendedCreateMode: "job",
            recommendedScheduleIso: suggestedSchedule(intent, 30),
            raw: {
                provider: "FDNY_OPEN_DATA",
                incident_type: classification,
                signal_source: "FDNY fire dispatch",
                property_address: location || "Fire response location",
                property_city: borough.city,
                property_state: borough.state,
                property_postal_code: zip,
                county: borough.county,
                neighborhood: market?.neighborhood || borough.city,
                address_quality: "approximate",
                service_area_label: serviceAreaLabel,
                service_type: category === "demolition" ? "Emergency Board-Up" : "Fire Damage Restoration",
                urgency_window: "Immediate",
                distance_miles: distanceMiles,
                dispatch_response_seconds: responseSeconds || null,
                highest_alarm_level: row.highest_alarm_level || null,
                demand_signal: "Recent structural fire dispatch",
                demand_explanation: "Structural fire incidents create immediate board-up, mitigation, and reconstruction demand once the scene clears."
            },
            createdAtIso: row.incident_datetime || new Date().toISOString()
        });
        if (out.length >= limit)
            break;
    }
    return out;
}
async function fetchForecastDrivenOpportunities({ lat, lon, serviceAreaLabel, categories, forecast, limit }) {
    if (!forecast)
        return [];
    const signals = [
        {
            key: "heavy-rain",
            event: "Heavy rainfall pressure",
            category: "restoration",
            serviceType: "Water Mitigation",
            urgency: "Next 6 hours",
            threshold: (forecast.current.precipitationChance ?? 0) >= 65,
            demandSignal: "Rainfall intensity"
        },
        {
            key: "freeze",
            event: "Freeze warning conditions",
            category: "plumbing",
            serviceType: "Pipe Burst Response",
            urgency: "Overnight",
            threshold: forecast.next6Hours.some((hour) => hour.temp <= 32),
            demandSignal: "Freeze risk"
        },
        {
            key: "high-wind",
            event: "High wind damage risk",
            category: "restoration",
            serviceType: "Storm Restoration",
            urgency: "Today",
            threshold: (forecast.current.windKph ?? 0) >= 35,
            demandSignal: "Wind damage risk"
        }
    ].filter((signal) => signal.threshold && categories.includes(signal.category));
    if (signals.length === 0)
        return [];
    const markets = (0, tri_state_markets_1.getTriStateMarketsForSignal)({
        areaDesc: serviceAreaLabel,
        serviceAreaLabel,
        serviceLat: lat,
        serviceLon: lon,
        limit: Math.min(3, limit)
    });
    const out = [];
    for (const signal of signals) {
        for (const market of markets) {
            const distanceMiles = Math.max(1, Math.round((0, tri_state_markets_1.distanceToMarketMiles)(lat, lon, market)));
            const scored = scoreOpportunity(signal.category, [signal.key, "forecast", "weather"], forecast, 64);
            const intent = clamp(scored.intentScore + 8);
            const locationText = `${market.address}, ${market.city}, ${market.state} ${market.postalCode}`;
            const reasonSummary = `${signal.event} is building across ${market.county}, creating likely ${signal.serviceType.toLowerCase()} demand in ${market.neighborhood}.`;
            out.push({
                id: mkId(["forecast", signal.key, market.id]),
                source: "weather",
                category: signal.category,
                title: `${signal.event} near ${market.city}`,
                description: `Live forecast indicates ${signal.demandSignal.toLowerCase()} across ${market.county}.`,
                locationText,
                lat: market.lat,
                lon: market.lon,
                intentScore: intent,
                priorityLabel: priorityLabelForOpportunity({
                    intentScore: intent,
                    tags: [signal.key, "forecast", "weather"],
                    title: `${signal.event} near ${market.city}`,
                    description: `Live forecast indicates ${signal.demandSignal.toLowerCase()} across ${market.county}.`,
                    reasonSummary,
                    raw: {
                        provider: "OPEN_METEO",
                        incident_type: signal.event,
                        signal_source: "Forecast model",
                        property_address: market.address,
                        property_city: market.city,
                        property_state: market.state,
                        property_postal_code: market.postalCode,
                        county: market.county,
                        neighborhood: market.neighborhood,
                        address_quality: "approximate",
                        service_area_label: serviceAreaLabel,
                        service_type: signal.serviceType,
                        urgency_window: signal.urgency,
                        distance_miles: distanceMiles,
                        weather_signal: signal.event,
                        demand_signal: signal.demandSignal,
                        demand_explanation: `Forecast conditions exceed threshold for ${signal.serviceType.toLowerCase()} opportunities in ${market.county}.`
                    }
                }),
                confidence: scored.confidence,
                tags: [signal.key, "forecast", "weather"],
                nextAction: suggestedNextAction(signal.category, intent, `${market.city}, ${market.state}`),
                reasonSummary,
                recommendedCreateMode: intent >= 78 ? "job" : "lead",
                recommendedScheduleIso: intent >= 70 ? suggestedSchedule(intent, 60) : null,
                raw: {
                    provider: "OPEN_METEO",
                    incident_type: signal.event,
                    signal_source: "Forecast model",
                    property_address: market.address,
                    property_city: market.city,
                    property_state: market.state,
                    property_postal_code: market.postalCode,
                    county: market.county,
                    neighborhood: market.neighborhood,
                    address_quality: "approximate",
                    service_area_label: serviceAreaLabel,
                    service_type: signal.serviceType,
                    urgency_window: signal.urgency,
                    distance_miles: distanceMiles,
                    weather_signal: signal.event,
                    demand_signal: signal.demandSignal,
                    demand_explanation: `Forecast conditions exceed threshold for ${signal.serviceType.toLowerCase()} opportunities in ${market.county}.`
                },
                createdAtIso: new Date().toISOString()
            });
        }
    }
    return out.sort((a, b) => b.intentScore - a.intentScore).slice(0, limit);
}
async function fetchFloodClusterOpportunities({ lat, lon, serviceAreaLabel, categories, forecast, limit }) {
    if (!forecast || !categories.includes("restoration"))
        return [];
    const precipNow = forecast.current.precipitationChance ?? 0;
    const wetHours = forecast.next6Hours.filter((hour) => hour.precipChance >= 55).length;
    const thresholdActive = precipNow >= 60 || wetHours >= 2;
    if (!thresholdActive)
        return [];
    const markets = (0, tri_state_markets_1.floodProneTriStateMarkets)(lat, lon, Math.min(3, limit));
    const out = [];
    for (const market of markets) {
        const distanceMiles = Math.max(1, Math.round((0, tri_state_markets_1.distanceToMarketMiles)(lat, lon, market)));
        const tags = ["flood-cluster", "forecast", "restoration", "water-damage"];
        const scored = scoreOpportunity("restoration", tags, forecast, 68);
        const intent = clamp(scored.intentScore + 10 + wetHours * 2);
        const locationText = `${market.address}, ${market.city}, ${market.state} ${market.postalCode}`;
        const rainWindow = wetHours >= 3 ? "Next 6 hours" : "Today";
        const reasonSummary = `Heavy rain pressure is clustering around ${market.neighborhood} in ${market.county}, where ${market.floodProfile.toLowerCase()} can drive water loss and mitigation calls.`;
        out.push({
            id: mkId(["flood-cluster", market.id, String(precipNow), String(wetHours)]),
            source: "weather",
            category: "restoration",
            title: `Flood-risk cluster near ${market.city}`,
            description: `Live rainfall pressure is building in ${market.neighborhood}, a ${market.floodProfile.toLowerCase()} area.`,
            locationText,
            lat: market.lat,
            lon: market.lon,
            intentScore: intent,
            priorityLabel: priorityLabelForOpportunity({
                intentScore: intent,
                tags,
                title: `Flood-risk cluster near ${market.city}`,
                description: `Live rainfall pressure is building in ${market.neighborhood}.`,
                reasonSummary,
                raw: {
                    provider: "OPEN_METEO_CLUSTER",
                    incident_type: "Flood-risk cluster",
                    signal_source: "Forecast + flood-prone market cluster",
                    property_address: market.address,
                    property_city: market.city,
                    property_state: market.state,
                    property_postal_code: market.postalCode,
                    county: market.county,
                    neighborhood: market.neighborhood,
                    flood_profile: market.floodProfile,
                    address_quality: "approximate",
                    service_area_label: serviceAreaLabel,
                    service_type: "Water Mitigation",
                    urgency_window: rainWindow,
                    distance_miles: distanceMiles,
                    weather_signal: "Heavy rainfall pressure",
                    demand_signal: "Flood-risk cluster",
                    demand_explanation: `${market.floodProfile} plus ${precipNow}% rain probability is creating realistic water intrusion demand.`
                }
            }),
            confidence: clamp(scored.confidence + 6),
            tags,
            nextAction: suggestedNextAction("restoration", intent, `${market.city}, ${market.state}`),
            reasonSummary,
            recommendedCreateMode: intent >= 78 ? "job" : "lead",
            recommendedScheduleIso: intent >= 72 ? suggestedSchedule(intent, 45) : null,
            raw: {
                provider: "OPEN_METEO_CLUSTER",
                incident_type: "Flood-risk cluster",
                signal_source: "Forecast + flood-prone market cluster",
                property_address: market.address,
                property_city: market.city,
                property_state: market.state,
                property_postal_code: market.postalCode,
                county: market.county,
                neighborhood: market.neighborhood,
                flood_profile: market.floodProfile,
                address_quality: "approximate",
                service_area_label: serviceAreaLabel,
                service_type: "Water Mitigation",
                urgency_window: rainWindow,
                distance_miles: distanceMiles,
                weather_signal: "Heavy rainfall pressure",
                demand_signal: "Flood-risk cluster",
                demand_explanation: `${market.floodProfile} plus ${precipNow}% rain probability is creating realistic water intrusion demand.`
            },
            createdAtIso: new Date().toISOString()
        });
    }
    return out.sort((a, b) => b.intentScore - a.intentScore).slice(0, limit);
}
async function runScanner({ mode, location, categories, limit, lat, lon, radius, campaignMode, triggers }) {
    const pickedCategories = normalizeCategories(categories);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
    const radiusMiles = Math.max(1, Math.min(250, Number(radius) || 25));
    let resolved = parseLatLon(location, lat ?? null, lon ?? null);
    if (!resolved && location.trim()) {
        const geo = await (0, weather_1.geocodeLocation)(location.trim()).catch(() => null);
        if (geo) {
            resolved = { lat: geo.lat, lon: geo.lng, label: geo.label };
        }
    }
    let forecast = null;
    if (resolved) {
        forecast = await (0, weather_1.getForecastByLatLng)(resolved.lat, resolved.lon).catch(() => null);
    }
    if (mode === "live" && resolved) {
        const [nws, forecastDriven, floodClusters, fdnyFire, usgs, eonet] = await Promise.all([
            fetchNwsOpportunities({
                lat: resolved.lat,
                lon: resolved.lon,
                serviceAreaLabel: resolved.label,
                categories: pickedCategories,
                forecast,
                limit: safeLimit
            }),
            fetchForecastDrivenOpportunities({
                lat: resolved.lat,
                lon: resolved.lon,
                serviceAreaLabel: resolved.label,
                categories: pickedCategories,
                forecast,
                limit: safeLimit
            }),
            fetchFloodClusterOpportunities({
                lat: resolved.lat,
                lon: resolved.lon,
                serviceAreaLabel: resolved.label,
                categories: pickedCategories,
                forecast,
                limit: safeLimit
            }),
            fetchNycFireOpportunities({
                lat: resolved.lat,
                lon: resolved.lon,
                serviceAreaLabel: resolved.label,
                categories: pickedCategories,
                forecast,
                limit: safeLimit
            }),
            fetchUsgsOpportunities({
                lat: resolved.lat,
                lon: resolved.lon,
                serviceAreaLabel: resolved.label,
                radiusMiles,
                categories: pickedCategories,
                forecast,
                limit: safeLimit
            }),
            fetchEonetOpportunities({
                lat: resolved.lat,
                lon: resolved.lon,
                serviceAreaLabel: resolved.label,
                radiusMiles,
                categories: pickedCategories,
                forecast,
                limit: safeLimit
            })
        ]);
        const merged = [...nws, ...forecastDriven, ...floodClusters, ...fdnyFire, ...usgs, ...eonet]
            .sort((a, b) => b.intentScore - a.intentScore)
            .slice(0, safeLimit);
        if (merged.length > 0) {
            const enriched = await Promise.all(merged.map(async (opportunity, index) => {
                if (index >= 8)
                    return opportunity;
                const propertyAddress = String(opportunity.raw?.property_address || "").trim();
                const propertyCity = String(opportunity.raw?.property_city || "").trim();
                const propertyState = String(opportunity.raw?.property_state || "").trim();
                const propertyPostalCode = String(opportunity.raw?.property_postal_code || "").trim();
                if (!propertyAddress || !propertyCity || !propertyState)
                    return opportunity;
                const enrichment = await (0, enrichment_1.enrichOpportunityLive)({
                    address: propertyAddress,
                    city: propertyCity,
                    state: propertyState,
                    postalCode: propertyPostalCode,
                    serviceType: String(opportunity.raw?.service_type || displayCampaignService(opportunity.category, campaignMode))
                }).catch(() => null);
                if (!enrichment)
                    return opportunity;
                return {
                    ...opportunity,
                    raw: {
                        ...opportunity.raw,
                        enrichment
                    }
                };
            }));
            return {
                mode,
                weatherRisk: weatherRisk(forecast),
                opportunities: enriched,
                locationResolved: resolved
            };
        }
    }
    const opportunities = createDemoOpportunities({
        location: resolved?.label || location || "Service Area",
        categories: pickedCategories,
        forecast,
        limit: safeLimit,
        campaignMode,
        triggers
    });
    return {
        mode: "demo",
        weatherRisk: weatherRisk(forecast),
        opportunities,
        locationResolved: resolved
    };
}
async function fetchGooglePlacesLeads({ location, service, radius, triggers, campaignMode }) {
    const run = await runScanner({
        mode: "demo",
        location,
        categories: [toCategory(service)],
        limit: Math.max(8, Math.min(20, radius > 25 ? 20 : 12)),
        campaignMode,
        triggers
    });
    return run.opportunities.map(toLeadFromOpportunity);
}
function generateSyntheticScannerLeads({ location, service, radius, triggers, forecast, campaignMode }) {
    const category = toCategory(service);
    const opportunities = createDemoOpportunities({
        location,
        categories: [category],
        forecast,
        limit: Math.max(8, Math.min(20, radius > 25 ? 20 : 12)),
        campaignMode,
        triggers
    });
    return opportunities.map(toLeadFromOpportunity);
}
function opportunityToLeadPayload(opportunity) {
    const leadLike = toLeadFromOpportunity(opportunity);
    const addressInfo = resolveOpportunityAddress({
        locationText: String(opportunity.raw?.property_address || opportunity.locationText || ""),
        lat: opportunity.lat,
        lon: opportunity.lon,
        serviceAreaLabel: String(opportunity.raw?.service_area_label || opportunity.locationText || "Service Area"),
        seed: opportunity.id
    });
    return {
        name: leadLike.name,
        phone: leadLike.phone,
        service_type: leadLike.service_type,
        address: addressInfo.address,
        city: leadLike.city,
        state: leadLike.state,
        postal_code: addressInfo.postalCode,
        requested_timeframe: leadLike.urgency === "high" ? "ASAP" : leadLike.urgency === "medium" ? "Today" : "This week",
        source: "import",
        notes: `Scanner ${opportunity.source}: ${opportunity.reasonSummary}`
    };
}
