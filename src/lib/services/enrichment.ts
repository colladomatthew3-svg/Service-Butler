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
      propertyValueEstimate: `$${(325000 + (seed % 280000)).toLocaleString()}`,
      propertyValueVerification: "demo",
      ownerContact: {
        name: ownerName,
        phone: `+1 (631) 555-${last4}`,
        email: `${ownerName.toLowerCase().replace(/\s+/g, ".")}@example-demo.com`,
        verification: "demo",
        confidenceLabel: "Demo placeholder"
      },
      notes: [
        "Simulated for demo mode using realistic placeholder property data.",
        "Replace with licensed or public-record enrichment providers in production."
      ]
    };
  }
}

const demoProvider = new DemoEnrichmentProvider();

export function getEnrichmentProvider(mode: "demo" | "live") {
  if (mode === "demo") return demoProvider;
  return null;
}
