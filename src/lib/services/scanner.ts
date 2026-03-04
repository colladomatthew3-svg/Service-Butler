import { generateSignals } from "@/lib/services/intent-engine";
import type { ForecastSummary } from "@/lib/services/weather";

export type CampaignMode = "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";

export type ScannerLead = {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
  postal: string;
  service_type: string;
  urgency: "high" | "medium" | "low";
  intentScore: number;
  reason: string;
  signals: ReturnType<typeof generateSignals>;
  sourceMode: "synthetic" | "google_places";
};

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pseudo(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function weatherRisk(forecast?: ForecastSummary | null) {
  if (!forecast) return { highRisk: false, label: "Weather stable" };
  const precip = forecast.current.precipitationChance ?? 0;
  const wind = forecast.current.windKph ?? 0;
  const next48WetHours = forecast.next6Hours.filter((h) => h.precipChance >= 45).length;
  const highRisk = precip >= 55 || wind >= 30 || next48WetHours >= 2;
  return {
    highRisk,
    label: highRisk ? "Storm/high-wind pressure expected" : "Weather stable"
  };
}

export async function fetchGooglePlacesLeads({
  location,
  service,
  radius,
  triggers,
  forecast,
  campaignMode
}: {
  location: string;
  service: string;
  radius: number;
  triggers: string[];
  forecast?: ForecastSummary | null;
  campaignMode: CampaignMode;
}): Promise<ScannerLead[]> {
  const enabled = process.env.ENABLE_GOOGLE_PLACES_MODE === "true";
  const key = process.env.GOOGLE_PLACES_API_KEY;

  if (!enabled || !key) return [];

  try {
    const triggerHint = triggers[0] ? ` ${triggers[0]} emergency` : "";
    const query = encodeURIComponent(`${service}${triggerHint} near ${location}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{ name?: string; formatted_address?: string; rating?: number; user_ratings_total?: number }>;
    };

    const rows = (json.results || []).slice(0, 12);
    const out: ScannerLead[] = rows.map((row, index) => {
      const addr = row.formatted_address || location;
      const city = addr.split(",")[0] || location;
      const state = "NY";
      const postal = String(10000 + ((index + 1) * 131) % 89999);
      const phone = `+1${String(6315551000 + index).padStart(10, "0")}`;
      const reviewCount = row.user_ratings_total || 0;
      const rating = row.rating || 0;
      const intent = Math.max(52, Math.min(96, Math.round(62 + (reviewCount > 50 ? 9 : 2) + (rating < 4 ? 7 : 3))));
      const urgency: ScannerLead["urgency"] = intent >= 80 ? "high" : intent >= 65 ? "medium" : "low";

      const leadForSignals = {
        id: `places-${index}`,
        service_type: service,
        requested_timeframe: urgency === "high" ? "ASAP" : urgency === "medium" ? "Today" : "This week",
        city,
        state
      };

      const reason = `${campaignMode}: review activity and local conditions suggest near-term demand in this area (${radius}mi scan).`;

      return {
        id: `places-${index}-${hash((row.name || "lead") + addr)}`,
        name: row.name || `${service} Prospect ${index + 1}`,
        phone,
        city,
        state,
        postal,
        service_type: service,
        urgency,
        intentScore: intent,
        reason,
        signals: generateSignals({ lead: leadForSignals, forecast }),
        sourceMode: "google_places"
      };
    });

    return out;
  } catch {
    return [];
  }
}

export function generateSyntheticScannerLeads({
  location,
  service,
  radius,
  triggers,
  forecast,
  campaignMode
}: {
  location: string;
  service: string;
  radius: number;
  triggers: string[];
  forecast?: ForecastSummary | null;
  campaignMode: CampaignMode;
}) {
  const seed = hash(`${location}|${service}|${radius}|${triggers.sort().join(",")}|${campaignMode}|${forecast?.current.temp || 0}`);
  const count = 8 + (seed % 13);

  const first = ["Mason", "Aria", "Liam", "Nora", "Carlos", "Jade", "Ethan", "Mila", "Noah", "Avery"];
  const last = ["Parker", "Santos", "Reed", "Nguyen", "Watkins", "Lopez", "Cole", "Turner", "Diaz", "Brooks"];
  const streets = ["Maple Ave", "Harbor Rd", "Cedar St", "Elm Dr", "Lake Ave", "Pine St", "South St", "Meadow Ln"];
  const cities = ["Brentwood", "Bay Shore", "Islip", "Lindenhurst", "Huntington", "Babylon", "Smithtown", "Patchogue"];
  const states = ["NY", "NJ", "CT", "PA"];
  const urgencyKeywords = ["leak", "flood", "no heat", "no cool", "sparking", "storm damage"];

  const out: ScannerLead[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = pseudo(seed + i * 7919);
    const city = cities[Math.floor(n() * cities.length)];
    const state = states[Math.floor(n() * states.length)];
    const postal = String(10000 + Math.floor(n() * 89999));
    const address = `${Math.floor(10 + n() * 900)} ${streets[Math.floor(n() * streets.length)]}`;
    const name = `${first[Math.floor(n() * first.length)]} ${last[Math.floor(n() * last.length)]}`;
    const phone = `+1${Math.floor(2000000000 + n() * 7000000000)}`;

    const triggerWeight = triggers.length ? 8 + triggers.length * 4 : 6;
    const weatherWeight = (forecast?.current.precipitationChance || 0) * 0.35 + (forecast?.current.windKph || 0) * 0.45;
    const campaignWeight = campaignMode === "Storm Response" ? 10 : campaignMode === "Water Damage" ? 8 : campaignMode === "HVAC Emergency" ? 7 : 5;
    const reviewSpikeWeight = n() > 0.65 ? 8 : 2;
    const keywordWeight = urgencyKeywords[Math.floor(n() * urgencyKeywords.length)].length > 6 ? 6 : 4;
    const base = 48 + triggerWeight + weatherWeight + campaignWeight + reviewSpikeWeight + keywordWeight + Math.floor(n() * 18);

    const intentScore = Math.max(45, Math.min(98, Math.round(base)));
    const urgency: ScannerLead["urgency"] = intentScore >= 80 ? "high" : intentScore >= 65 ? "medium" : "low";

    const requested = urgency === "high" ? "ASAP" : urgency === "medium" ? "Today" : "This week";
    const leadInput = {
      id: `scan-${seed.toString(16)}-${i}`,
      service_type: service,
      requested_timeframe: requested,
      city,
      state
    };

    const signalReasonBits = [
      triggers[0] ? `${triggers[0]} watch` : "local demand shift",
      n() > 0.5 ? "review spike nearby" : "incident chatter nearby",
      `${urgencyKeywords[Math.floor(n() * urgencyKeywords.length)]} keyword patterns`
    ];

    out.push({
      id: `scan-${seed.toString(16)}-${i}`,
      name,
      phone,
      city,
      state,
      postal,
      service_type: service,
      urgency,
      intentScore,
      reason: `${signalReasonBits.join(" + ")} around ${address}.`,
      signals: generateSignals({ lead: leadInput, forecast }),
      sourceMode: "synthetic"
    });
  }

  return out.sort((a, b) => b.intentScore - a.intentScore);
}
