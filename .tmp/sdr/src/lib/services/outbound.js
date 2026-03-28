"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prospectSegments = void 0;
exports.normalizeTagList = normalizeTagList;
exports.parseBooleanFlag = parseBooleanFlag;
exports.cleanText = cleanText;
exports.cleanNumber = cleanNumber;
exports.buildTerritory = buildTerritory;
exports.toTitleCase = toTitleCase;
exports.buildCsv = buildCsv;
exports.getIncidentTriggeredSegments = getIncidentTriggeredSegments;
exports.deriveOpportunityTerritory = deriveOpportunityTerritory;
exports.buildTriggeredListName = buildTriggeredListName;
exports.prospectSegments = [
    "property_manager",
    "multifamily_operator",
    "commercial_owner",
    "hoa",
    "facilities_manager",
    "insurance_agent",
    "public_adjuster",
    "plumber",
    "roofer",
    "hvac_contractor",
    "broker_agent",
    "inspector"
];
function normalizeTagList(input) {
    if (!Array.isArray(input))
        return [];
    return input.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 20);
}
function parseBooleanFlag(input) {
    if (input == null || input === "")
        return null;
    const normalized = String(input).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized))
        return true;
    if (["0", "false", "no", "off"].includes(normalized))
        return false;
    return null;
}
function cleanText(input) {
    const value = String(input || "").trim();
    return value.length > 0 ? value : null;
}
function cleanNumber(input) {
    const value = Number(input);
    return Number.isFinite(value) ? value : null;
}
function buildTerritory(parts) {
    const cleaned = parts.map((part) => String(part || "").trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(", ") : null;
}
function toTitleCase(value) {
    return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
function buildCsv(headers, rows) {
    const escape = (value) => {
        const text = String(value ?? "");
        if (!/[",\n]/.test(text))
            return text;
        return `"${text.replaceAll("\"", "\"\"")}"`;
    };
    const body = rows.map((row) => headers.map((header) => escape(row[header])).join(","));
    return [headers.join(","), ...body].join("\n");
}
function getIncidentTriggeredSegments(opportunity) {
    const category = String(opportunity.category || "").toLowerCase();
    const tags = normalizeTagList(opportunity.raw?.tags);
    if (category === "restoration" || tags.some((tag) => tag.includes("flood") || tag.includes("storm"))) {
        return ["property_manager", "multifamily_operator", "insurance_agent", "public_adjuster", "plumber"];
    }
    if (category === "demolition" || tags.some((tag) => tag.includes("fire") || tag.includes("smoke"))) {
        return ["commercial_owner", "facilities_manager", "public_adjuster", "inspector"];
    }
    if (category === "asbestos") {
        return ["property_manager", "commercial_owner", "inspector", "broker_agent"];
    }
    return ["property_manager", "commercial_owner", "plumber", "hvac_contractor"];
}
function deriveOpportunityTerritory(opportunity) {
    return (cleanText(opportunity.territory) ||
        buildTerritory([cleanText(opportunity.city), cleanText(opportunity.state)]) ||
        cleanText(opportunity.location_text) ||
        cleanText(opportunity.raw?.service_area_label) ||
        null);
}
function buildTriggeredListName(opportunity) {
    const territory = deriveOpportunityTerritory(opportunity) || "Target Area";
    const base = cleanText(opportunity.title) || `${toTitleCase(String(opportunity.category || "incident"))} Incident`;
    return `${base} - ${territory} Outreach`;
}
