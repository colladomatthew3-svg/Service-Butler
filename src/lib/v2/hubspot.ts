const HUBSPOT_BASE_URL = "https://api.hubapi.com";

export function isHubSpotConfigured() {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}

async function hubspotRequest(path: string, init?: RequestInit) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");

  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.message || payload.error || "HubSpot request failed"));
  }

  return payload;
}

export async function createHubSpotTask(input: {
  title: string;
  body: string;
  dueAtIso?: string | null;
  ownerId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
}) {
  if (!isHubSpotConfigured()) {
    return {
      skipped: true,
      providerId: null,
      reason: "HUBSPOT_ACCESS_TOKEN missing"
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
    associations: [] as Array<Record<string, unknown>>
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
    response
  };
}
