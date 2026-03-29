"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Radar, MapPin, Eye, Plus, BriefcaseBusiness, Loader2, Wrench, X, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/services/review-mode";
import type { EnrichmentRecord } from "@/lib/services/enrichment";

type Mode = "demo" | "live";
type Category = "plumbing" | "demolition" | "asbestos" | "restoration" | "general";
type Tab = "feed" | "rules";
type CampaignMode = "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";
type Trigger = "storm" | "heavy-rain" | "freeze" | "high-wind";

type ScannerEvent = {
  id: string;
  source: string;
  category: Category;
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

type RoutingRule = {
  id: string;
  category: Category;
  default_assignee: string | null;
  default_create_mode: "lead" | "job";
  default_job_value_cents: number;
  default_sla_minutes: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const categories: Category[] = ["restoration", "plumbing", "demolition", "asbestos", "general"];
const triggerOptions: Array<{ id: Trigger; label: string }> = [
  { id: "storm", label: "Storm" },
  { id: "heavy-rain", label: "Heavy Rain" },
  { id: "freeze", label: "Freeze" },
  { id: "high-wind", label: "High Wind" }
];

const categoryLabel: Record<Category, string> = {
  plumbing: "Plumbing",
  demolition: "Demolition",
  asbestos: "Asbestos",
  restoration: "Restoration",
  general: "General"
};

const campaignOptions: Array<{
  value: CampaignMode;
  label: string;
  helper: string;
  categories: Category[];
  triggers: Trigger[];
}> = [
  {
    value: "Storm Response",
    label: "Storm Damage / Restoration",
    helper: "Roof damage, wind loss, emergency tarping, water intrusion.",
    categories: ["restoration"],
    triggers: ["storm", "heavy-rain", "high-wind"]
  },
  {
    value: "Roofing",
    label: "Roof Leaks / Roofing",
    helper: "Shingles, leak calls, storm inspection demand.",
    categories: ["restoration", "general"],
    triggers: ["storm", "heavy-rain", "high-wind"]
  },
  {
    value: "Water Damage",
    label: "Freeze / Pipe Burst",
    helper: "Burst pipes, flooding, water extraction, mitigation.",
    categories: ["plumbing", "restoration"],
    triggers: ["freeze", "heavy-rain"]
  },
  {
    value: "HVAC Emergency",
    label: "HVAC Failure",
    helper: "No-cool, no-heat, outage-driven comfort calls.",
    categories: ["general"],
    triggers: ["high-wind", "freeze"]
  }
];

const marketPresets = [
  { label: "Brentwood, NY", value: "Brentwood, NY 11717" },
  { label: "Bay Shore, NY", value: "Bay Shore, NY 11706" },
  { label: "Patchogue, NY", value: "Patchogue, NY 11772" },
  { label: "Hauppauge, NY", value: "Hauppauge, NY 11788" },
  { label: "Tampa, FL", value: "Tampa, FL 33602" }
] as const;

function ScannerMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[1.1rem] border border-semantic-border/60 bg-white/74 px-4 py-3 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-semantic-text">{value}</p>
      <p className="mt-1 text-xs text-semantic-muted">{helper}</p>
    </div>
  );
}

