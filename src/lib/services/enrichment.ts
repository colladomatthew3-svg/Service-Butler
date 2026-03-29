export type EnrichmentVerification = "verified" | "public-record" | "estimated" | "demo";

export type EnrichmentContact = {
  name: string;
  phone: string | null;
  email: string | null;
  verification: EnrichmentVerification;
  confidenceLabel: string;
};

export type EnrichmentRecord = {
  provider: string;
  simulated: boolean;
  propertyAddress: string;
  city: string;
  state: string;
  postalCode: string;
  neighborhood: string;
  propertyImageLabel: string;
  propertyImageUrl?: string | null;
  propertyImageSource?: string | null;
  propertyValueEstimate: string | null;
  propertyValueVerification: EnrichmentVerification;
  ownerContact: EnrichmentContact | null;
  notes: string[];
};

export type EnrichmentProvider = {
  enrichOpportunity(input: {
    seed: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    serviceType: string;
  }): EnrichmentRecord;
};

type CensusGeocoderResponse = {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string;
      coordinates?: { x?: number; y?: number };
      addressComponents?: {
        city?: string;
        state?: string;
        zip?: string;
      };
      geographies?: {
        Counties?: Array<{
          NAME?: string;
        }>;
      };
    }>;
  };
};

type CensusZipValueResponse = string[][];
type PremiumEnrichmentResponse = Partial<EnrichmentRecord> & {
  provider?: string;
  ownerContact?: Partial<EnrichmentContact> | null;
};

type PremiumEnrichmentRequest = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  serviceType: string;
};

const neighborhoods = ["Downtown", "Harbor District", "North Ridge", "Maple Estates", "Bayview", "West End"];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

class DemoEnrichmentProvider implements EnrichmentProvider {
  enrichOpportunity(input: {
    seed: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    serviceType: string;
  }): EnrichmentRecord {
    const seed = hash(`${input.seed}|${input.address}|${input.serviceType}`);
    const neighborhood = neighborhoods[seed % neighborhoods.length] || "Service Area";
    const firstNames = ["Jordan", "Taylor", "Casey", "Morgan", "Avery", "Parker"];
    const lastNames = ["Brooks", "Reed", "Parker", "Diaz", "Stone", "Bennett"];
    const ownerName = `${firstNames[seed % firstNames.length]} ${lastNames[(seed >> 2) % lastNames.length]}`;
    const last4 = String(1000 + (seed % 9000));

    return {
      provider: "Demo enrichment",
      simulated: true,
      propertyAddress: input.address,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      neighborhood,
      propertyImageLabel: `${input.serviceType} property preview`,
      propertyImageUrl: null,
      propertyImageSource: "Demo placeholder",
      propertyValueEstimate: `$${(325000 + (seed % 280000)).toLocaleString()}`,
      propertyValueVerification: "demo",
      ownerContact: {
        name: ownerName,
        phone: `+1 (631) 555-${last4}`,
        email: `${ownerName.toLowerCase().replace(/\s+/g, ".")}@example-demo.com`,
        verification: "demo",
        confidenceLabel: "Demo placeholder only"
      },
      notes: [
        "Simulated for demo mode using realistic placeholder property and homeowner data.",
        "Do not treat owner name, phone, email, or value estimate as verified production records.",
        "Replace with licensed or public-record enrichment providers in production."
      ]
    };
  }
}

const demoProvider = new DemoEnrichmentProvider();

