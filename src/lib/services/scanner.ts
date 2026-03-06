import { generateSignals } from "@/lib/services/intent-engine";
import { geocodeLocation, getForecastByLatLng, type ForecastSummary } from "@/lib/services/weather";

export type CampaignMode = "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";
export type ScannerMode = "demo" | "live";
export type ScannerCategory = "plumbing" | "demolition" | "asbestos" | "restoration" | "general";

export type ScannerOpportunity = {
  id: string;
  source: "demo" | "weather" | "public_feed" | "google_places";
  category: ScannerCategory;
  title: string;
  description: string;
  locationText: string;
  lat: number | null;
  lon: number | null;
  intentScore: number;
  priorityLabel: "Call now" | "Follow up" | "Schedule later";
  confidence: number;
  tags: string[];
  nextAction: string;
  reasonSummary: string;
  recommendedCreateMode: "lead" | "job";
  recommendedScheduleIso: string | null;
  raw: Record<string, unknown>;
  createdAtIso: string;
};

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
  priorityLabel: "Call now" | "Follow up" | "Schedule later";
  reason: string;
  signals: ReturnType<typeof generateSignals>;
  sourceMode: "synthetic" | "google_places";
};

const VALID_CATEGORIES: ScannerCategory[] = ["restoration", "plumbing", "demolition", "asbestos", "general"];

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

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeCategories(input?: string[]): ScannerCategory[] {
  if (!Array.isArray(input) || input.length === 0) return [...VALID_CATEGORIES];
  const set = new Set<ScannerCategory>();
  for (const raw of input) {
    const c = String(raw || "").toLowerCase().trim();
    if (VALID_CATEGORIES.includes(c as ScannerCategory)) set.add(c as ScannerCategory);
  }
  return set.size > 0 ? Array.from(set) : [...VALID_CATEGORIES];
}

function parseLatLon(location?: string, lat?: number | null, lon?: number | null) {
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat: Number(lat), lon: Number(lon), label: `${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}` };
  }
  const match = String(location || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (match) {
    return { lat: Number(match[1]), lon: Number(match[2]), label: `${Number(match[1]).toFixed(3)}, ${Number(match[2]).toFixed(3)}` };
  }
  return null;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "ServiceButler-Scanner/1.0" },
      signal: controller.signal
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function weatherRisk(forecast?: ForecastSummary | null) {
  if (!forecast) return { highRisk: false, label: "Weather stable" };
  const precip = forecast.current.precipitationChance ?? 0;
  const wind = forecast.current.windKph ?? 0;
  const wetHours = forecast.next6Hours.filter((h) => h.precipChance >= 45).length;
  const highRisk = precip >= 55 || wind >= 30 || wetHours >= 2;
  return {
    highRisk,
    label: highRisk ? "Storm/high-wind pressure expected" : "Weather stable"
  };
}

function weatherBoost(category: ScannerCategory, forecast?: ForecastSummary | null) {
  if (!forecast) return 0;
  const precip = forecast.current.precipitationChance ?? 0;
  const wind = forecast.current.windKph ?? 0;
  if (category === "restoration") return precip * 0.35 + wind * 0.45;
  if (category === "plumbing") return precip * 0.25 + wind * 0.1;
  if (category === "demolition") return wind * 0.2 + precip * 0.08;
  if (category === "asbestos") return precip * 0.15;
  return precip * 0.12;
}

function scoreOpportunity(category: ScannerCategory, tags: string[], forecast?: ForecastSummary | null, confidenceBase = 55) {
  const baseByCategory: Record<ScannerCategory, number> = {
    plumbing: 62,
    demolition: 58,
    asbestos: 54,
    restoration: 66,
    general: 49
  };
  const tagWeight = tags.length * 4;
  const weatherWeight = weatherBoost(category, forecast);
  const intentScore = clamp(baseByCategory[category] + tagWeight + weatherWeight);
  const confidence = clamp(confidenceBase + tags.length * 3 + Math.min(weatherWeight * 0.3, 16));
  return { intentScore, confidence };
}

