export const prospectSegments = [
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
] as const;

export type ProspectSegment = (typeof prospectSegments)[number];

export type ProspectRecord = {
  id: string;
  company_name: string;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  territory: string | null;
  prospect_type: string;
  property_type: string | null;
  building_count: number | null;
  priority_tier: string;
  strategic_value: number;
  near_active_incident: boolean;
  last_outbound_at: string | null;
  notes: string | null;
  tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
};

export type ReferralPartnerRecord = {
  id: string;
  company_name: string;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  territory: string | null;
  partner_type: string;
  priority_tier: string;
  strategic_value: number;
  near_active_incident: boolean;
  last_outbound_at: string | null;
  notes: string | null;
  tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
};

export type OutboundListRecord = {
  id: string;
  name: string;
  list_type: string;
  segment_definition_json: Record<string, unknown>;
  territory: string | null;
  source_trigger: string | null;
  campaign_name: string | null;
  smartlead_campaign_id: string | null;
  export_status: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
};

export type OpportunityListSeed = {
  id: string;
  title: string | null;
  category: string | null;
  location_text: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  territory?: string | null;
  raw?: Record<string, unknown> | null;
};

export function normalizeTagList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 20);
}

export function parseBooleanFlag(input: unknown): boolean | null {
  if (input == null || input === "") return null;
  const normalized = String(input).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function cleanText(input: unknown) {
  const value = String(input || "").trim();
  return value.length > 0 ? value : null;
}

export function cleanNumber(input: unknown) {
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

export function buildTerritory(parts: Array<string | null | undefined>) {
  const cleaned = parts.map((part) => String(part || "").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : null;
}

export function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replaceAll("\"", "\"\"")}"`;
  };

  const body = rows.map((row) => headers.map((header) => escape(row[header])).join(","));
  return [headers.join(","), ...body].join("\n");
}

export function getIncidentTriggeredSegments(opportunity: OpportunityListSeed) {
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

export function deriveOpportunityTerritory(opportunity: OpportunityListSeed) {
  return (
    cleanText(opportunity.territory) ||
    buildTerritory([cleanText(opportunity.city), cleanText(opportunity.state)]) ||
    cleanText(opportunity.location_text) ||
    cleanText(opportunity.raw?.service_area_label) ||
    null
  );
}

export function buildTriggeredListName(opportunity: OpportunityListSeed) {
  const territory = deriveOpportunityTerritory(opportunity) || "Target Area";
  const base = cleanText(opportunity.title) || `${toTitleCase(String(opportunity.category || "incident"))} Incident`;
  return `${base} - ${territory} Outreach`;
}
