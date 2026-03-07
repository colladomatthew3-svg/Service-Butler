import { cookies } from "next/headers";
import type { EnrichmentRecord } from "@/lib/services/enrichment";
import { generateSignals } from "@/lib/services/intent-engine";
import { opportunityToLeadPayload, type ScannerOpportunity } from "@/lib/services/scanner";

const DEMO_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const WEATHER_COOKIE = "sb_demo_weather";

type DemoWeatherSettings = {
  weather_location_label: string;
  weather_lat: number;
  weather_lng: number;
  home_base_city: string | null;
  home_base_state: string | null;
  home_base_postal_code: string | null;
};

type DemoScannerEvent = {
  id: string;
  source: string;
  category: string;
  title: string;
  description: string;
  location_text: string;
  lat: number | null;
  lon: number | null;
  intent_score: number;
  confidence: number;
  tags: string[];
  raw: Record<string, unknown>;
  created_at: string;
};

type DemoRoutingRule = {
  id: string;
  account_id: string;
  category: string;
  default_assignee: string | null;
  default_create_mode: "lead" | "job";
  default_job_value_cents: number;
  default_sla_minutes: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type DemoLead = {
  id: string;
  created_at: string;
  status: string;
  stage: string;
  name: string;
  phone: string;
  service_type: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  requested_timeframe: string;
  source: string;
  notes: string;
  scheduled_for: string | null;
  converted_job_id: string | null;
  intentScore: number;
  signalCount: number;
  enrichment?: EnrichmentRecord | null;
};

type DemoJob = {
  id: string;
  customer_name: string;
  service_type: string;
  pipeline_status: string;
  scheduled_for: string | null;
  estimated_value: number;
  city: string;
  state: string;
  intent_score: number;
  lead_id: string | null;
};

type DemoOpportunity = {
  id: string;
  category: string;
  title: string;
  location_text: string;
  intent_score: number;
  confidence: number;
  created_at: string;
  status: string;
};

type DemoStore = {
  routingRules: DemoRoutingRule[];
  scannerEvents: DemoScannerEvent[];
  opportunities: DemoOpportunity[];
  leads: DemoLead[];
  jobs: DemoJob[];
};

const DEFAULT_WEATHER: DemoWeatherSettings = {
  weather_location_label: "Brentwood, NY 11717",
  weather_lat: 40.7812,
  weather_lng: -73.2462,
  home_base_city: "Brentwood",
  home_base_state: "NY",
  home_base_postal_code: "11717"
};

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string, seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${Math.abs(hash >>> 0).toString(16)}`;
}

function initialRoutingRules(): DemoRoutingRule[] {
  const createdAt = nowIso();
  return [
    {
      id: "rule-restoration",
      account_id: DEMO_ACCOUNT_ID,
      category: "restoration",
      default_assignee: "Storm Desk",
      default_create_mode: "job",
      default_job_value_cents: 95000,
      default_sla_minutes: 45,
      enabled: true,
      created_at: createdAt,
      updated_at: createdAt
    },
    {
      id: "rule-plumbing",
      account_id: DEMO_ACCOUNT_ID,
      category: "plumbing",
      default_assignee: "Dispatch Queue",
      default_create_mode: "lead",
      default_job_value_cents: 65000,
      default_sla_minutes: 60,
      enabled: true,
      created_at: createdAt,
      updated_at: createdAt
    },
    {
      id: "rule-demolition",
      account_id: DEMO_ACCOUNT_ID,
      category: "demolition",
      default_assignee: "Mitigation Crew",
      default_create_mode: "job",
      default_job_value_cents: 120000,
      default_sla_minutes: 90,
      enabled: true,
      created_at: createdAt,
      updated_at: createdAt
    }
  ];
}

function initialLeads(): DemoLead[] {
  return [
    {
      id: "lead-demo-1",
      created_at: nowIso(),
      status: "new",
      stage: "NEW",
      name: "Sarah Parker",
      phone: "+1 631-555-0142",
      service_type: "Restoration",
      address: "18 Oak Lane",
      city: "Brentwood",
      state: "NY",
      postal_code: "11717",
      requested_timeframe: "ASAP",
      source: "scanner",
      notes: "Recent water intrusion signal after overnight rain.",
      scheduled_for: null,
      converted_job_id: null,
      intentScore: 84,
      signalCount: 4,
      enrichment: null
    },
    {
      id: "lead-demo-2",
      created_at: nowIso(),
      status: "contacted",
      stage: "CONTACTED",
      name: "Miguel Brooks",
      phone: "+1 631-555-0188",
      service_type: "Plumbing",
      address: "204 Pine Street",
      city: "Bay Shore",
      state: "NY",
      postal_code: "11706",
      requested_timeframe: "Today",
      source: "import",
      notes: "Basement pump issue reported during heavy rain band.",
      scheduled_for: null,
      converted_job_id: null,
      intentScore: 71,
      signalCount: 3,
      enrichment: null
    }
  ];
}

function initialJobs(): DemoJob[] {
  const scheduled = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: "job-demo-1",
      customer_name: "Chris Bennett",
      service_type: "Restoration",
      pipeline_status: "SCHEDULED",
      scheduled_for: scheduled,
      estimated_value: 4200,
      city: "Brentwood",
      state: "NY",
      intent_score: 82,
      lead_id: "lead-demo-1"
    }
  ];
}

function initialStore(): DemoStore {
  return {
    routingRules: initialRoutingRules(),
    scannerEvents: [],
    opportunities: [],
    leads: initialLeads(),
    jobs: initialJobs()
  };
}

declare global {
  var __serviceButlerDemoStore: DemoStore | undefined;
}

function getStore(): DemoStore {
  if (!globalThis.__serviceButlerDemoStore) {
    globalThis.__serviceButlerDemoStore = initialStore();
  }
  return globalThis.__serviceButlerDemoStore;
}

export function getDemoAccountContext() {
  return {
    accountId: DEMO_ACCOUNT_ID,
    userId: DEMO_USER_ID,
    email: "owner@servicebutler.local"
  };
}

export async function getDemoWeatherSettings() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(WEATHER_COOKIE)?.value;
  if (!raw) return DEFAULT_WEATHER;

  try {
    const parsed = JSON.parse(raw) as Partial<DemoWeatherSettings>;
    if (typeof parsed.weather_location_label !== "string") return DEFAULT_WEATHER;
    if (!Number.isFinite(parsed.weather_lat) || !Number.isFinite(parsed.weather_lng)) return DEFAULT_WEATHER;
    return {
      weather_location_label: parsed.weather_location_label,
      weather_lat: Number(parsed.weather_lat),
      weather_lng: Number(parsed.weather_lng),
      home_base_city: parsed.home_base_city ?? null,
      home_base_state: parsed.home_base_state ?? null,
      home_base_postal_code: parsed.home_base_postal_code ?? null
    };
  } catch {
    return DEFAULT_WEATHER;
  }
}

export function createDemoWeatherCookieValue(settings: DemoWeatherSettings) {
  return JSON.stringify(settings);
}

export function listDemoRoutingRules() {
  return [...getStore().routingRules].sort((a, b) => a.category.localeCompare(b.category));
}

export function upsertDemoRoutingRule(input: Omit<DemoRoutingRule, "id" | "created_at" | "updated_at" | "account_id">) {
  const store = getStore();
  const existing = store.routingRules.find((rule) => rule.category === input.category);
  const timestamp = nowIso();

  if (existing) {
    Object.assign(existing, input, { updated_at: timestamp });
    return existing;
  }

  const rule: DemoRoutingRule = {
    ...input,
    id: generateId("rule", input.category),
    account_id: DEMO_ACCOUNT_ID,
    created_at: timestamp,
    updated_at: timestamp
  };
  store.routingRules.push(rule);
  return rule;
}

export function patchDemoRoutingRule(id: string, patch: Partial<Omit<DemoRoutingRule, "id" | "account_id" | "created_at" | "updated_at">>) {
  const store = getStore();
  const rule = store.routingRules.find((item) => item.id === id);
  if (!rule) return null;
  Object.assign(rule, patch, { updated_at: nowIso() });
  return rule;
}

export function deleteDemoRoutingRule(id: string) {
  const store = getStore();
  const next = store.routingRules.filter((rule) => rule.id !== id);
  const deleted = next.length !== store.routingRules.length;
  store.routingRules = next;
  return deleted;
}

export function addDemoScannerEvents(opportunities: ScannerOpportunity[]) {
  const store = getStore();
  const createdAt = nowIso();
  const events: DemoScannerEvent[] = opportunities.map((opportunity) => ({
    id: opportunity.id,
    source: opportunity.source,
    category: opportunity.category,
    title: opportunity.title,
    description: opportunity.description,
    location_text: opportunity.locationText,
    lat: opportunity.lat,
    lon: opportunity.lon,
    intent_score: opportunity.intentScore,
    confidence: opportunity.confidence,
    tags: opportunity.tags,
    raw: {
      ...opportunity.raw,
      next_action: opportunity.nextAction,
      reason_summary: opportunity.reasonSummary,
      recommended_create_mode: opportunity.recommendedCreateMode,
      recommended_schedule_iso: opportunity.recommendedScheduleIso
    },
    created_at: opportunity.createdAtIso || createdAt
  }));

  store.scannerEvents = [...events, ...store.scannerEvents].slice(0, 120);
  for (const opportunity of opportunities) {
    if (!store.opportunities.some((item) => item.id === opportunity.id)) {
      store.opportunities.unshift({
        id: opportunity.id,
        category: opportunity.category,
        title: opportunity.title,
        location_text: opportunity.locationText,
        intent_score: opportunity.intentScore,
        confidence: opportunity.confidence,
        created_at: opportunity.createdAtIso || createdAt,
        status: "new"
      });
    }
  }
  store.opportunities = store.opportunities.slice(0, 120);
  return events;
}

export function listDemoScannerEvents({
  source,
  category,
  limit,
  query
}: {
  source?: string | null;
  category?: string | null;
  limit?: number;
  query?: string;
}) {
  const q = String(query || "").trim().toLowerCase();
  const items = getStore().scannerEvents.filter((event) => {
    if (source && source !== "all" && event.source !== source) return false;
    if (category && category !== "all" && event.category !== category) return false;
    if (!q) return true;
    const haystack = `${event.title} ${event.description} ${event.location_text}`.toLowerCase();
    return haystack.includes(q);
  });
  return items.slice(0, limit || 50);
}

export function getDemoDashboardSnapshot() {
  const store = getStore();
  const leads = [...store.leads];
  const jobs = [...store.jobs];
  const opportunities = [...store.opportunities];
  return { leads, jobs, opportunities };
}

export function listDemoLeads({
  status,
  service,
  search
}: {
  status?: string | null;
  service?: string | null;
  search?: string | null;
}) {
  const q = String(search || "").trim().toLowerCase();
  const leads = [...getStore().leads]
    .filter((lead) => {
      if (status && status !== "all" && lead.status !== status) return false;
      if (service && service !== "all" && lead.service_type !== service) return false;
      if (!q) return true;
      const haystack = `${lead.name} ${lead.phone} ${lead.address} ${lead.city} ${lead.state}`.toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const enriched = leads.map((lead) => ({
    ...lead,
    intentScore: lead.intentScore ?? 0,
    signalCount: lead.signalCount ?? getDemoLeadSignals(lead.id).length
  }));

  const counts = enriched.reduce<Record<string, number>>((acc, lead) => {
    const key = String(lead.status || "new");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return { leads: enriched, counts };
}

export function createDemoLead(input: {
  name: string;
  phone: string;
  service_type: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  requested_timeframe?: string | null;
  source?: string | null;
  notes?: string | null;
}) {
  const store = getStore();
  const leadId = generateId("lead", `${input.name}:${input.phone}:${input.address || input.city || nowIso()}`);
  const leadSignals = generateSignals({
    lead: {
      id: leadId,
      service_type: input.service_type.trim(),
      requested_timeframe: input.requested_timeframe?.trim() || "ASAP",
      city: input.city?.trim() || "",
      state: input.state?.trim() || ""
    }
  });

  const lead: DemoLead = {
    id: leadId,
    created_at: nowIso(),
    status: "new",
    stage: "NEW",
    name: input.name.trim(),
    phone: input.phone.trim(),
    service_type: input.service_type.trim(),
    address: input.address?.trim() || "",
    city: input.city?.trim() || "",
    state: input.state?.trim() || "",
    postal_code: input.postal_code?.trim() || "",
    requested_timeframe: input.requested_timeframe?.trim() || "ASAP",
    source: input.source?.trim() || "manual",
    notes: input.notes?.trim() || "",
    scheduled_for: null,
    converted_job_id: null,
    intentScore: leadSignals.length ? Math.round(leadSignals.reduce((sum, signal) => sum + Number(signal.score || 0), 0) / leadSignals.length) : 0,
    signalCount: leadSignals.length,
    enrichment: null
  };
  store.leads.unshift(lead);
  return lead;
}

export function getDemoLead(id: string) {
  return getStore().leads.find((lead) => lead.id === id) || null;
}

export function getFirstDemoLeadId() {
  return getStore().leads[0]?.id || null;
}

export function getDemoJob(id: string) {
  return getStore().jobs.find((job) => job.id === id) || null;
}

export function getDemoLeadSignals(id: string) {
  const lead = getDemoLead(id);
  if (!lead) return [];

  return generateSignals({
    lead: {
      id: lead.id,
      service_type: lead.service_type,
      requested_timeframe: lead.requested_timeframe,
      city: lead.city,
      state: lead.state
    }
  }).map((signal, index) => ({
    id: `${lead.id}-signal-${index + 1}`,
    created_at: nowIso(),
    ...signal
  }));
}

export function updateDemoLead(
  id: string,
  patch: Partial<Pick<DemoLead, "status" | "notes" | "scheduled_for" | "converted_job_id" | "stage">>
) {
  const lead = getStore().leads.find((item) => item.id === id);
  if (!lead) return null;
  Object.assign(lead, patch);
  return lead;
}

export function convertDemoLeadToJob(id: string) {
  const store = getStore();
  const lead = store.leads.find((item) => item.id === id);
  if (!lead) return null;

  if (lead.converted_job_id) {
    return { jobId: lead.converted_job_id, created: false };
  }

  const existing = store.jobs.find((job) => job.lead_id === id);
  if (existing) {
    lead.converted_job_id = existing.id;
    lead.status = "scheduled";
    lead.stage = "BOOKED";
    lead.scheduled_for = existing.scheduled_for;
    return { jobId: existing.id, created: false };
  }

  const scheduledFor =
    lead.requested_timeframe?.toLowerCase().includes("today")
      ? new Date(new Date().setHours(14, 0, 0, 0)).toISOString()
      : lead.requested_timeframe?.toLowerCase().includes("tomorrow")
        ? new Date(new Date().setDate(new Date().getDate() + 1)).toISOString()
        : new Date(Date.now() + 90 * 60_000).toISOString();

  const scores = getDemoLeadSignals(id).map((signal) => Number(signal.score) || 0);
  const intent = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : lead.intentScore;
  const jobId = generateId("job", `${id}:converted`);

  store.jobs.unshift({
    id: jobId,
    customer_name: lead.name,
    service_type: lead.service_type,
    pipeline_status: "NEW",
    scheduled_for: scheduledFor,
    estimated_value: 0,
    city: lead.city,
    state: lead.state,
    intent_score: intent,
    lead_id: lead.id
  });

  lead.converted_job_id = jobId;
  lead.status = "scheduled";
  lead.stage = "BOOKED";
  lead.scheduled_for = scheduledFor;

  return { jobId, created: true };
}

export function dispatchDemoScannerEvent(id: string, createMode?: "lead" | "job") {
  const store = getStore();
  const event = store.scannerEvents.find((item) => item.id === id);
  if (!event) return null;

  const rule = store.routingRules.find((item) => item.category === event.category && item.enabled);
  const mode = createMode || rule?.default_create_mode || (event.intent_score >= 76 ? "job" : "lead");
  const leadPayload = opportunityToLeadPayload({
    id: event.id,
    source: event.source as ScannerOpportunity["source"],
    category: event.category as ScannerOpportunity["category"],
    title: event.title,
    description: event.description,
    locationText: event.location_text,
    lat: event.lat,
    lon: event.lon,
    intentScore: event.intent_score,
    priorityLabel: event.intent_score >= 82 ? "Call now" : event.intent_score >= 68 ? "Follow up" : "Schedule later",
    confidence: event.confidence,
    tags: event.tags,
    nextAction: String(event.raw.next_action || "Call within SLA."),
    reasonSummary: String(event.raw.reason_summary || "Weather and service signals matched."),
    recommendedCreateMode: mode,
    recommendedScheduleIso: typeof event.raw.recommended_schedule_iso === "string" ? event.raw.recommended_schedule_iso : null,
    raw: event.raw,
    createdAtIso: event.created_at
  });

  const leadId = generateId("lead", `${id}:${mode}`);
  const lead: DemoLead = {
    id: leadId,
    created_at: nowIso(),
    status: mode === "job" ? "scheduled" : "new",
    stage: mode === "job" ? "BOOKED" : "NEW",
    name: leadPayload.name,
    phone: leadPayload.phone,
    service_type: leadPayload.service_type,
    address: "",
    city: leadPayload.city,
    state: leadPayload.state,
    postal_code: leadPayload.postal_code,
    requested_timeframe: leadPayload.requested_timeframe,
    source: "scanner",
    notes: leadPayload.notes || "",
    scheduled_for: null,
    converted_job_id: null,
    intentScore: event.intent_score,
    signalCount: event.tags.length,
    enrichment: (event.raw.enrichment as EnrichmentRecord | undefined) || null
  };
  store.leads.unshift(lead);

  let jobId: string | null = null;
  if (mode === "job") {
    jobId = generateId("job", `${id}:${mode}`);
    const scheduleIso =
      (typeof event.raw.recommended_schedule_iso === "string" && event.raw.recommended_schedule_iso) ||
      new Date(Date.now() + (rule?.default_sla_minutes || 60) * 60_000).toISOString();

    const job: DemoJob = {
      id: jobId,
      customer_name: lead.name,
      service_type: lead.service_type,
      pipeline_status: "SCHEDULED",
      scheduled_for: scheduleIso,
      estimated_value: Math.round((rule?.default_job_value_cents || 65000) / 100),
      city: lead.city,
      state: lead.state,
      intent_score: event.intent_score,
      lead_id: lead.id
    };
    lead.status = "scheduled";
    lead.stage = "BOOKED";
    lead.scheduled_for = scheduleIso;
    lead.converted_job_id = job.id;
    store.jobs.unshift(job);
  }

  store.opportunities = store.opportunities.map((item) => (item.id === id ? { ...item, status: "claimed" } : item));

  return {
    mode,
    leadId,
    jobId,
    message:
      mode === "job"
        ? "Signal detected, opportunity converted, and inspection scheduled in the demo flow."
        : "Signal detected, opportunity surfaced, and lead created in the demo inbox."
  };
}