function priorityLabelForOpportunity({
  intentScore,
  tags,
  title,
  description,
  reasonSummary,
  raw
}: {
  intentScore: number;
  tags: string[];
  title: string;
  description: string;
  reasonSummary: string;
  raw?: Record<string, unknown>;
}): "Call now" | "Follow up" | "Schedule later" {
  const normalizedTags = tags.map((tag) => String(tag || "").toLowerCase());
  const text = `${title} ${description} ${reasonSummary}`.toLowerCase();

  // Deterministic thresholding strategy:
  // - Base score from model intent.
  // - Add urgency points when explicit emergency signals are present.
  // - Apply conservative penalties for lower urgency signals.
  // Final threshold mapping:
  //   >= 86 => Call now
  //   >= 68 => Follow up
  //   < 68 => Schedule later
  let weightedScore = intentScore;

  const immediateSignals = ["emergency", "urgent", "immediate", "burst pipe", "flood", "fire damage", "collapsed ceiling"];
  if (immediateSignals.some((signal) => normalizedTags.includes(signal) || text.includes(signal))) {
    weightedScore += 10;
  }

  const mediumSignals = ["storm", "insurance claim", "water damage", "inspection", "asbestos", "weather"];
  if (mediumSignals.some((signal) => normalizedTags.includes(signal) || text.includes(signal))) {
    weightedScore += 4;
  }

  if (normalizedTags.includes("quote") || text.includes("this week") || text.includes("scheduled")) {
    weightedScore -= 6;
  }

  if (String(raw?.urgency || "").toLowerCase() === "immediate") {
    weightedScore += 8;
  }

  if (weightedScore >= 86) return "Call now";
  if (weightedScore >= 68) return "Follow up";
  return "Schedule later";
}

function suggestedNextAction(category: ScannerCategory, intentScore: number, locationText: string) {
  if (intentScore >= 80) {
    return `Call within 10 minutes and offer same-day dispatch near ${locationText}.`;
  }
  if (category === "asbestos") {
    return `Qualify safety scope and schedule site inspection for ${locationText}.`;
  }
  return `Dispatch to lead inbox and follow up within 30 minutes for ${locationText}.`;
}

function distanceSummary(index: number, locationText: string) {
  const miles = 4 + (index % 5) * 6;
  return `${miles} mi from ${locationText}`;
}

function suggestedSchedule(intentScore: number, slaMinutes = 90) {
  const now = Date.now();
  const target = new Date(now + Math.max(30, slaMinutes) * 60_000);
  if (intentScore >= 80) {
    target.setMinutes(0, 0, 0);
    target.setHours(target.getHours() + 1);
  }
  return target.toISOString();
}

function toCategory(service?: string): ScannerCategory {
  const value = String(service || "").toLowerCase();
  if (value.includes("restor") || value.includes("water") || value.includes("fire") || value.includes("mold")) return "restoration";
  if (value.includes("plumb")) return "plumbing";
  if (value.includes("demo") || value.includes("collapse")) return "demolition";
  if (value.includes("asbestos")) return "asbestos";
  return "general";
}

function displayService(category: ScannerCategory) {
  if (category === "plumbing") return "Plumbing";
  if (category === "demolition") return "Demolition";
  if (category === "asbestos") return "Asbestos";
  if (category === "restoration") return "Restoration";
  return "General";
}

function mkId(parts: string[]) {
  return `scan-${hash(parts.join("|"))}`;
}