export function LeadScannerView({ initialTab = "feed" }: { initialTab?: Tab }) {
  const [mode] = useState<Mode>(isDemoMode() ? "demo" : "live");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [location, setLocation] = useState("Hauppauge, NY 11788");
  const [campaignMode, setCampaignMode] = useState<CampaignMode>("Storm Response");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radius, setRadius] = useState("25");
  const [limit, setLimit] = useState("20");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([...categories]);
  const [selectedTriggers, setSelectedTriggers] = useState<Trigger[]>(["storm", "heavy-rain"]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [preview, setPreview] = useState<ScannerEvent | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [demoActionMessage, setDemoActionMessage] = useState<string | null>(null);

  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    category: "general" as Category,
    default_assignee: "Dispatch Queue",
    default_create_mode: "lead" as "lead" | "job",
    default_job_value_cents: "60000",
    default_sla_minutes: "60",
    enabled: true
  });

  const [, setCaptured] = useState<ScannerEvent[]>([]);

  const { showToast } = useToast();

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events]
  );

  const testRule = useMemo(() => {
    const pick = selectedCategories[0] || "general";
    return rules.find((rule) => rule.category === pick && rule.enabled) || null;
  }, [rules, selectedCategories]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/scanner/events?limit=100");
    const data = (await res.json().catch(() => ({}))) as { events?: ScannerEvent[]; error?: string };
    if (!res.ok) {
      showToast(data.error || "Could not load scanner feed");
      return;
    }
    setEvents(data.events || []);
  }, [showToast]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    const res = await fetch("/api/routing-rules");
    const data = (await res.json().catch(() => ({}))) as { rules?: RoutingRule[]; error?: string };
    if (!res.ok) {
      showToast(data.error || "Could not load routing rules");
      setRulesLoading(false);
      return;
    }
    setRules(data.rules || []);
    setRulesLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadEvents();
    loadRules();
  }, [loadEvents, loadRules]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeatherDefaults() {
      const res = await fetch("/api/settings/weather");
      const data = (await res.json().catch(() => ({}))) as {
        weather_location_label?: string | null;
        weather_lat?: number | null;
        weather_lng?: number | null;
      };

      if (!res.ok || cancelled) return;

      setLocation((prev) => prev || data.weather_location_label || "11788");
      setLat((prev) => prev || (data.weather_lat != null ? String(data.weather_lat) : ""));
      setLon((prev) => prev || (data.weather_lng != null ? String(data.weather_lng) : ""));
    }

    loadWeatherDefaults();
    return () => {
      cancelled = true;
    };
  }, []);

  function parseNum(value: string) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async function runScan(manual = true) {
    setLoading(true);
    const res = await fetch("/api/scanner/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        location,
        campaignMode,
        categories: selectedCategories,
        triggers: selectedTriggers,
        limit: Number(limit) || 20,
        radius: Number(radius) || 25,
        lat: parseNum(lat),
        lon: parseNum(lon)
      })
    });

    const data = (await res.json().catch(() => ({}))) as {
      opportunities?: Array<{
        id: string;
        source: string;
        category: Category;
        title: string;
        description: string;
        locationText: string;
        lat: number | null;
        lon: number | null;
        intentScore: number;
        confidence: number;
        tags: string[];
        raw: Record<string, unknown>;
      }>;
      weatherRisk?: { label?: string };
      mode?: Mode;
      error?: string;
    };

    if (!res.ok) {
      setLoading(false);
      showToast(data.error || "Scanner run failed");
      return;
    }

    const batch: ScannerEvent[] = (data.opportunities || []).map((op) => ({
      id: op.id,
      source: op.source,
      category: op.category,
      title: op.title,
      description: op.description,
      location_text: op.locationText,
      lat: op.lat,
      lon: op.lon,
      intent_score: op.intentScore,
      confidence: op.confidence,
      tags: op.tags,
      raw: op.raw,
      created_at: new Date().toISOString()
    }));

    setCaptured((prev) => {
      const merged = [...batch, ...prev];
      const seen = new Set<string>();
      return merged.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    });

    await loadEvents();
    setLoading(false);

    if (manual) {
      const risk = data.weatherRisk?.label ? ` · ${data.weatherRisk.label}` : "";
      showToast(`Scanner captured ${batch.length} opportunities${risk}`);
    }
  }

  async function dispatchEvent(event: ScannerEvent, createMode?: "lead" | "job", assignee?: string) {
    setDispatchingId(event.id);
    const res = await fetch(`/api/scanner/events/${event.id}/dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(createMode ? { createMode } : {}),
        ...(assignee ? { assignee } : {})
      })
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      mode?: "lead" | "job";
      leadId?: string;
      jobId?: string;
      message?: string;
      redirectPath?: string;
    };
    setDispatchingId(null);

    if (!res.ok) {
      showToast(data.error || "Dispatch failed");
      return;
    }

    if (isDemoMode()) {
      setDemoActionMessage(data.message || "Opportunity routed in demo mode.");
      showToast(data.message || "Opportunity routed");
      return;
    }

    if (data.mode === "job" && data.jobId) {
      showToast("Scheduled job created");
      window.location.href = `/dashboard/jobs/${data.jobId}`;
      return;
    }

    if (data.leadId) {
      showToast("Lead created in inbox");
      window.location.href = `/dashboard/leads/${data.leadId}`;
      return;
    }

    showToast("Dispatched");
  }

  async function saveRule() {
    const payload = {
      category: ruleForm.category,
      default_assignee: ruleForm.default_assignee,
      default_create_mode: ruleForm.default_create_mode,
      default_job_value_cents: Number(ruleForm.default_job_value_cents) || 0,
      default_sla_minutes: Number(ruleForm.default_sla_minutes) || 60,
      enabled: ruleForm.enabled
    };

    const url = editing ? `/api/routing-rules/${editing.id}` : "/api/routing-rules";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      showToast(data.error || "Could not save rule");
      return;
    }

    showToast(editing ? "Rule updated" : "Rule created");
    setEditing(null);
    setRuleForm({
      category: "general",
      default_assignee: "Dispatch Queue",
      default_create_mode: "lead",
      default_job_value_cents: "60000",
      default_sla_minutes: "60",
      enabled: true
    });
    await loadRules();
  }

  async function deleteRule(ruleId: string) {
    const res = await fetch(`/api/routing-rules/${ruleId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not delete rule");
      return;
    }
    showToast("Rule deleted");
    await loadRules();
  }

  function openEdit(rule: RoutingRule) {
    setEditing(rule);
    setRuleForm({
      category: rule.category,
      default_assignee: rule.default_assignee || "",
      default_create_mode: rule.default_create_mode,
      default_job_value_cents: String(rule.default_job_value_cents),
      default_sla_minutes: String(rule.default_sla_minutes),
      enabled: rule.enabled
    });
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Radar }> = [
    { id: "feed", label: "Leads", icon: Radar },
    { id: "rules", label: "Routing", icon: Settings2 }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunity Scanner"
        subtitle="Pick your market, scan for jobs, and work the best calls first."
      />

      <section className="overflow-hidden rounded-[2.1rem] border border-brand-500/24 bg-[linear-gradient(120deg,rgba(216,239,229,0.94),rgba(255,255,255,0.97))] shadow-[0_24px_64px_rgba(25,112,77,0.12)]">
        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1.25fr_0.95fr] lg:px-6">
          <div className="space-y-4">
            <p className="inline-flex items-center rounded-full border border-brand-500/25 bg-white/72 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Lead Engine Flow
            </p>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-semantic-text sm:text-3xl">Rank the market, surface the job, and hand off only the calls worth making.</h2>
              <p className="max-w-2xl text-sm text-semantic-text sm:text-base">
                Scanner prioritizes contactable opportunities first. Signals are ranked, verified, and routed so your team spends time on real bookable jobs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setTab("feed")}>
                Signal Feed
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setTab("rules")}>
                Routing Rules
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <ScannerMetric label="Active market" value={location} helper="Target geography" />
            <ScannerMetric label="Signals" value={`${selectedTriggers.length} enabled`} helper="Signal filters on" />
            <ScannerMetric label="Radius" value={`${radius} miles`} helper="Coverage window" />
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-semantic-border/55 bg-white/62 shadow-[0_16px_42px_rgba(31,42,36,0.06)]">
        <CardBody className="space-y-5 p-5 sm:p-6">
          {demoActionMessage && (
            <div className="rounded-[1.1rem] border border-brand-500/20 bg-brand-50/70 px-4 py-3 text-sm font-medium text-brand-700">
              {demoActionMessage}
            </div>
          )}

          <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_120px_160px]">
            <div className="rounded-[1.35rem] border border-semantic-border/60 bg-white/78 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Market</p>
              <Input
                data-testid="scanner-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, state, or ZIP"
              />
            </div>

            <div className="rounded-[1.35rem] border border-semantic-border/60 bg-white/78 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Job Type</p>
              <Select
                value={campaignMode}
                onChange={(e) => {
                  const next = e.target.value as CampaignMode;
                  const preset = campaignOptions.find((option) => option.value === next);
                  setCampaignMode(next);
                  if (preset) {
                    setSelectedCategories(preset.categories);
                    setSelectedTriggers(preset.triggers);
                  }
                }}
              >
                {campaignOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-[1.35rem] border border-semantic-border/60 bg-white/78 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Radius (mi)</p>
              <Select data-testid="scanner-radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
                {["5", "10", "25", "50", "100"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            </div>

            <div className="self-end rounded-[1.35rem] border border-semantic-border/60 bg-white/78 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)] xl:col-span-1">
              <Button data-testid="scanner-run" onClick={() => runScan(true)} disabled={loading} fullWidth>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Scan Now
              </Button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto rounded-[1.25rem] border border-semantic-border/60 bg-white/68 px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {marketPresets.map((market) => (
              <Button
                key={market.value}
                size="sm"
                variant={location === market.value ? "primary" : "secondary"}
                className="shrink-0"
                onClick={() => setLocation(market.value)}
              >
                {market.label}
              </Button>
            ))}
          </div>

          <div className="rounded-[1.25rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(241,245,240,0.8))] p-4">
            <p className="text-sm font-semibold text-semantic-text">
              {campaignOptions.find((option) => option.value === campaignMode)?.helper}
            </p>
            <p className="mt-1 text-sm text-semantic-muted">We use your saved service area first so the jobs stay close to where your crews actually work.</p>
          </div>

          <details className="rounded-[1.25rem] border border-semantic-border/60 bg-white/68 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-semantic-text">More scan options</summary>
            <p className="mt-2 text-sm text-semantic-muted">Use these only if you need to fine-tune the scan.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px]">
              <label className="rounded-[1rem] border border-semantic-border/55 bg-white/74 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Signals</span>
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible md:pb-0">
                  {triggerOptions.map((trigger) => {
                    const active = selectedTriggers.includes(trigger.id);
                    return (
                      <button
                        key={trigger.id}
                        type="button"
                        data-testid={`scanner-trigger-${trigger.id}`}
                        onClick={() =>
                          setSelectedTriggers((prev) =>
                            prev.includes(trigger.id) ? prev.filter((item) => item !== trigger.id) : [...prev, trigger.id]
                          )
                        }
                        className={cn(
                          "min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold",
                          active ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
                        )}
                      >
                        {trigger.label}
                      </button>
                    );
                  })}
                </div>
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-[1rem] border border-semantic-border/55 bg-white/74 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Lat</p>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.7812" />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Lon</p>
                  <Input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-73.2462" />
                </div>
              </div>
              <label className="rounded-[1rem] border border-semantic-border/55 bg-white/74 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Results</span>
                <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
                  {["8", "12", "20", "30", "50"].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </Select>
              </label>
            </div>
          </details>
        </CardBody>
      </Card>

      {tabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[0.95rem] px-4 text-sm font-semibold",
                  tab === item.id
                    ? "bg-semantic-brand text-white shadow-[0_10px_24px_rgba(25,112,77,0.18)]"
                    : "bg-semantic-surface2/80 text-semantic-muted ring-1 ring-inset ring-semantic-border hover:bg-semantic-surface"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {tab === "feed" && (
        <section className="space-y-4">
          {!loading && sortedEvents.length > 0 && (
            <div className="rounded-[1rem] border border-semantic-border/60 bg-white/70 px-4 py-3 text-sm text-semantic-text">
              <span className="font-semibold">{sortedEvents.length} jobs found.</span> Start with the closest high-urgency calls and book the inspection.
            </div>
          )}

          {loading && (
            <Card className="border-semantic-border/55 bg-white/58">
              <CardBody className="space-y-3">
                <p className="text-sm font-semibold text-semantic-text">Scanning live signals and local incident pressure...</p>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardBody>
            </Card>
          )}

          {!loading && sortedEvents.length === 0 && (
            <Card className="border-semantic-border/55 bg-white/58">
              <CardBody className="py-12 text-center">
                <Radar className="mx-auto h-10 w-10 text-brand-700" />
                <p className="mt-3 text-lg font-semibold text-semantic-text">Scanner is listening</p>
                <p className="mt-1 text-sm text-semantic-muted">
                  Run a scan to surface storm damage, water loss, freeze risk, and emergency service demand in your service area.
                </p>
              </CardBody>
            </Card>
          )}

          {sortedEvents.map((event) => {
            const nextAction = String(event.raw?.next_action || event.raw?.recommended_action || "Dispatch within SLA and send first contact.");
            const reasonDetails = getOpportunityReasonDetails(event);
            const displayAddress = formatOpportunityAddress(event, location);
            const addressParts = splitDisplayAddress(displayAddress);
            const bullets = opportunityBullets(reasonDetails);
            const enrichment = getEventEnrichment(event);
            const areaContext = [String(event.raw?.neighborhood || "").trim(), String(event.raw?.county || "").trim()].filter(Boolean).join(" · ");

            return (
              <Card key={event.id} className="overflow-hidden border-semantic-border/55 bg-white/74 transition hover:-translate-y-0.5 hover:shadow-card" data-testid="scanner-result-card">
                <CardBody className="grid gap-5 xl:grid-cols-[220px_1fr_220px] xl:items-start">
                  <OpportunityPropertyVisual event={event} address={displayAddress} addressLine={addressParts.streetLine} enrichment={enrichment} />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={sourceBadgeVariant(event)}>
                          {reasonDetails.signalSource}
                        </Badge>
                        <Badge variant={addressQualityVariant(event)}>
                          {addressQualityLabel(event)}
                        </Badge>
                        <Badge variant="default">{freshnessLabel(event.created_at)}</Badge>
                      </div>
                      <p className="text-xl font-semibold text-semantic-text">{event.title}</p>
                      <p className="inline-flex items-center gap-2 text-base font-medium text-semantic-text">
                        <MapPin className="h-4 w-4" />
                        {addressParts.streetLine}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-muted">
                        <span>{addressParts.marketLine}</span>
                        {areaContext ? <span className="hidden h-1 w-1 rounded-full bg-semantic-border sm:inline-block" /> : null}
                        {areaContext ? <span>{areaContext}</span> : null}
                        <span className="hidden h-1 w-1 rounded-full bg-semantic-border sm:inline-block" />
                        <span>{reasonDetails.distance}</span>
                        <span className="hidden h-1 w-1 rounded-full bg-semantic-border sm:inline-block" />
                        <span>{reasonDetails.signalSource}</span>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricStat label="Job Type" value={reasonDetails.serviceType} />
                      <MetricStat label="Urgency" value={reasonDetails.urgencyWindow} />
                      <MetricStat label="Confidence" value={`${event.confidence}`} emphasize />
                      <MetricStat label="Job score" value={`${event.intent_score}`} emphasize />
                    </div>

                    <div className="rounded-[1.15rem] border border-semantic-border/60 bg-white/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Why this job is showing up</p>
                      <ul className="mt-3 grid gap-2 text-sm text-semantic-text">
                        {bullets.map((bullet, index) => (
                          <li key={`${event.id}-reason-${index}`} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-700" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {enrichment && (
                      <details className="rounded-[1.15rem] border border-semantic-border/60 bg-white/68 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-semantic-text">Property details</summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <MetricStat label="Neighborhood" value={enrichment.neighborhood} />
                          <MetricStat label="Lead source" value={reasonDetails.signalSource} />
                          <MetricStat label="Property value" value={enrichment.propertyValueEstimate || "Unavailable"} />
                          <MetricStat
                            label={enrichment.simulated ? "Contact status" : "Owner contact"}
                            value={
                              enrichment.ownerContact
                                ? `${enrichment.ownerContact.name} · ${enrichment.ownerContact.confidenceLabel}`
                                : enrichment.simulated
                                  ? "Demo only"
                                  : "Not available"
                            }
                          />
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 xl:rounded-[1.15rem] xl:border xl:border-semantic-border/60 xl:bg-white/68 xl:p-3">
                    <Button size="lg" disabled={dispatchingId === event.id} onClick={() => dispatchEvent(event, "job")}>
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BriefcaseBusiness className="h-4 w-4" />}
                      Schedule Inspection
                    </Button>
                    <p className="rounded-[1rem] border border-semantic-border/60 bg-white/72 px-4 py-3 text-sm text-semantic-text sm:col-span-2 xl:col-span-1">
                      <span className="font-semibold">Next step:</span> {nextAction}
                    </p>
                    <Button size="lg" variant="secondary" disabled={dispatchingId === event.id} onClick={() => dispatchEvent(event, "lead")}>
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Create Lead
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      disabled={dispatchingId === event.id}
                      onClick={() => dispatchEvent(event, "job", suggestedAssigneeForEvent(event, rules))}
                    >
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                      Assign Technician
                    </Button>
                    <Button size="lg" variant="secondary" disabled={dispatchingId === event.id} onClick={() => dispatchEvent(event)}>
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                      {recommendedActionLabel(event.intent_score)}
                    </Button>
                    <Button size="lg" variant="ghost" className="sm:col-span-2 xl:col-span-1" onClick={() => setPreview(event)}>
                      <Eye className="h-4 w-4" />
                      View details
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </section>
      )}

      {tab === "rules" && (
        <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Routing Rules</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {rulesLoading && (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              )}

              {!rulesLoading && rules.length === 0 && <p className="text-sm text-semantic-muted">No rules yet. Add one below.</p>}

              {!rulesLoading &&
                rules.map((rule) => (
                  <article key={rule.id} className="rounded-[1.15rem] border border-semantic-border/60 bg-white/72 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-semantic-text">{categoryLabel[rule.category]}</p>
                        <p className="text-sm text-semantic-muted">
                          Assignee: {rule.default_assignee || "Dispatch Queue"} · SLA: {rule.default_sla_minutes}m
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rule.enabled ? "success" : "default"}>{rule.enabled ? "Enabled" : "Disabled"}</Badge>
                        <Badge variant="brand">Default: {rule.default_create_mode.toUpperCase()}</Badge>
                        <Badge variant="default">${(rule.default_job_value_cents / 100).toLocaleString()}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(rule)}>
                        <Settings2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule(rule.id)}>
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
            </CardBody>
          </Card>

          <Card className="border-semantic-border/55 bg-white/58">
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">{editing ? "Edit Rule" : "Add Rule"}</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Category</span>
                <Select value={ruleForm.category} onChange={(e) => setRuleForm((prev) => ({ ...prev, category: e.target.value as Category }))}>
                  {categories.map((category) => (
                    <option key={category} value={category}>{categoryLabel[category]}</option>
                  ))}
                </Select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Default Assignee</span>
                <Input value={ruleForm.default_assignee} onChange={(e) => setRuleForm((prev) => ({ ...prev, default_assignee: e.target.value }))} placeholder="Dispatch Queue" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Create Mode</span>
                  <Select
                    value={ruleForm.default_create_mode}
                    onChange={(e) =>
                      setRuleForm((prev) => ({ ...prev, default_create_mode: e.target.value as "lead" | "job" }))
                    }
                  >
                    <option value="lead">Lead</option>
                    <option value="job">Job</option>
                  </Select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">SLA Minutes</span>
                  <Input
                    type="number"
                    value={ruleForm.default_sla_minutes}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, default_sla_minutes: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Default Job Value (cents)</span>
                <Input
                  type="number"
                  value={ruleForm.default_job_value_cents}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, default_job_value_cents: e.target.value }))}
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-semantic-text">
                <input
                  type="checkbox"
                  checked={ruleForm.enabled}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Rule enabled
              </label>

              <div className="flex gap-2">
                <Button onClick={saveRule}>{editing ? "Save Changes" : "Create Rule"}</Button>
                {editing && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(null);
                      setRuleForm({
                        category: "general",
                        default_assignee: "Dispatch Queue",
                        default_create_mode: "lead",
                        default_job_value_cents: "60000",
                        default_sla_minutes: "60",
                        enabled: true
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="rounded-[1.15rem] border border-semantic-border/60 bg-white/72 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Test Routing</p>
                <p className="mt-1 text-sm text-semantic-text">
                  {testRule
                    ? `${categoryLabel[testRule.category]} → ${testRule.default_create_mode.toUpperCase()} · ${testRule.default_assignee || "Dispatch Queue"} · SLA ${testRule.default_sla_minutes}m`
                    : `No enabled rule for ${categoryLabel[selectedCategories[0] || "general"]}. Dispatch falls back to intent-based routing.`}
                </p>
              </div>
            </CardBody>
          </Card>
        </section>
      )}

      {preview && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-neutral-900/45">
          <button className="h-full w-full" aria-label="Close preview" onClick={() => setPreview(null)} />
          <aside className="relative z-[81] h-full w-full max-w-xl overflow-y-auto border-l border-semantic-border bg-semantic-surface p-6">
            <button
              className="absolute right-4 top-4 rounded-lg p-2 text-semantic-muted hover:bg-semantic-surface2"
              onClick={() => setPreview(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">
                <Wrench className="h-3.5 w-3.5" />
                {categoryLabel[preview.category]}
              </p>
              <h3 className="text-2xl font-semibold text-semantic-text">{preview.title}</h3>
              <p className="text-sm text-semantic-muted">{preview.description}</p>
              <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Live Post (Demo)</p>
                <p className="mt-2 text-sm text-semantic-text">{conversationStylePost(preview)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Detail label="Intent" value={String(preview.intent_score)} />
                <Detail label="Confidence" value={String(preview.confidence)} />
                <Detail label="Source" value={preview.source} />
                <Detail label="Location" value={preview.location_text || "-"} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(preview.tags || []).map((tag, index) => (
                    <span
                      key={`${preview.id}-tag-${index}`}
                      className="rounded-full bg-semantic-surface2 px-3 py-1 text-xs font-semibold text-semantic-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Raw Payload</p>
                <pre className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-semantic-border bg-semantic-surface2 p-3 text-xs text-semantic-muted">
                  {JSON.stringify(preview.raw || {}, null, 2)}
                </pre>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-semantic-text">{value || "-"}</p>
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "weather") return "Weather Watch";
  if (source === "public_feed") return "Neighborhood Feed";
  if (source === "google_places") return "Local Search";
  if (source === "demo") return "Demo Feed";
  return "Referral Feed";
}

function sourceBadgeVariant(event: ScannerEvent): "brand" | "success" | "warning" | "default" {
  if (event.source === "weather") return "brand";
  if (event.source === "public_feed") return "success";
  if (event.source === "demo") return "warning";
  return "default";
}

function getOpportunityReasonDetails(event: ScannerEvent) {
  const incidentType = String(event.raw?.incident_type || event.raw?.event || "Incident signal");
  const weatherEvent = String(event.raw?.weather_signal || "Local weather pressure");
  const serviceType = String(event.raw?.service_type || categoryLabel[event.category]);
  const distanceMiles = Number(event.raw?.distance_miles);
  const forecastWindow = String(event.raw?.urgency_window || event.raw?.forecast_window || "Today");
  const demandSignal = String(event.raw?.demand_signal || event.tags.slice(0, 2).join(", ") || "Demand detected");
  const demandExplanation = String(event.raw?.demand_explanation || "").trim();
  const signalSource = String(event.raw?.signal_source || sourceLabel(event.source));

  return {
    incidentType,
    weatherEvent: `${weatherEvent} · ${forecastWindow}`,
    serviceType,
    distance: Number.isFinite(distanceMiles) ? `${distanceMiles} mi` : "Service area",
    urgencyWindow: forecastWindow,
    demandSignal,
    demandExplanation,
    signalSource
  };
}

function formatOpportunityAddress(event: ScannerEvent, serviceArea: string) {
  const propertyAddress = String(event.raw?.property_address || "").trim();
  const propertyCity = String(event.raw?.property_city || "").trim();
  const propertyState = String(event.raw?.property_state || "").trim();
  const propertyPostal = String(event.raw?.property_postal_code || "").trim();
  const normalized = [propertyAddress, [propertyCity, propertyState].filter(Boolean).join(", "), propertyPostal].filter(Boolean).join(" ");
  if (normalized) {
    const fixed = normalized.replace(/\s+,/g, ",").replace(/,\s+/g, ", ").trim();
    if (fixed) return fixed;
  }

  const raw = String(event.location_text || "").trim();
  const looksLikeCoordinates = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(raw);
  if (raw && !looksLikeCoordinates) return raw;
  if (serviceArea.includes(",")) return `Property near ${serviceArea}`;
  return "Property near saved service area";
}

function opportunityBullets(details: ReturnType<typeof getOpportunityReasonDetails>) {
  return [
    `${details.demandSignal} supports a ${details.serviceType.toLowerCase()} opportunity.`,
    `${details.weatherEvent} is keeping the urgency window active.`,
    `${details.distance} from your service area, with ${details.signalSource.toLowerCase()} as the source.`
  ];
}

function addressQualityLabel(event: ScannerEvent) {
  return String(event.raw?.address_quality || "").toLowerCase() === "exact" ? "Exact address" : "Dispatch area";
}

function addressQualityVariant(event: ScannerEvent): "success" | "warning" {
  return String(event.raw?.address_quality || "").toLowerCase() === "exact" ? "success" : "warning";
}

function freshnessLabel(iso: string) {
  const deltaMinutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (deltaMinutes < 60) return `Fresh ${deltaMinutes}m`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `Fresh ${deltaHours}h`;
  const deltaDays = Math.round(deltaHours / 24);
  return `Fresh ${deltaDays}d`;
}

function MetricStat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-semantic-border bg-semantic-surface px-4 py-3",
        emphasize && "bg-white"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className={cn("mt-2 text-base font-semibold text-semantic-text", emphasize && "text-lg")}>{value}</p>
    </div>
  );
}

function OpportunityPropertyVisual({
  event,
  address,
  addressLine,
  enrichment
}: {
  event: ScannerEvent;
  address: string;
  addressLine: string;
  enrichment: EnrichmentRecord | null;
}) {
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-semantic-border bg-[linear-gradient(160deg,rgba(29,38,34,0.98),rgba(79,95,87,0.92))] p-4 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
          {String(event.raw?.incident_type || categoryLabel[event.category])}
        </span>
        <span className="text-sm font-semibold text-brand-200">{categoryLabel[event.category]}</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))] p-4">
        <div className="relative h-40 overflow-hidden rounded-[1rem]">
          {enrichment?.propertyImageUrl ? (
            <Image
              src={enrichment.propertyImageUrl}
              alt={enrichment.propertyImageSource || "Property aerial image"}
              fill
              className="object-cover"
              sizes="(max-width: 1280px) 280px, 320px"
              unoptimized
            />
          ) : (
            <Image
              src="/marketing/property-preview.svg"
              alt="Property preview"
              fill
              className="object-cover"
              sizes="(max-width: 1280px) 280px, 320px"
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,29,26,0.04),rgba(22,29,26,0.28))]" />
          <div className="absolute left-3 top-3 rounded-full bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
            {enrichment?.propertyImageLabel || "Property image"}
          </div>
          {enrichment?.ownerContact && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold text-white/88">
              {enrichment.ownerContact.confidenceLabel}
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-white">{addressLine}</p>
      <p className="mt-1 text-sm text-white/70">{address}</p>
      {enrichment && (
        <div className="mt-4 grid gap-2 text-xs text-white/80">
          <p>
            <span className="font-semibold text-white">Neighborhood:</span> {enrichment.neighborhood}
          </p>
          <p>
            <span className="font-semibold text-white">Value:</span> {enrichment.propertyValueEstimate || "Unavailable"}
          </p>
          <p>
            <span className="font-semibold text-white">Owner:</span> {enrichment.ownerContact?.name || "Unavailable"}
          </p>
          <p>
            <span className="font-semibold text-white">Image source:</span> {enrichment.propertyImageSource || "Placeholder"}
          </p>
        </div>
      )}
    </div>
  );
}

function splitDisplayAddress(address: string) {
  const parts = address.split(",");
  if (parts.length <= 1) {
    return {
      streetLine: address,
      marketLine: "Saved service area"
    };
  }

  return {
    streetLine: parts[0]?.trim() || address,
    marketLine: parts.slice(1).join(",").trim()
  };
}

function recommendedActionLabel(intentScore: number) {
  if (intentScore >= 82) return "Convert to Job";
  if (intentScore >= 68) return "Assign Follow-up";
  return "Add to Pipeline";
}

function suggestedAssigneeForEvent(event: ScannerEvent, rules: RoutingRule[]) {
  const rule = rules.find((item) => item.category === event.category && item.enabled);
  return rule?.default_assignee || (event.category === "demolition" ? "Mitigation Crew" : event.category === "restoration" ? "Storm Desk" : "Dispatch Queue");
}

function conversationStylePost(event: ScannerEvent) {
  const snippets = [
    `Need help fast in ${event.location_text || "my area"} - ${event.title.toLowerCase()}.`,
    "Insurance claim likely, looking for someone today.",
    "If anyone has a trusted contractor please DM ASAP."
  ];
  return `${snippets.join(" ")} Signals: ${(event.tags || []).join(", ")}.`;
}

function getEventEnrichment(event: ScannerEvent) {
  const enrichment = event.raw?.enrichment;
  if (!enrichment || typeof enrichment !== "object") return null;
  return enrichment as EnrichmentRecord;
}
