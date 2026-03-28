"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSmartleadConfigured = isSmartleadConfigured;
exports.listSmartleadCampaigns = listSmartleadCampaigns;
exports.createSmartleadCampaign = createSmartleadCampaign;
exports.addLeadsToSmartleadCampaign = addLeadsToSmartleadCampaign;
exports.mapOutboundRecordToSmartleadLead = mapOutboundRecordToSmartleadLead;
const DEFAULT_BASE_URL = "https://server.smartlead.ai/api/v1";
function getBaseUrl() {
    return String(process.env.SMARTLEAD_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}
function isSmartleadConfigured() {
    return Boolean(process.env.SMARTLEAD_API_KEY);
}
async function smartleadRequest(path, options = {}) {
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
        throw new Error("SMARTLEAD_API_KEY is not configured");
    }
    const url = new URL(`${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), {
        method: options.method || "GET",
        headers: {
            "content-type": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(String(payload.message || "Smartlead request failed"));
    }
    return payload;
}
async function listSmartleadCampaigns() {
    return smartleadRequest("/campaigns");
}
async function createSmartleadCampaign(input) {
    return smartleadRequest("/campaigns/create", {
        method: "POST",
        body: {
            name: input.name,
            client_id: input.clientId || undefined
        }
    });
}
async function addLeadsToSmartleadCampaign(campaignId, leads) {
    return smartleadRequest(`/campaigns/${campaignId}/leads`, {
        method: "POST",
        body: {
            lead_list: leads
        }
    });
}
function mapOutboundRecordToSmartleadLead(record) {
    const fullName = String(record.contact_name || "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    return {
        email: record.email || undefined,
        first_name: firstName || undefined,
        last_name: rest.join(" ") || undefined,
        company_name: record.company_name || undefined,
        phone_number: record.phone || undefined,
        website: record.website || undefined,
        location: [record.city, record.state].filter(Boolean).join(", ") || record.territory || undefined,
        custom_fields: {
            record_kind: record.kind || "prospect",
            territory: record.territory || null,
            tags: Array.isArray(record.tags) ? record.tags : []
        }
    };
}