function toLeadFromOpportunity(op: ScannerOpportunity): ScannerLead {
  const cityGuess = op.locationText.split(",")[0]?.trim() || "Service Area";
  const stateGuess = op.locationText.split(",")[1]?.trim() || "NY";
  const nameSeed = hash(op.title + op.locationText);
  const first = ["Jordan", "Avery", "Mason", "Noah", "Mia", "Liam", "Aria", "Elijah"];
  const last = ["Parker", "Nguyen", "Diaz", "Brooks", "Carter", "Stone", "Bennett", "Reed"];
  const name = `${first[nameSeed % first.length]} ${last[(nameSeed >> 2) % last.length]}`;
  const phone = `+1${String(6310000000 + (nameSeed % 8999999)).slice(0, 10)}`;
  const urgency: ScannerLead["urgency"] = op.intentScore >= 80 ? "high" : op.intentScore >= 65 ? "medium" : "low";

  const signalLead = {
    id: op.id,
    service_type: displayService(op.category),
    requested_timeframe: urgency === "high" ? "ASAP" : urgency === "medium" ? "Today" : "This week",
    city: cityGuess,
    state: stateGuess
  };

  return {
    id: op.id,
    name,
    phone,
    city: cityGuess,
    state: stateGuess,
    postal: String(10000 + (nameSeed % 89999)),
    service_type: displayService(op.category),
    urgency,
    intentScore: op.intentScore,
    priorityLabel: op.priorityLabel,
    reason: op.reasonSummary,
    signals: generateSignals({ lead: signalLead }),
    sourceMode: op.source === "google_places" ? "google_places" : "synthetic"
  };
}

function createDemoOpportunities({
  location,
  categories,
  forecast,
  limit,
  campaignMode,
  triggers
}: {
  location: string;
  categories: ScannerCategory[];
  forecast?: ForecastSummary | null;
  limit: number;
  campaignMode?: CampaignMode;
  triggers?: string[];
}): ScannerOpportunity[] {
  const seed = hash(`${location}|${categories.join(",")}|${campaignMode || "none"}|${(triggers || []).join(",")}`);
  const rand = pseudo(seed);

  const phrases: Record<ScannerCategory, string[]> = {
    plumbing: ["Burst pipe reports", "Water in basement alerts", "Emergency drain overflow chatter"],
    demolition: ["Collapsed ceiling reports", "Demo needed calls", "Post-fire strip-out demand"],
    asbestos: ["Mold and asbestos concern inquiries", "Abatement keyword spike", "Inspection request wave"],
    restoration: ["Fire damage reports", "Smoke smell complaints", "Water damage response demand"],
    general: ["Emergency homeowner requests", "Insurance claim mentions", "Local service demand lift"]
  };

  const tagsByCategory: Record<ScannerCategory, string[]> = {
    plumbing: ["emergency", "burst pipe", "water in basement", "insurance claim"],
    demolition: ["collapsed ceiling", "demo needed", "fire damage", "urgent"],
    asbestos: ["asbestos", "mold", "inspection", "safety"],
    restoration: ["fire damage", "smoke smell", "water damage", "insurance claim"],
    general: ["emergency", "local-demand", "review-spike", "quote"]
  };

  const count = Math.max(8, Math.min(20, limit));
  const out: ScannerOpportunity[] = [];

  for (let i = 0; i < count; i += 1) {
    const category = categories[Math.floor(rand() * categories.length)] || "general";
    const phrase = phrases[category][Math.floor(rand() * phrases[category].length)];
    const tags = [
      tagsByCategory[category][Math.floor(rand() * tagsByCategory[category].length)],
      tagsByCategory[category][Math.floor(rand() * tagsByCategory[category].length)],
      campaignMode === "Storm Response" ? "storm-response" : "dispatch"
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const { intentScore, confidence } = scoreOpportunity(category, tags, forecast, 58 + Math.floor(rand() * 14));
    const locationText = location.includes(",") ? location : `${location}, NY`;
    const id = mkId(["demo", category, phrase, locationText, String(i)]);
    const weatherSignal = forecast?.current.precipitationChance
      ? `${forecast.current.precipitationChance}% rain chance`
      : "stable weather window";
    const timeWindow = intentScore >= 80 ? "next 2 hours" : intentScore >= 68 ? "today" : "this week";
    const distance = distanceSummary(i, locationText);
    const distanceMiles = 4 + (i % 5) * 6;
    const serviceType = displayService(category);
    const demandSignal = tags.join(", ");
    const reasonSummary = `Why this opportunity: ${weatherSignal}, ${timeWindow} demand window, ${distance}, ${displayService(category)} service match.`;

    out.push({
      id,
      source: "demo",
      category,
      title: `${phrase} near ${locationText}`,
      description: `Signals indicate ${serviceType.toLowerCase()} demand lift in this zone.`,
      locationText,
      lat: null,
      lon: null,
      intentScore,
      priorityLabel: priorityLabelForOpportunity({
        intentScore,
        tags,
        title: `${phrase} near ${locationText}`,
        description: `Signals indicate ${displayService(category).toLowerCase()} demand lift in this zone.`,
        reasonSummary,
        raw: {
          mode: "demo",
          category,
          triggers: triggers || [],
          weather_signal: weatherSignal,
          forecast_window: timeWindow,
          distance_miles: distanceMiles,
          service_type: serviceType,
          demand_signal: demandSignal
        }
      }),
      confidence,
      tags,
      nextAction: suggestedNextAction(category, intentScore, locationText),
      reasonSummary,
      recommendedCreateMode: intentScore >= 76 ? "job" : "lead",
      recommendedScheduleIso: intentScore >= 70 ? suggestedSchedule(intentScore, 75) : null,
      raw: {
        mode: "demo",
        category,
        triggers: triggers || [],
        weather_signal: weatherSignal,
        forecast_window: timeWindow,
        distance_miles: distanceMiles,
        service_type: serviceType,
        demand_signal: demandSignal
      },
      createdAtIso: new Date().toISOString()
    });
  }

  return out.sort((a, b) => b.intentScore - a.intentScore).slice(0, limit);
}

type NwsAlertsResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      event?: string;
      headline?: string;
      description?: string;
      areaDesc?: string;
      severity?: string;
      urgency?: string;
      sent?: string;
    };
    geometry?: { type?: string; coordinates?: unknown };
  }>;
};