function formatCurrency(value?: number | null) {
  if (!Number.isFinite(value)) return null;
  return `$${Math.round(Number(value)).toLocaleString()}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function geocodeWithCensus(address: string, city: string, state: string, postalCode: string) {
  const query = [address, city, state, postalCode].filter(Boolean).join(", ");
  if (!query) return null;

  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");

  const payload = await fetchJson<CensusGeocoderResponse>(url.toString());
  const match = payload?.result?.addressMatches?.[0];
  if (!match) return null;

  return {
    matchedAddress: match.matchedAddress || query,
    city: match.addressComponents?.city || city,
    state: match.addressComponents?.state || state,
    postalCode: match.addressComponents?.zip || postalCode,
    county: match.geographies?.Counties?.[0]?.NAME || null,
    lat: match.coordinates?.y ?? null,
    lon: match.coordinates?.x ?? null
  };
}

async function fetchZipMedianHomeValue(postalCode: string) {
  const zip = String(postalCode || "").trim();
  if (!/^\d{5}$/.test(zip)) return null;

  const url = new URL("https://api.census.gov/data/2023/acs/acs5");
  url.searchParams.set("get", "B25077_001E");
  url.searchParams.set("for", `zip code tabulation area:${zip}`);

  const payload = await fetchJson<CensusZipValueResponse>(url.toString());
  const value = payload?.[1]?.[0];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function neighborhoodFromAddress(address: string, city: string) {
  const cleaned = String(address || "").split(",")[0]?.trim() || "";
  const streetName = cleaned.replace(/^\d+\s+/, "").replace(/\b(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Boulevard|Blvd|Parkway|Pkwy)\b\.?$/i, "").trim();
  if (streetName) return `${streetName} area`;
  return city ? `${city} service area` : "Service area";
}

export function buildUsgsAerialImageUrl(lat?: number | null, lon?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const lng = Number(lon);
  const latitude = Number(lat);
  const span = 0.0022;
  const xmin = lng - span;
  const ymin = latitude - span;
  const xmax = lng + span;
  const ymax = latitude + span;
  const url = new URL("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export");
  url.searchParams.set("bbox", `${xmin},${ymin},${xmax},${ymax}`);
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "4326");
  url.searchParams.set("size", "640,420");
  url.searchParams.set("format", "jpg");
  url.searchParams.set("transparent", "false");
  url.searchParams.set("f", "image");
  return url.toString();
}

function publicAddressLabel(input: {
  address: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  return [input.address, input.city, [input.state, input.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export function buildPublicPropertyFallback(input: {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  serviceType: string;
  lat?: number | null;
  lon?: number | null;
  county?: string | null;
  propertyValueEstimate?: string | null;
  propertyValueVerification?: EnrichmentVerification;
}) {
  const normalizedAddress = publicAddressLabel(input);
  if (!normalizedAddress) return null;

  const propertyImageUrl = buildUsgsAerialImageUrl(input.lat, input.lon);

  return {
    provider: "US Census geocoder + ACS + USGS imagery",
    simulated: false,
    propertyAddress: normalizedAddress,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    neighborhood: neighborhoodFromAddress(normalizedAddress, input.city),
    propertyImageLabel: propertyImageUrl ? "USGS aerial image" : `${input.serviceType} property context`,
    propertyImageUrl,
    propertyImageSource: propertyImageUrl ? "USGS The National Map imagery" : "Public property context",
    propertyValueEstimate: input.propertyValueEstimate ?? null,
    propertyValueVerification: input.propertyValueVerification || "public-record",
    ownerContact: null,
    notes: [
      input.county ? `County context: ${input.county}.` : "Address context is based on the live service-area signal.",
      propertyImageUrl
        ? "Property imagery is sourced from public USGS aerial imagery."
        : "No public aerial image was available for this signal, so only address-level context is shown.",
      input.propertyValueEstimate
        ? "Property value is a public ACS estimate, not a parcel-level appraisal."
        : "No public ZIP-level valuation estimate was available for this address.",
      "No verified homeowner contact data is shown because only free public sources are enabled."
    ]
  } satisfies EnrichmentRecord;
}

export async function enrichOpportunityLive(input: {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  serviceType: string;
  lat?: number | null;
  lon?: number | null;
  county?: string | null;
}) : Promise<EnrichmentRecord | null> {
  const geocoded = await geocodeWithCensus(input.address, input.city, input.state, input.postalCode);
  const normalizedAddress = geocoded?.matchedAddress || [input.address, input.city, input.state, input.postalCode].filter(Boolean).join(", ");
  const normalizedCity = geocoded?.city || input.city;
  const normalizedState = geocoded?.state || input.state;
  const normalizedPostal = geocoded?.postalCode || input.postalCode;
  const county = geocoded?.county || input.county || null;
  const zipValue = await fetchZipMedianHomeValue(normalizedPostal);
  const publicRecord = buildPublicPropertyFallback({
    address: normalizedAddress,
    city: normalizedCity,
    state: normalizedState,
    postalCode: normalizedPostal,
    serviceType: input.serviceType,
    lat: geocoded?.lat ?? input.lat,
    lon: geocoded?.lon ?? input.lon,
    county,
    propertyValueEstimate: formatCurrency(zipValue),
    propertyValueVerification: zipValue != null ? "estimated" : "public-record"
  });

  if (!publicRecord) return null;

  const premium = await fetchPremiumEnrichment({
    address: normalizedAddress,
    city: normalizedCity,
    state: normalizedState,
    postalCode: normalizedPostal,
    serviceType: input.serviceType
  });

  if (!premium) return publicRecord;

  return mergeEnrichment(publicRecord, premium);
}

async function fetchPremiumEnrichment(input: {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  serviceType: string;
}): Promise<PremiumEnrichmentResponse | null> {
  const endpoint = process.env.SERVICE_BUTLER_ENRICHMENT_URL;
  if (!endpoint) return null;

  const timeoutMs = normalizeTimeoutMs(process.env.SERVICE_BUTLER_ENRICHMENT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-butler-source": "scanner",
        ...(process.env.SERVICE_BUTLER_ENRICHMENT_PROVIDER
          ? { "x-service-butler-provider": process.env.SERVICE_BUTLER_ENRICHMENT_PROVIDER }
          : {}),
        ...(process.env.SERVICE_BUTLER_ENRICHMENT_TOKEN
          ? { authorization: `Bearer ${process.env.SERVICE_BUTLER_ENRICHMENT_TOKEN}` }
          : {})
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal
    });
    if (!res.ok) return null;
    return normalizePremiumEnrichmentResponse((await res.json()) as PremiumEnrichmentResponse, input);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTimeoutMs(value?: string) {
  const parsed = Number(value || "4500");
  if (!Number.isFinite(parsed)) return 4500;
  return Math.max(500, Math.min(15000, Math.round(parsed)));
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePremiumEnrichmentResponse(
  payload: PremiumEnrichmentResponse,
  input: PremiumEnrichmentRequest
): PremiumEnrichmentResponse | null {
  if (!payload || typeof payload !== "object") return null;

  const ownerContact = payload.ownerContact
    ? {
        name: cleanString(payload.ownerContact.name) || "Verified contact",
        phone: cleanString(payload.ownerContact.phone),
        email: cleanString(payload.ownerContact.email),
        verification: payload.ownerContact.verification || "verified",
        confidenceLabel: cleanString(payload.ownerContact.confidenceLabel) || "Vendor verified"
      }
    : null;

  return {
    provider: cleanString(payload.provider) || "Premium enrichment",
    propertyAddress: cleanString(payload.propertyAddress) || input.address,
    city: cleanString(payload.city) || input.city,
    state: cleanString(payload.state) || input.state,
    postalCode: cleanString(payload.postalCode) || input.postalCode,
    neighborhood: cleanString(payload.neighborhood) || undefined,
    propertyImageLabel: cleanString(payload.propertyImageLabel) || undefined,
    propertyImageUrl: cleanString(payload.propertyImageUrl),
    propertyImageSource: cleanString(payload.propertyImageSource),
    propertyValueEstimate: cleanString(payload.propertyValueEstimate),
    propertyValueVerification: payload.propertyValueVerification || undefined,
    ownerContact,
    notes: Array.isArray(payload.notes)
      ? payload.notes.map((note) => cleanString(note)).filter((note): note is string => Boolean(note))
      : []
  };
}

function mergeEnrichment(base: EnrichmentRecord, premium: PremiumEnrichmentResponse): EnrichmentRecord {
  return {
    provider: premium.provider ? `${base.provider} + ${premium.provider}` : base.provider,
    simulated: false,
    propertyAddress: premium.propertyAddress || base.propertyAddress,
    city: premium.city || base.city,
    state: premium.state || base.state,
    postalCode: premium.postalCode || base.postalCode,
    neighborhood: premium.neighborhood || base.neighborhood,
    propertyImageLabel: premium.propertyImageLabel || base.propertyImageLabel,
    propertyImageUrl: premium.propertyImageUrl ?? base.propertyImageUrl ?? null,
    propertyImageSource: premium.propertyImageSource ?? base.propertyImageSource ?? null,
    propertyValueEstimate: premium.propertyValueEstimate || base.propertyValueEstimate,
    propertyValueVerification: premium.propertyValueVerification || base.propertyValueVerification,
    ownerContact: premium.ownerContact
      ? {
          name: premium.ownerContact.name || "Verified contact",
          phone: premium.ownerContact.phone || null,
          email: premium.ownerContact.email || null,
          verification: premium.ownerContact.verification || "verified",
          confidenceLabel: premium.ownerContact.confidenceLabel || "Vendor verified"
        }
      : base.ownerContact,
    notes: [...base.notes, ...(premium.notes || [])]
  };
}

export function getEnrichmentProvider(mode: "demo" | "live") {
  if (mode === "demo") return demoProvider;
  return null;
}
