"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Radar, Search, MapPin, Phone, Plus, Eye, Sparkles, X, Loader2, CalendarPlus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";

type CampaignMode = "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";

type ScannerLead = {
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
  sourceMode: "synthetic" | "google_places";
  signals: Array<{ id?: string; signal_type: string; title: string; detail: string; score: number }>;
  added?: boolean;
};

type WeatherSettings = {
  weather_location_label?: string | null;
  weather_lat?: number | null;
  weather_lng?: number | null;
  home_base_city?: string | null;
  home_base_state?: string | null;
};

const triggerOptions = ["Storm", "Heavy Rain", "High Wind", "Freeze", "Heat", "Hail"] as const;
const serviceOptions = ["Restoration", "Roofing", "Plumbing", "HVAC", "Electrical", "Cleaning"] as const;
const campaignOptions: CampaignMode[] = ["Storm Response", "Roofing", "Water Damage", "HVAC Emergency"];

export function LeadScannerView() {
  const params = useSearchParams();
  const [location, setLocation] = useState("");
  const [service, setService] = useState<(typeof serviceOptions)[number]>("Roofing");
  const [radius, setRadius] = useState("10");
  const [campaignMode, setCampaignMode] = useState<CampaignMode>("Storm Response");
  const [triggers, setTriggers] = useState<string[]>(["Storm", "Heavy Rain"]);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScannerLead[]>([]);
  const [preview, setPreview] = useState<ScannerLead | null>(null);
  const [recommendedAction, setRecommendedAction] = useState<string>("");
  const [weatherRiskLabel, setWeatherRiskLabel] = useState<string>("");
  const { showToast } = useToast();

  useEffect(() => {
    const fromQuery = params.get("location");
    if (fromQuery) setLocation(fromQuery);

    async function loadSettings() {
      const res = await fetch("/api/settings/weather");
      const data = (await res.json()) as WeatherSettings;
      if (!fromQuery) {
        const label = data.weather_location_label || [data.home_base_city, data.home_base_state].filter(Boolean).join(", ");
        if (label) setLocation(label);
      }
    }
    loadSettings();
  }, [params]);

  async function scanNow() {
    setScanning(true);
    const startedAt = Date.now();

    const res = await fetch("/api/scanner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        location,
        service,
        radius: Number(radius),
        triggers,
        campaignMode
      })
    });

    const elapsed = Date.now() - startedAt;
    if (elapsed < 900) {
      await new Promise((resolve) => setTimeout(resolve, 900 - elapsed));
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setScanning(false);
      showToast((data as { error?: string }).error || "Scan failed");
      return;
    }

    const payload = data as {
      campaignMode?: CampaignMode;
      weatherRisk?: { label?: string };
      recommendedAction?: string;
      leads?: ScannerLead[];
    };
    setCampaignMode(payload.campaignMode || campaignMode);
    setWeatherRiskLabel(payload.weatherRisk?.label || "");
    setRecommendedAction(payload.recommendedAction || "");
    setResults(payload.leads || []);
    setScanning(false);
    showToast(`Scan complete: ${(payload.leads || []).length} leads found`);
  }

  async function addToInbox(lead: ScannerLead) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: lead.name,
        phone: lead.phone,
        service_type: lead.service_type,
        city: lead.city,
        state: lead.state,
        postal_code: lead.postal,
        requested_timeframe: lead.urgency === "high" ? "ASAP" : lead.urgency === "medium" ? "Today" : "This week",
        notes: `Scanner lead: ${lead.reason}`,
        source: "import"
      })
    });

    if (!res.ok) {
      showToast("Could not add lead");
      return;
    }

    setResults((prev) => prev.map((row) => (row.id === lead.id ? { ...row, added: true } : row)));
    showToast("Added to Inbox");
  }

  async function addAsJobScheduled(lead: ScannerLead) {
    const leadRes = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: lead.name,
        phone: lead.phone,
        service_type: lead.service_type,
        city: lead.city,
        state: lead.state,
        postal_code: lead.postal,
        requested_timeframe: "Tomorrow AM",
        notes: `Scanner job candidate: ${lead.reason}`,
        source: "import"
      })
    });
    const leadData = await leadRes.json();
    if (!leadRes.ok || !leadData.leadId) {
      showToast("Could not create lead for job");
      return;
    }

    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);

    const jobRes = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lead_id: leadData.leadId,
        pipeline_status: "SCHEDULED",
        scheduled_for: d.toISOString(),
        service_type: lead.service_type,
        estimated_value: Math.round((400 + lead.intentScore * 22) / 10) * 10,
        assigned_tech_name: campaignMode === "Storm Response" ? "Storm Crew A" : "Dispatch Queue",
        intent_score: lead.intentScore,
        customer_name: lead.name,
        customer_phone: lead.phone,
        city: lead.city,
        state: lead.state,
        postal_code: lead.postal,
        notes: `Created from scanner (${campaignMode})`
      })
    });
    const jobData = await jobRes.json();

    if (!jobRes.ok || !jobData.jobId) {
      showToast("Could not create job");
      return;
    }

    setResults((prev) => prev.map((row) => (row.id === lead.id ? { ...row, added: true } : row)));
    showToast("Added as scheduled job");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Scanner"
        subtitle="Generate opportunities from weather pressure, urgency signals, and local demand patterns."
        actions={
          <Badge variant="brand" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Action-first scanner
          </Badge>
        }
      />

      <Card>
        <CardBody className="grid gap-4 lg:grid-cols-[1.2fr_180px_140px_auto]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Location</p>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zip or City, State" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Service</p>
            <Select value={service} onChange={(e) => setService(e.target.value as (typeof serviceOptions)[number])}>
              {serviceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Radius</p>
            <Select value={radius} onChange={(e) => setRadius(e.target.value)}>
              {["5", "10", "25", "50"].map((r) => (
                <option key={r} value={r}>{r} mi</option>
              ))}
            </Select>
          </div>
          <div className="self-end">
            <Button size="lg" onClick={scanNow} disabled={scanning || !location.trim()} fullWidth>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Scan Now
            </Button>
          </div>

          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Campaign mode</p>
            <div className="flex flex-wrap gap-2">
              {campaignOptions.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCampaignMode(mode)}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                    campaignMode === mode ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Triggers</p>
            <div className="flex flex-wrap gap-2">
              {triggerOptions.map((trigger) => {
                const active = triggers.includes(trigger);
                return (
                  <button
                    key={trigger}
                    onClick={() => {
                      setTriggers((prev) =>
                        prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger]
                      );
                    }}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                      active ? "bg-semantic-brand text-white" : "bg-semantic-surface2 text-semantic-muted"
                    }`}
                  >
                    {trigger}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {(weatherRiskLabel || recommendedAction) && (
        <Card className="border-warning-500/25 bg-warning-100">
          <CardBody>
            <p className="text-sm font-semibold text-warning-700">Weather impact: {weatherRiskLabel}</p>
            <p className="text-sm text-warning-700/90">{recommendedAction}</p>
          </CardBody>
        </Card>
      )}

      {scanning ? (
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardBody>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Radar className="mx-auto h-10 w-10 text-brand-700" />
            <p className="mt-3 text-lg font-semibold text-semantic-text">Ready to scan</p>
            <p className="mt-1 text-sm text-semantic-muted">Use weather and campaign mode to generate the next best leads.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((lead) => (
            <Card key={lead.id} className="transition hover:shadow-card">
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-semantic-text">{lead.name}</p>
                    <p className="text-sm text-semantic-muted">{lead.service_type}</p>
                  </div>
                  <Badge variant={lead.urgency === "high" ? "warning" : lead.urgency === "medium" ? "brand" : "default"}>
                    {lead.urgency}
                  </Badge>
                </div>

                <p className="text-sm text-semantic-muted inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {lead.city}, {lead.state} {lead.postal}
                </p>
                <p className="text-sm text-semantic-muted inline-flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {lead.phone}
                </p>
                <p className="text-xs text-semantic-muted">Source: {lead.sourceMode === "google_places" ? "Google Places mode" : "Signal synthesis"}</p>

                <div>
                  <p className="text-sm font-semibold text-semantic-text">Intent {lead.intentScore}%</p>
                  <div className="mt-1.5 h-2.5 w-full rounded-full bg-semantic-surface2">
                    <div
                      className={`h-2.5 rounded-full ${lead.intentScore >= 75 ? "bg-success-500" : lead.intentScore >= 60 ? "bg-warning-500" : "bg-brand-500"}`}
                      style={{ width: `${lead.intentScore}%` }}
                    />
                  </div>
                </div>

                <p className="line-clamp-2 text-sm text-semantic-muted">Why we found it: {lead.reason}</p>

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => addToInbox(lead)} disabled={lead.added}>
                    <Plus className="h-4 w-4" />
                    Add as Lead
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => addAsJobScheduled(lead)} disabled={lead.added}>
                    <CalendarPlus className="h-4 w-4" />
                    Add as Job
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(lead)} className="col-span-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-neutral-900/50 p-0 sm:items-center sm:p-6">
          <div className="absolute inset-0" onClick={() => setPreview(null)} />
          <Card className="relative z-[81] w-full max-w-2xl rounded-t-3xl sm:rounded-2xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-semantic-text">{preview.name}</h3>
                  <p className="text-sm text-semantic-muted">{preview.service_type} · Intent {preview.intentScore}%</p>
                </div>
                <button className="rounded-xl p-2 hover:bg-semantic-surface2" onClick={() => setPreview(null)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Signals</p>
                <div className="mt-2 space-y-2">
                  {preview.signals.slice(0, 4).map((signal, idx) => (
                    <div key={`${signal.title}-${idx}`} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-semantic-text">{signal.title}</p>
                        <Badge variant={signal.score >= 75 ? "success" : signal.score >= 60 ? "warning" : "default"}>{signal.score}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-semantic-muted">{signal.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Timeline</p>
                <div className="mt-2 space-y-2 text-sm text-semantic-muted">
                  <p>1. Scan detected high intent from weather + urgency indicators.</p>
                  <p>2. Follow-up opportunity identified in this service radius.</p>
                  <p>3. Ready for immediate lead or job creation.</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