function categoryFromAlert(eventText: string): ScannerCategory {
  const t = eventText.toLowerCase();
  if (t.includes("flood") || t.includes("storm") || t.includes("tornado") || t.includes("hail")) return "restoration";
  if (t.includes("wind") || t.includes("collapse") || t.includes("debris")) return "demolition";
  if (t.includes("freeze") || t.includes("pipe")) return "plumbing";
  if (t.includes("smoke") || t.includes("air quality")) return "asbestos";
  return "general";
}

async function fetchNwsOpportunities({
  lat,
  lon,
  categories,
  forecast,
  limit
}: {
  lat: number;
  lon: number;
  categories: ScannerCategory[];
  forecast?: ForecastSummary | null;
  limit: number;
}): Promise<ScannerOpportunity[]> {
  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const payload = await fetchJsonWithTimeout<NwsAlertsResponse>(url, 9500);
  if (!payload?.features?.length) return [];

  const out: ScannerOpportunity[] = [];
  for (const feature of payload.features.slice(0, limit * 2)) {
    const props = feature.properties || {};
    const category = categoryFromAlert(`${props.event || ""} ${props.headline || ""}`);
    if (!categories.includes(category)) continue;

    const severityWeight = String(props.severity || "").toLowerCase() === "severe" ? 14 : 8;
    const urgencyWeight = String(props.urgency || "").toLowerCase() === "immediate" ? 12 : 6;
    const tags = ["weather", props.event || "alert", props.severity || "moderate"].map((v) => String(v).toLowerCase());
    const scored = scoreOpportunity(category, tags, forecast, 62 + severityWeight / 2);
    const intent = clamp(scored.intentScore + severityWeight + urgencyWeight * 0.5);

    out.push({
      id: mkId(["nws", feature.id || props.headline || "alert"]),
      source: "weather",
      category,
      title: props.headline || props.event || "Weather alert",
      description: props.description || `Active weather alert for ${props.areaDesc || "your area"}.`,
      locationText: props.areaDesc || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      lat,
      lon,
      intentScore: intent,
      priorityLabel: priorityLabelForOpportunity({
        intentScore: intent,
        tags,
        title: props.headline || props.event || "Weather alert",
        description: props.description || `Active weather alert for ${props.areaDesc || "your area"}.`,
        reasonSummary: "NWS issued an active alert that historically increases inbound service requests.",
        raw: {
          provider: "NWS",
          id: feature.id,
          event: props.event,
          severity: props.severity,
          urgency: props.urgency,
          sent: props.sent
        }
      }),
      confidence: scored.confidence,
      tags,
      nextAction: suggestedNextAction(category, intent, props.areaDesc || "service area"),
      reasonSummary: "NWS issued an active alert that historically increases inbound service requests.",
      recommendedCreateMode: intent >= 78 ? "job" : "lead",
      recommendedScheduleIso: intent >= 72 ? suggestedSchedule(intent, 45) : null,
      raw: {
        provider: "NWS",
        id: feature.id,
        event: props.event,
        severity: props.severity,
        urgency: props.urgency,
        sent: props.sent
      },
      createdAtIso: new Date().toISOString()
    });
  }

  return out.slice(0, limit);
}

type UsgsResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      mag?: number;
      place?: string;
      title?: string;
      time?: number;
      tsunami?: number;
      alert?: string;
    };
    geometry?: {
      coordinates?: [number, number, number];
    };
  }>;
};

type EonetResponse = {
  events?: Array<{
    id?: string;
    title?: string;
    description?: string;
    categories?: Array<{ id?: string; title?: string }>;
    geometry?: Array<{ date?: string; coordinates?: [number, number] }>;
    sources?: Array<{ id?: string; url?: string }>;
  }>;
};

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetchUsgsOpportunities({
  lat,
  lon,
  radiusMiles,
  categories,
  forecast,
  limit
}: {
  lat: number;
  lon: number;
  radiusMiles: number;
  categories: ScannerCategory[];
  forecast?: ForecastSummary | null;
  limit: number;
}): Promise<ScannerOpportunity[]> {
  if (!categories.includes("restoration") && !categories.includes("general")) return [];

  const payload = await fetchJsonWithTimeout<UsgsResponse>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
    9000
  );
  if (!payload?.features?.length) return [];

  const limitMiles = Math.max(80, radiusMiles * 8);
  const out: ScannerOpportunity[] = [];

  for (const feature of payload.features) {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const eLon = Number(coords[0]);
    const eLat = Number(coords[1]);
    const dist = haversineMiles(lat, lon, eLat, eLon);
    if (dist > limitMiles) continue;

    const mag = Number(props.mag || 0);
    const tags = ["public_feed", "quake", mag >= 3 ? "infrastructure-risk" : "minor"];
    const scored = scoreOpportunity("restoration", tags, forecast, 52 + mag * 7);
    const intent = clamp(scored.intentScore + mag * 6 + (props.alert ? 10 : 0));

    out.push({
      id: mkId(["usgs", feature.id || String(props.time)]),
      source: "public_feed",
      category: "restoration",
      title: props.title || "Local seismic activity",
      description: `USGS event near service area (${Math.round(dist)} mi). Monitor for inspection and emergency requests.`,
      locationText: props.place || `${eLat.toFixed(3)}, ${eLon.toFixed(3)}`,
      lat: eLat,
      lon: eLon,
      intentScore: intent,
      priorityLabel: priorityLabelForOpportunity({
        intentScore: intent,
        tags,
        title: props.title || "Local seismic activity",
        description: `USGS event near service area (${Math.round(dist)} mi). Monitor for inspection and emergency requests.`,
        reasonSummary: "Public seismic feed indicates possible property impact and urgent inspection demand.",
        raw: {
          provider: "USGS",
          id: feature.id,
          magnitude: props.mag,
          tsunami: props.tsunami,
          alert: props.alert,
          time: props.time
        }
      }),
      confidence: scored.confidence,
      tags,
      nextAction: suggestedNextAction("restoration", intent, props.place || "local area"),
      reasonSummary: "Public seismic feed indicates possible property impact and urgent inspection demand.",
      recommendedCreateMode: intent >= 75 ? "job" : "lead",
      recommendedScheduleIso: intent >= 68 ? suggestedSchedule(intent, 60) : null,
      raw: {
        provider: "USGS",
        id: feature.id,
        magnitude: props.mag,
        tsunami: props.tsunami,
        alert: props.alert,
        time: props.time
      },
      createdAtIso: new Date().toISOString()
    });

    if (out.length >= limit) break;
  }

  return out;
}

