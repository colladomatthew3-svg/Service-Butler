type SmartleadCampaignInput = {
  name: string;
  clientId?: string | null;
};

type SmartleadLeadInput = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone_number?: string | null;
  website?: string | null;
  location?: string | null;
  custom_fields?: Record<string, unknown>;
};

type SmartleadRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

const DEFAULT_BASE_URL = "https://server.smartlead.ai/api/v1";

function getBaseUrl() {
  return String(process.env.SMARTLEAD_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function isSmartleadConfigured() {
  return Boolean(process.env.SMARTLEAD_API_KEY);
}

async function smartleadRequest(path: string, options: SmartleadRequestOptions = {}) {
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
    throw new Error(String((payload as { message?: string }).message || "Smartlead request failed"));
  }

  return payload;
}

export async function listSmartleadCampaigns() {
  return smartleadRequest("/campaigns");
}

export async function createSmartleadCampaign(input: SmartleadCampaignInput) {
  return smartleadRequest("/campaigns/create", {
    method: "POST",
    body: {
      name: input.name,
      client_id: input.clientId || undefined
    }
  });
}

export async function addLeadsToSmartleadCampaign(campaignId: string, leads: SmartleadLeadInput[]) {
  return smartleadRequest(`/campaigns/${campaignId}/leads`, {
    method: "POST",
    body: {
      lead_list: leads
    }
  });
}

export function mapOutboundRecordToSmartleadLead(record: {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  territory?: string | null;
  tags?: string[];
  kind?: string;
}) {
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
