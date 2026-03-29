import type { DataSourceTermsStatus } from "@/lib/control-plane/types";

export type DataSourceCatalogEntry = {
  catalogKey: string;
  connectorKey: string;
  sourceType: string;
  name: string;
  description: string;
  liveRequirements: string[];
  defaultTermsStatus: Exclude<DataSourceTermsStatus, "unknown">;
  defaultReliabilityScore: number;
  defaultProvenance: string;
  defaultConfig: Record<string, unknown>;
};

export const dataSourceCatalog: DataSourceCatalogEntry[] = [
  {
    catalogKey: "weather.noaa",
    connectorKey: "weather.noaa",
    sourceType: "weather",
    name: "NOAA Weather Alerts",
    description: "Storm, flood, hail, wind, and freeze intelligence for restoration demand.",
    liveRequirements: ["Latitude and longitude for the service area."],
    defaultTermsStatus: "approved",
    defaultReliabilityScore: 86,
    defaultProvenance: "api.weather.gov",
    defaultConfig: {
      latitude: 40.7812,
      longitude: -73.2462,
      city: "Brentwood",
      state: "NY",
      postal_code: "11717"
    }
  },
  {
    catalogKey: "permits.production",
    connectorKey: "permits.production",
    sourceType: "permits",
    name: "Building Permits",
    description: "Permit intelligence for roof, plumbing, mitigation, and downstream restoration demand.",
    liveRequirements: ["Permits provider endpoint or token.", "terms_status=approved for live ingestion."],
    defaultTermsStatus: "pending_review",
    defaultReliabilityScore: 74,
    defaultProvenance: "permits.provider",
    defaultConfig: {
      provider_url: "",
      provider_token: "",
      terms_status: "pending_review"
    }
  },
  {
    catalogKey: "social.intent.public",
    connectorKey: "social.intent.public",
    sourceType: "social",
    name: "Consumer Distress Signals",
    description: "Reddit and review-style distress signals for restoration and emergency home-service demand.",
    liveRequirements: ["Approved terms for ingestion.", "Configure a public JSON feed URL or Reddit search terms before activating live runs."],
    defaultTermsStatus: "pending_review",
    defaultReliabilityScore: 58,
    defaultProvenance: "reddit.com/search.json",
    defaultConfig: {
      source_name: "Public Distress Signals",
      platform: "reddit",
      feed_url: "",
      search_terms: [],
      subreddits: [],
      sample_records: []
    }
  },
  {
    catalogKey: "incidents.generic",
    connectorKey: "incidents.generic",
    sourceType: "incident",
    name: "Public Incident Feed",
    description: "Fire, flood, outage, and public emergency incidents with restoration relevance.",
    liveRequirements: ["Approved terms for ingestion.", "Citizen-style feeds remain compliance-gated by default."],
    defaultTermsStatus: "pending_review",
    defaultReliabilityScore: 66,
    defaultProvenance: "public.incident.feed",
    defaultConfig: {
      source_name: "Public Incident Feed",
      sample_records: []
    }
  },
  {
    catalogKey: "water.usgs",
    connectorKey: "water.usgs",
    sourceType: "usgs_water",
    name: "USGS Water Data",
    description: "River and streamflow indicators that predict flood-related restoration demand.",
    liveRequirements: ["USGS site codes or a custom endpoint."],
    defaultTermsStatus: "approved",
    defaultReliabilityScore: 82,
    defaultProvenance: "api.waterdata.usgs.gov",
    defaultConfig: {
      site_codes: "01358000,01371500"
    }
  },
  {
    catalogKey: "open311.generic",
    connectorKey: "open311.generic",
    sourceType: "open311",
    name: "Open311 Service Requests",
    description: "Municipal 311 service requests that expose water, fire, and infrastructure issues.",
    liveRequirements: ["Approved terms status.", "Municipal endpoint, or rely on the public NYC default."],
    defaultTermsStatus: "approved",
    defaultReliabilityScore: 69,
    defaultProvenance: "open311",
    defaultConfig: {
      endpoint: "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100"
    }
  },
  {
    catalogKey: "disaster.openfema",
    connectorKey: "disaster.openfema",
    sourceType: "openfema",
    name: "OpenFEMA Disasters",
    description: "Federal disaster declaration context for catastrophe-response and territory planning.",
    liveRequirements: ["Approved terms status."],
    defaultTermsStatus: "approved",
    defaultReliabilityScore: 80,
    defaultProvenance: "fema.open.gov",
    defaultConfig: {}
  },
  {
    catalogKey: "enrichment.census",
    connectorKey: "enrichment.census",
    sourceType: "census",
    name: "Census Market Enrichment",
    description: "Housing age, vacancy, and market-risk enrichment for restoration targeting.",
    liveRequirements: ["Approved terms status.", "Optional Census API key for higher-volume access."],
    defaultTermsStatus: "approved",
    defaultReliabilityScore: 72,
    defaultProvenance: "api.census.gov",
    defaultConfig: {
      endpoint: "",
      state: "36"
    }
  },
  {
    catalogKey: "property.overpass",
    connectorKey: "property.overpass",
    sourceType: "overpass",
    name: "OpenStreetMap Overpass",
    description: "Commercial property and asset signals to prioritize restoration and facility-response targets.",
    liveRequirements: ["Overpass query for the target geography or asset class."],
    defaultTermsStatus: "approved",
    defaultReliabilityScore: 68,
    defaultProvenance: "overpass-api.de",
    defaultConfig: {
      endpoint: "https://overpass-api.de/api/interpreter",
      query: ""
    }
  }
];

export function getDataSourceCatalogEntry(catalogKey: string) {
  return dataSourceCatalog.find((entry) => entry.catalogKey === catalogKey) || null;
}

export function getCatalogEntryForSourceType(sourceType: string) {
  const normalized = String(sourceType || "").toLowerCase();
  return dataSourceCatalog.find((entry) => entry.sourceType === normalized) || null;
}