function categoryFromEonet(categoryTitle: string): ScannerCategory {
  const value = categoryTitle.toLowerCase();
  if (value.includes("wildfire") || value.includes("storm") || value.includes("flood")) return "restoration";
  if (value.includes("landslide") || value.includes("severe storm")) return "demolition";
  if (value.includes("volcano") || value.includes("dust") || value.includes("smoke")) return "asbestos";
  return "general";
}

async function fetchEonetOpportunities({
  lat,
  lon,
  radiusMiles,
  categories,
  forecast,
  limit
}: {
  lat: number;
  lon: number;
  radiusMiles: number;
  categories: ScannerCategory[];
  forecast?: ForecastSummary | null;
  limit: number;
}): Promise<ScannerOpportunity[]> {
  const payload = await fetchJsonWithTimeout<EonetResponse>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50", 9000);
  if (!payload?.events?.length) return [];

  const radiusLimit = Math.max(120, radiusMiles * 10);
  const out: ScannerOpportunity[] = [];

  for (const event of payload.events) {
    const geo = event.geometry?.[event.geometry.length - 1];
    const coords = geo?.coordinates;
    if (!coords || coords.length < 2) continue;

    const eLon = Number(coords[0]);
    const eLat = Number(coords[1]);
    if (!Number.isFinite(eLat) || !Number.isFinite(eLon)) continue;

    const dist = haversineMiles(lat, lon, eLat, eLon);
    if (dist > radiusLimit) continue;

    const dominantCategory = categoryFromEonet(event.categories?.[0]?.title || "");
    if (!categories.includes(dominantCategory)) continue;

    const tags = [
      "public_feed",
      "nasa-eonet",
      String(event.categories?.[0]?.title || "environmental-event").toLowerCase()
    ];
    const scored = scoreOpportunity(dominantCategory, tags, forecast, 60);
    const recencyBoost = geo?.date && Date.now() - new Date(geo.date).getTime() <= 24 * 60 * 60 * 1000 ? 8 : 3;
    const proximityBoost = dist <= 30 ? 10 : dist <= 75 ? 6 : 3;
    const intent = clamp(scored.intentScore + recencyBoost + proximityBoost);

    out.push({
      id: mkId(["eonet", event.id || event.title || String(geo?.date || Date.now())]),
      source: "public_feed",
      category: dominantCategory,
      title: event.title || "Environmental incident",
      description:
        event.description || `NASA EONET reported an active environmental event about ${Math.round(dist)} mi from your service area.`,
      locationText: `${eLat.toFixed(3)}, ${eLon.toFixed(3)}`,
      lat: eLat,
      lon: eLon,
      intentScore: intent,
      priorityLabel: priorityLabelForOpportunity({
        intentScore: intent,
        tags,
        title: event.title || "Environmental incident",
        description: event.description || "NASA EONET environmental event.",
        reasonSummary: "NASA EONET shows an active incident near your market that can increase emergency inbound demand.",
        raw: {
          provider: "NASA_EONET",
          id: event.id,
          categories: event.categories,
          geometry_date: geo?.date,
          distance_miles: Math.round(dist),
          source_url: event.sources?.[0]?.url
        }
      }),
      confidence: scored.confidence,
      tags,
      nextAction: suggestedNextAction(dominantCategory, intent, `${Math.round(dist)} mi radius`),
      reasonSummary: "NASA EONET shows an active incident near your market that can increase emergency inbound demand.",
      recommendedCreateMode: intent >= 77 ? "job" : "lead",
      recommendedScheduleIso: intent >= 70 ? suggestedSchedule(intent, 60) : null,
      raw: {
        provider: "NASA_EONET",
        id: event.id,
        categories: event.categories,
        geometry_date: geo?.date,
        distance_miles: Math.round(dist),
        source_url: event.sources?.[0]?.url
      },
      createdAtIso: new Date().toISOString()
    });

    if (out.length >= limit) break;
  }

  return out;
}

