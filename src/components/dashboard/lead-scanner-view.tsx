"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Radar,
  MapPin,
  Gauge,
  Tags,
  Eye,
  Download,
  Route,
  Plus,
  BriefcaseBusiness,
  Loader2,
  Wrench,
  X,
  Settings2,
  TestTube2
} from "lucide-react";
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

type Mode = "demo" | "live";
type Category = "plumbing" | "demolition" | "asbestos" | "restoration" | "general";
type Tab = "feed" | "rules" | "harness";
type CampaignMode = "Restoration" | "Plumbing" | "Demo / Asbestos";
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

export function LeadScannerView({ initialTab = "feed" }: { initialTab?: Tab }) {
  const [mode, setMode] = useState<Mode>("demo");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [location, setLocation] = useState("11788");
  const [campaignMode, setCampaignMode] = useState<CampaignMode>("Restoration");
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

  const [harnessDuration, setHarnessDuration] = useState("30");
  const [harnessInterval, setHarnessInterval] = useState("20");
  const [harnessRunning, setHarnessRunning] = useState(false);
  const [captured, setCaptured] = useState<ScannerEvent[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  function startHarness() {
    if (harnessRunning) return;
    const durationMs = Math.max(1, Number(harnessDuration) || 30) * 60_000;
    const intervalMs = Math.max(10, Number(harnessInterval) || 20) * 1000;

    setHarnessRunning(true);
    startRef.current = Date.now();
    setCaptured([]);

    runScan(false);
    timerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= durationMs) {
        stopHarness();
        showToast("Live test finished");
        return;
      }
      await runScan(false);
    }, intervalMs);
  }

  function stopHarness() {
    setHarnessRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function dispatchEvent(event: ScannerEvent, createMode?: "lead" | "job") {
    setDispatchingId(event.id);
    const res = await fetch(`/api/scanner/events/${event.id}/dispatch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createMode ? { createMode } : {})
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

  function exportCsv() {
    const source = captured.length > 0 ? captured : sortedEvents;
    if (source.length === 0) {
      showToast("No opportunities to export");
      return;
    }

    const columns = [
      "id",
      "source",
      "category",
      "title",
      "description",
      "location",
      "intent_score",
      "confidence",
      "tags",
      "created_at"
    ];

    const rows = source.map((event) => [
      event.id,
      event.source,
      event.category,
      event.title,
      event.description,
      event.location_text,
      String(event.intent_score),
      String(event.confidence),
      event.tags.join("|"),
      event.created_at
    ]);

    const csv = [columns, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanner-opportunities-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Radar }> = [
    { id: "feed", label: "Scanner Feed", icon: Radar },
    { id: "rules", label: "Routing Rules", icon: Route },
    { id: "harness", label: "Live Test Harness", icon: TestTube2 }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunity Scanner"
        subtitle="Live signal feed for dispatch: route each opportunity to a lead or scheduled job in one click."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/scanner/harness">
              <Button variant="secondary" size="sm">
                <TestTube2 className="h-4 w-4" />
                Open Harness
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export captured opportunities
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          {demoActionMessage && (
            <div className="rounded-xl border border-brand-500/20 bg-brand-50/70 px-4 py-3 text-sm font-medium text-brand-700">
              {demoActionMessage}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-[140px_1fr_180px_120px_120px]">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Mode</p>
              <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="demo">DEMO</option>
                <option value="live">LIVE</option>
              </Select>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Service Area</p>
              <Input
                data-testid="scanner-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ZIP or city (11788, 11705, 10019)"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Campaign</p>
              <Select
                value={campaignMode}
                onChange={(e) => {
                  const next = e.target.value as CampaignMode;
                  setCampaignMode(next);
                  if (next === "Restoration") setSelectedCategories(["restoration"]);
                  if (next === "Plumbing") setSelectedCategories(["plumbing"]);
                  if (next === "Demo / Asbestos") setSelectedCategories(["demolition", "asbestos"]);
                }}
              >
                <option value="Restoration">Restoration</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Demo / Asbestos">Demo / Asbestos</option>
              </Select>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Radius (mi)</p>
              <Select data-testid="scanner-radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
                {["5", "10", "25", "50", "100"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Limit</p>
              <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
                {["8", "12", "20", "30", "50"].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            </div>

            <div className="self-end">
              <Button data-testid="scanner-run" onClick={() => runScan(true)} disabled={loading} fullWidth>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Scan Now
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["11705", "11788", "10019"].map((zip) => (
              <Button key={zip} size="sm" variant={location === zip ? "primary" : "secondary"} onClick={() => setLocation(zip)}>
                {zip}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Lat (optional)</p>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.7812" />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Lon (optional)</p>
                <Input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-73.2462" />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Services</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const active = selectedCategories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() =>
                        setSelectedCategories((prev) =>
                          prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
                        )
                      }
                      className={cn(
                        "min-h-11 rounded-full px-4 text-sm font-semibold",
                        active ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
                      )}
                    >
                      {categoryLabel[category]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Triggers</p>
            <div className="flex flex-wrap gap-2">
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
                      "min-h-11 rounded-full px-4 text-sm font-semibold",
                      active ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
                    )}
                  >
                    {trigger.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                tab === item.id ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "feed" && (
        <section className="space-y-4">
          {loading && (
            <Card>
              <CardBody className="space-y-3">
                <p className="text-sm font-semibold text-semantic-text">Scanning neighborhood signals and contractor boards...</p>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardBody>
            </Card>
          )}

          {!loading && sortedEvents.length === 0 && (
            <Card>
              <CardBody className="py-12 text-center">
                <Radar className="mx-auto h-10 w-10 text-brand-700" />
                <p className="mt-3 text-lg font-semibold text-semantic-text">Scanner is listening</p>
                <p className="mt-1 text-sm text-semantic-muted">Run a scan to populate live opportunities and dispatch actions.</p>
              </CardBody>
            </Card>
          )}

          {sortedEvents.map((event) => {
            const nextAction = String(event.raw?.next_action || event.raw?.recommended_action || "Dispatch within SLA and send first contact.");
            const reasonSummary = String(event.raw?.reason_summary || "Signal pattern indicates near-term service demand.");
            const reasonDetails = getOpportunityReasonDetails(event);

            return (
              <Card key={event.id} className="transition hover:shadow-card" data-testid="scanner-result-card">
                <CardBody className="grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-center">
                  <div className="space-y-2">
                    <Badge variant={event.intent_score >= 78 ? "warning" : event.intent_score >= 62 ? "brand" : "default"}>
                      Intent {event.intent_score}
                    </Badge>
                    <p className="text-sm font-semibold text-semantic-text">{categoryLabel[event.category]}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-semantic-muted">
                      <Gauge className="h-3.5 w-3.5" />
                      Confidence {event.confidence}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-semantic-text">{event.title}</p>
                        <p className="mt-1 text-sm text-semantic-muted">{event.description}</p>
                      </div>
                      <Badge>{reasonDetails.serviceType}</Badge>
                    </div>
                    <p className="inline-flex items-center gap-1 text-sm text-semantic-muted">
                      <MapPin className="h-4 w-4" />
                      {event.location_text || "Service area"}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-semantic-muted">
                      {sourceLabel(event.source)} · {relativeAge(event.created_at)}
                    </p>
                    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Why this opportunity exists</p>
                      <p className="mt-2 text-sm font-medium text-semantic-text">{reasonSummary}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <ReasonStat label="Weather event" value={reasonDetails.weatherEvent} />
                        <ReasonStat label="Service type" value={reasonDetails.serviceType} />
                        <ReasonStat label="Distance" value={reasonDetails.distance} />
                        <ReasonStat label="Demand signal" value={reasonDetails.demandSignal} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-semantic-border bg-semantic-surface p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Next action</p>
                      <p className="mt-2 text-sm text-semantic-text">{nextAction}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Tags className="h-3.5 w-3.5 text-semantic-muted" />
                      {(event.tags || []).map((tag) => (
                        <span key={`${event.id}-${tag}`} className="rounded-full bg-semantic-surface2 px-3 py-1 text-xs font-semibold text-semantic-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <Button size="lg" variant="secondary" onClick={() => setPreview(event)}>
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button size="lg" variant="secondary" disabled={dispatchingId === event.id} onClick={() => dispatchEvent(event, "lead")}>
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add as Lead
                    </Button>
                    <Button size="lg" variant="secondary" disabled={dispatchingId === event.id} onClick={() => dispatchEvent(event, "job")}>
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BriefcaseBusiness className="h-4 w-4" />}
                      Add as Job
                    </Button>
                    <Button size="lg" disabled={dispatchingId === event.id} onClick={() => dispatchEvent(event)}>
                      {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                      Claim Job
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
          <Card>
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
                  <article key={rule.id} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-4">
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

          <Card>
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

              <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
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

      {tab === "harness" && (
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Live Test Harness</h2>
            </CardHeader>
            <CardBody className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Service Area</p>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, ST or ZIP" />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Duration (minutes)</p>
                <Input type="number" value={harnessDuration} onChange={(e) => setHarnessDuration(e.target.value)} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Every (seconds)</p>
                <Input type="number" value={harnessInterval} onChange={(e) => setHarnessInterval(e.target.value)} />
              </div>
              <div className="self-end">
                {harnessRunning ? (
                  <Button variant="danger" onClick={stopHarness} fullWidth>
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                ) : (
                  <Button onClick={startHarness} fullWidth>
                    <Play className="h-4 w-4" />
                    Start Live Test
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="dashboard-section-title text-semantic-text">Captured Opportunities ({captured.length})</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {captured.length === 0 && (
                <p className="text-sm text-semantic-muted">Run the harness to append opportunities every interval and export to CSV.</p>
              )}
              {captured.slice(0, 40).map((event) => (
                <article key={`${event.id}-${event.created_at}`} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-semantic-text">{event.title}</p>
                    <Badge variant={event.intent_score >= 75 ? "warning" : "default"}>{event.intent_score}</Badge>
                  </div>
                  <p className="text-sm text-semantic-muted">{event.location_text}</p>
                </article>
              ))}
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
                  {(preview.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full bg-semantic-surface2 px-3 py-1 text-xs font-semibold text-semantic-muted">
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
  if (source === "weather") return "Contractor Board";
  if (source === "public_feed") return "Neighborhood Forum";
  return "FB Group";
}

function getOpportunityReasonDetails(event: ScannerEvent) {
  const weatherEvent = String(event.raw?.weather_signal || "Local weather pressure");
  const serviceType = String(event.raw?.service_type || categoryLabel[event.category]);
  const distanceMiles = Number(event.raw?.distance_miles);
  const forecastWindow = String(event.raw?.forecast_window || "today");
  const demandSignal = String(event.raw?.demand_signal || event.tags.slice(0, 2).join(", ") || "Demand detected");

  return {
    weatherEvent: `${weatherEvent} · ${forecastWindow}`,
    serviceType,
    distance: Number.isFinite(distanceMiles) ? `${distanceMiles} mi` : "Service area",
    demandSignal
  };
}

function ReasonStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-semantic-border bg-semantic-surface px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-semantic-text">{value}</p>
    </div>
  );
}

function relativeAge(iso: string) {
  const delta = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function conversationStylePost(event: ScannerEvent) {
  const snippets = [
    `Need help fast in ${event.location_text || "my area"} - ${event.title.toLowerCase()}.`,
    "Insurance claim likely, looking for someone today.",
    "If anyone has a trusted contractor please DM ASAP."
  ];
  return `${snippets.join(" ")} Signals: ${(event.tags || []).join(", ")}.`;
}
