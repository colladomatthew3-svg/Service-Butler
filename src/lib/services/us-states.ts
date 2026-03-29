const US_STATES: Record<string, { code: string; name: string }> = {
  AL: { code: "AL", name: "Alabama" },
  AK: { code: "AK", name: "Alaska" },
  AZ: { code: "AZ", name: "Arizona" },
  AR: { code: "AR", name: "Arkansas" },
  CA: { code: "CA", name: "California" },
  CO: { code: "CO", name: "Colorado" },
  CT: { code: "CT", name: "Connecticut" },
  DE: { code: "DE", name: "Delaware" },
  DC: { code: "DC", name: "District of Columbia" },
  FL: { code: "FL", name: "Florida" },
  GA: { code: "GA", name: "Georgia" },
  HI: { code: "HI", name: "Hawaii" },
  ID: { code: "ID", name: "Idaho" },
  IL: { code: "IL", name: "Illinois" },
  IN: { code: "IN", name: "Indiana" },
  IA: { code: "IA", name: "Iowa" },
  KS: { code: "KS", name: "Kansas" },
  KY: { code: "KY", name: "Kentucky" },
  LA: { code: "LA", name: "Louisiana" },
  ME: { code: "ME", name: "Maine" },
  MD: { code: "MD", name: "Maryland" },
  MA: { code: "MA", name: "Massachusetts" },
  MI: { code: "MI", name: "Michigan" },
  MN: { code: "MN", name: "Minnesota" },
  MS: { code: "MS", name: "Mississippi" },
  MO: { code: "MO", name: "Missouri" },
  MT: { code: "MT", name: "Montana" },
  NE: { code: "NE", name: "Nebraska" },
  NV: { code: "NV", name: "Nevada" },
  NH: { code: "NH", name: "New Hampshire" },
  NJ: { code: "NJ", name: "New Jersey" },
  NM: { code: "NM", name: "New Mexico" },
  NY: { code: "NY", name: "New York" },
  NC: { code: "NC", name: "North Carolina" },
  ND: { code: "ND", name: "North Dakota" },
  OH: { code: "OH", name: "Ohio" },
  OK: { code: "OK", name: "Oklahoma" },
  OR: { code: "OR", name: "Oregon" },
  PA: { code: "PA", name: "Pennsylvania" },
  RI: { code: "RI", name: "Rhode Island" },
  SC: { code: "SC", name: "South Carolina" },
  SD: { code: "SD", name: "South Dakota" },
  TN: { code: "TN", name: "Tennessee" },
  TX: { code: "TX", name: "Texas" },
  UT: { code: "UT", name: "Utah" },
  VT: { code: "VT", name: "Vermont" },
  VA: { code: "VA", name: "Virginia" },
  WA: { code: "WA", name: "Washington" },
  WV: { code: "WV", name: "West Virginia" },
  WI: { code: "WI", name: "Wisconsin" },
  WY: { code: "WY", name: "Wyoming" }
};

const LOOKUP = new Map<string, string>();

for (const { code, name } of Object.values(US_STATES)) {
  LOOKUP.set(code.toLowerCase(), code);
  LOOKUP.set(name.toLowerCase(), code);
}

export function toUsStateCode(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return LOOKUP.get(normalized) || null;
}

export function isUsStateCode(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return Boolean(normalized && US_STATES[normalized]);
}