export async function runScanner({
  mode,
  location,
  categories,
  limit,
  lat,
  lon,
  radius,
  campaignMode,
  triggers
}: {
  mode: ScannerMode;
  location: string;
  categories?: string[];
  limit?: number;
  lat?: number | null;
  lon?: number | null;
  radius?: number;
  campaignMode?: CampaignMode;
  triggers?: string[];
}) {
  const pickedCategories = normalizeCategories(categories);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const radiusMiles = Math.max(1, Math.min(250, Number(radius) || 25));

  let resolved = parseLatLon(location, lat ?? null, lon ?? null);
  if (!resolved && location.trim()) {
    const geo = await geocodeLocation(location.trim()).catch(() => null);
    if (geo) {
      resolved = { lat: geo.lat, lon: geo.lng, label: geo.label };
    }
  }

  let forecast: ForecastSummary | null = null;
  if (resolved) {
    forecast = await getForecastByLatLng(resolved.lat, resolved.lon).catch(() => null);
  }

  if (mode === "live" && resolved) {
    const [nws, usgs, eonet] = await Promise.all([
      fetchNwsOpportunities({
        lat: resolved.lat,
        lon: resolved.lon,
        categories: pickedCategories,
        forecast,
        limit: safeLimit
      }),
      fetchUsgsOpportunities({
        lat: resolved.lat,
        lon: resolved.lon,
        radiusMiles,
        categories: pickedCategories,
        forecast,
        limit: safeLimit
      }),
      fetchEonetOpportunities({
        lat: resolved.lat,
        lon: resolved.lon,
        radiusMiles,
        categories: pickedCategories,
        forecast,
        limit: safeLimit
      })
    ]);

    const merged = [...nws, ...usgs, ...eonet]
      .sort((a, b) => b.intentScore - a.intentScore)
      .slice(0, safeLimit);

    if (merged.length > 0) {
      return {
        mode,
        weatherRisk: weatherRisk(forecast),
        opportunities: merged,
        locationResolved: resolved
      };
    }
  }

  const opportunities = createDemoOpportunities({
    location: resolved?.label || location || "Service Area",
    categories: pickedCategories,
    forecast,
    limit: safeLimit,
    campaignMode,
    triggers
  });

  return {
    mode: "demo" as ScannerMode,
    weatherRisk: weatherRisk(forecast),
    opportunities,
    locationResolved: resolved
  };
}

export async function fetchGooglePlacesLeads({
  location,
  service,
  radius,
  triggers,
  campaignMode
}: {
  location: string;
  service: string;
  radius: number;
  triggers: string[];
  campaignMode: CampaignMode;
}): Promise<ScannerLead[]> {
  const run = await runScanner({
    mode: "demo",
    location,
    categories: [toCategory(service)],
    limit: Math.max(8, Math.min(20, radius > 25 ? 20 : 12)),
    campaignMode,
    triggers
  });
  return run.opportunities.map(toLeadFromOpportunity);
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
  const category = toCategory(service);
  const opportunities = createDemoOpportunities({
    location,
    categories: [category],
    forecast,
    limit: Math.max(8, Math.min(20, radius > 25 ? 20 : 12)),
    campaignMode,
    triggers
  });

  return opportunities.map(toLeadFromOpportunity);
}

export function opportunityToLeadPayload(opportunity: ScannerOpportunity) {
  const leadLike = toLeadFromOpportunity(opportunity);
  return {
    name: leadLike.name,
    phone: leadLike.phone,
    service_type: leadLike.service_type,
    city: leadLike.city,
    state: leadLike.state,
    postal_code: leadLike.postal,
    requested_timeframe: leadLike.urgency === "high" ? "ASAP" : leadLike.urgency === "medium" ? "Today" : "This week",
    source: "import",
    notes: `Scanner ${opportunity.source}: ${opportunity.reasonSummary}`
  };
}
