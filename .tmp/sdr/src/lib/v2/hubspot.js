"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHubSpotConfigured = isHubSpotConfigured;
exports.createHubSpotTask = createHubSpotTask;
exports.validateHubSpotAccess = validateHubSpotAccess;
const HUBSPOT_BASE_URL = "https://api.hubapi.com";
function isHubSpotConfigured() {
    return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}
function hubspotSafeModeEnabled() {
    const value = String(process.env.SB_HUBSPOT_SAFE_MODE || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "on" || value === "yes";
}
async function hubspotRequest(path, init) {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token)
        throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
    const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
        ...init,
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            ...(init?.headers || {})
        }
    });
    const payload = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new Error(String(payload.message || payload.error || "HubSpot request failed"));
    }
    return payload;
}
async function createHubSpotTask(input) {
    if (!isHubSpotConfigured()) {
        return {
            skipped: true,
            providerId: null,
            reason: "HUBSPOT_ACCESS_TOKEN missing",
            mode: "disabled"
        };
    }
    const safeMode = input.safeMode ?? hubspotSafeModeEnabled();
    if (safeMode) {
        return {
            skipped: false,
            providerId: `hubspot-safe-${Date.now()}`,
            mode: "safe",
            response: {
                preview: true,
                title: input.title
            }
        };
    }
    const payload = {
        properties: {
            hs_timestamp: input.dueAtIso || new Date().toISOString(),
            hs_task_subject: input.title,
            hs_task_body: input.body,
            hs_task_status: "NOT_STARTED",
            hs_task_priority: "HIGH",
            hubspot_owner_id: input.ownerId || undefined
        },
        associations: []
    };
    if (input.contactId) {
        payload.associations.push({
            to: { id: input.contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }]
        });
    }
    if (input.companyId) {
        payload.associations.push({
            to: { id: input.companyId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 192 }]
        });
    }
    const response = await hubspotRequest("/crm/v3/objects/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
    });
    return {
        skipped: false,
        providerId: String(response.id || "") || null,
        mode: "live",
        response
    };
}
async function validateHubSpotAccess() {
    if (!isHubSpotConfigured()) {
        return {
            ok: false,
            skipped: true,
            reason: "HUBSPOT_ACCESS_TOKEN missing"
        };
    }
    try {
        const payload = await hubspotRequest("/integrations/v1/me");
        return {
            ok: true,
            skipped: false,
            portalId: String(payload.portalId || ""),
            payload
        };
    }
    catch (error) {
        return {
            ok: false,
            skipped: false,
            reason: error instanceof Error ? error.message : "HubSpot validation failed"
        };
    }
}
