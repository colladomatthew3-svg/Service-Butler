"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  MapPin,
  Play,
  Plus,
  Radar,
  Settings2,
  Loader2,
  Sparkles,
  TrendingUp,
  Wrench,
  X
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { hasVerifiedOwnerContact } from "@/lib/services/contact-proof";
import { isSyntheticScannerRecord } from "@/lib/services/scanner-truth";
import type { EnrichmentRecord } from "@/lib/services/enrichment";

type Mode = "live";
type ScannerRuntimeMode = "fully-live" | "live-partial";
type Category = "plumbing" | "demolition" | "asbestos" | "restoration" | "general";
type Tab = "feed" | "sdr" | "rules";
type CampaignMode = "Storm Response" | "Roofing" | "Water Damage" | "HVAC Emergency";
type Trigger = "storm" | "heavy-rain" | "freeze" | "high-wind";
type MarketScope = "single" | "nyc_li_burst";

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

type QualificationState = {
  status: "research_only" | "queued_for_sdr" | "qualified_contactable" | "rejected";
  reasonCode: string | null;
  nextRecommendedAction: string;
  proofAuthenticity: string;
  sourceType: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  verificationStatus: string | null;
  qualificationSource: string | null;
  qualificationNotes: string | null;
  qualifiedAt: string | null;
  qualifiedBy: string | null;
};

type QualificationDraft = {
  contactName: string;
  phone: string;
  email: string;
  verificationStatus: string;
  qualificationSource: string;
  qualificationNotes: string;
};

type ScannerThroughputSummary = {
  window_hours: number;
  captured_real_signals: number;
  qualified_contactable_signals: number;
  research_only_signals: number;
  scanner_verified_leads_created: number;
  warning?: string;
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

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mergeScannerEvents(primary: ScannerEvent[], secondary: ScannerEvent[] = []) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function ScannerMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[1.1rem] border border-semantic-border/60 bg-white/74 px-4 py-3 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-semantic-text">{value}</p>
      <p className="mt-1 text-xs text-semantic-muted">{helper}</p>
    </div>
  );
}

function normalizeQualificationState(event: ScannerEvent, override?: QualificationState): QualificationState {
  if (override) return override;

  const hasVerifiedContact = hasVerifiedOwnerContact(event.raw?.enrichment);
  return {
    status: hasVerifiedContact ? "qualified_contactable" : "research_only",
    reasonCode: readText(event.raw?.qualification_reason_code) || (hasVerifiedContact ? "verified_contact_present" : "missing_verified_contact"),
    nextRecommendedAction: readText(event.raw?.next_recommended_action) || (hasVerifiedContact ? "dispatch_to_lead_queue" : "route_to_sdr"),
    proofAuthenticity: readText(event.raw?.proof_authenticity) || "unknown",
    sourceType: readText(event.raw?.source_type) || String(event.source || "scanner_signal"),
    contactName: readText(event.raw?.contact_name) || null,
    phone: readText(event.raw?.phone) || null,
    email: readText(event.raw?.email) || null,
    verificationStatus: readText(event.raw?.verification_status) || null,
    qualificationSource: readText(event.raw?.qualification_source) || null,
    qualificationNotes: readText(event.raw?.qualification_notes) || null,
    qualifiedAt: readText(event.raw?.qualified_at) || null,
    qualifiedBy: readText(event.raw?.qualified_by) || null
  };
}

function buildQualificationDraft(state: QualificationState): QualificationDraft {
  return {
    contactName: state.contactName || "",
    phone: state.phone || "",
    email: state.email || "",
    verificationStatus: state.verificationStatus || "verified",
    qualificationSource: state.qualificationSource || "sdr_follow_up_lane",
    qualificationNotes: state.qualificationNotes || ""
  };
}

function matchesFocusedOpportunity(event: ScannerEvent, focusOpportunityId: string) {
  const target = focusOpportunityId.trim();
  if (!target) return false;

  const rawOpportunityId = readText(event.raw?.v2_opportunity_id) || readText(event.raw?.opportunity_id);
  return rawOpportunityId === target || event.id === target;
}

export function LeadScannerView({
  initialTab = "feed",
  onboardingMode,
  focusOpportunityId
}: {
  initialTab?: Tab;
  onboardingMode?: "first-scan";
  focusOpportunityId?: string;
}) {
  const [mode] = useState<Mode>("live");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [location, setLocation] = useState("Hauppauge, NY 11788");
  const [marketScope, setMarketScope] = useState<MarketScope>("single");
  const [campaignMode, setCampaignMode] = useState<CampaignMode>("Storm Response");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radius, setRadius] = useState("25");
  const [limit, setLimit] = useState("80");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([...categories]);
  const [selectedTriggers, setSelectedTriggers] = useState<Trigger[]>(["storm", "heavy-rain"]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [captured, setCaptured] = useState<ScannerEvent[]>([]);
  const [scannerWarning, setScannerWarning] = useState<string | null>(null);
  const [feedWarning, setFeedWarning] = useState<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<ScannerRuntimeMode>("fully-live");
  const [throughput, setThroughput] = useState<ScannerThroughputSummary | null>(null);
  const [preview, setPreview] = useState<ScannerEvent | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [qualificationByEventId, setQualificationByEventId] = useState<Record<string, QualificationState>>({});
  const [qualificationDrafts, setQualificationDrafts] = useState<Record<string, QualificationDraft>>({});
  const [reviewingQualificationId, setReviewingQualificationId] = useState<string | null>(null);
  const [savingQualificationId, setSavingQualificationId] = useState<string | null>(null);

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

  const { showToast } = useToast();

  const sortedEvents = useMemo(() => {
    const ordered = [...events]
      .filter((event) => !isSyntheticScannerRecord({ source: event.source, raw: event.raw }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!focusOpportunityId) return ordered;

    const focused: ScannerEvent[] = [];
    const remainder: ScannerEvent[] = [];
    for (const event of ordered) {
      if (matchesFocusedOpportunity(event, focusOpportunityId)) {
        focused.push(event);
      } else {
        remainder.push(event);
      }
    }
    return [...focused, ...remainder];
  }, [events, focusOpportunityId]);

  const testRule = useMemo(() => {
    const pick = selectedCategories[0] || "general";
    return rules.find((rule) => rule.category === pick && rule.enabled) || null;
  }, [rules, selectedCategories]);
  const showingFirstScanGuide = onboardingMode === "first-scan";
  const priorityEvent = sortedEvents[0] || null;
  const triggerSummary = selectedTriggers
    .map((triggerId) => triggerOptions.find((option) => option.id === triggerId)?.label || triggerId)
    .join(" · ");
  const sourceMixCount = new Set(sortedEvents.map((event) => event.source)).size;
  const highIntentCount = sortedEvents.filter((event) => event.intent_score >= 75).length;
  const queueDepth = sortedEvents.length;
  const activeWarnings = useMemo(
    () => Array.from(new Set([scannerWarning, feedWarning].filter((value): value is string => Boolean(value)))),
    [feedWarning, scannerWarning]
  );
  const qualifiedDispatchableCount = useMemo(
    () =>
      sortedEvents.filter((event) => {
        const qualification = normalizeQualificationState(event, qualificationByEventId[event.id]);
        return (
          hasVerifiedOwnerContact(event.raw?.enrichment) ||
          (qualification.status === "qualified_contactable" &&
            qualification.verificationStatus === "verified" &&
            Boolean(qualification.phone || qualification.email))
        );
      }).length,
    [qualificationByEventId, sortedEvents]
  );
  const sdrQueuedEvents = useMemo(
    () =>
      sortedEvents.filter((event) => normalizeQualificationState(event, qualificationByEventId[event.id]).status === "queued_for_sdr"),
    [qualificationByEventId, sortedEvents]
  );
  const throughputActionPlan = useMemo(() => {
    const capturedSignals = throughput?.captured_real_signals ?? 0;
    const qualifiedSignals = throughput?.qualified_contactable_signals ?? 0;
    const verifiedLeads = throughput?.scanner_verified_leads_created ?? 0;
    const researchOnlySignals = throughput?.research_only_signals ?? 0;
    const highThroughput = capturedSignals >= 12;
    const lowQualified =
      capturedSignals > 0 && qualifiedSignals <= Math.max(2, Math.floor(capturedSignals * 0.2));

    if (highThroughput && lowQualified) {
      return {
        tone: "warning" as const,
        badge: "Route to SDR",
        title: "High real-signal volume, but too few verified contacts.",
        body:
          "Keep the no-synthetic policy intact. Route the strongest research-only signals to SDR, verify phone or email, then dispatch only the qualified records.",
        steps: ["Route top research-only signals to SDR.", "Verify phone or email before qualification.", "Dispatch only after the signal becomes qualified contactable."]
      };
    }

    if (qualifiedSignals > 0 || qualifiedDispatchableCount > 0) {
      return {
        tone: "success" as const,
        badge: "Dispatch ready",
        title: "Verified contacts are available for dispatch.",
        body:
          "Work the qualified queue first. Those signals already have verified contactability, so the next move is dispatch, not more scanning.",
        steps: ["Open the verified-ready queue.", "Create the lead or job from the qualified signal.", "Keep SDR focused on the remaining research-only records."]
      };
    }

    if (researchOnlySignals > 0 || sdrQueuedEvents.length > 0 || verifiedLeads === 0) {
      return {
        tone: "default" as const,
        badge: "Verification first",
        title: "Qualification is the next hard gate.",
        body:
          "Scanner is capturing real signals, but buyer-grade output only starts after contact verification. Move research-only records into SDR before trying to dispatch.",
        steps: ["Route research-only signals to SDR.", "Verify contact details on the strongest records.", "Dispatch after qualification unlocks the lead path."]
      };
    }

    return {
      tone: "default" as const,
      badge: "Monitor",
      title: "Scanner is ready for the next live run.",
      body:
        "Keep the feed tight, watch throughput, and only advance signals that clear verified contactability.",
      steps: ["Run the next scan.", "Review the strongest signals.", "Dispatch only verified contacts."]
    };
  }, [qualifiedDispatchableCount, sdrQueuedEvents.length, throughput]);
  const visibleEvents = tab === "sdr" ? sdrQueuedEvents : sortedEvents;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/scanner/events?limit=100");
    const data = (await res.json().catch(() => ({}))) as { events?: ScannerEvent[]; error?: string; warning?: string };
    if (!res.ok) {
      showToast(data.error || "Could not load scanner feed");
      return;
    }
    setFeedWarning(data.warning || null);
    setEvents((prev) => {
      if (data.warning && (!data.events || data.events.length === 0)) {
        return mergeScannerEvents(prev, captured);
      }
      return mergeScannerEvents(data.events || [], captured);
    });
  }, [captured, showToast]);

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

  const loadThroughput = useCallback(async () => {
    const res = await fetch("/api/scanner/throughput");
    const data = (await res.json().catch(() => ({}))) as ScannerThroughputSummary & { error?: string };
    if (!res.ok) return;
    setThroughput(data);
    if (data.warning) setFeedWarning((prev) => prev || data.warning || null);
  }, []);

  useEffect(() => {
    loadEvents();
    loadRules();
    loadThroughput();
  }, [loadEvents, loadRules, loadThroughput]);

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
        marketScope,
        campaignMode,
        categories: selectedCategories,
        triggers: selectedTriggers,
        limit: Number(limit) || 80,
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
      runtimeMode?: ScannerRuntimeMode;
      warnings?: string[];
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

    const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
    setScannerWarning(warnings[0] || null);
    setRuntimeMode(data.runtimeMode || "fully-live");
    setCaptured((prev) => mergeScannerEvents(batch, prev));
    setEvents((prev) => mergeScannerEvents(batch, prev));

    await loadEvents();
    await loadThroughput();
    setLoading(false);

    if (manual) {
      const risk = data.weatherRisk?.label ? ` · ${data.weatherRisk.label}` : "";
      if (batch.length === 0 && warnings[0]) {
        showToast(warnings[0]);
      } else {
        const runtimeSuffix = data.runtimeMode === "live-partial" ? " · partial live coverage" : "";
        showToast(`Scanner captured ${batch.length} opportunities${risk}${runtimeSuffix}`);
      }
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
      status?: QualificationState["status"];
      reason_code?: string;
      next_step?: string;
      proof_authenticity?: string;
      source_type?: string;
    };
    setDispatchingId(null);

    if (!res.ok) {
      if (res.status === 409 && data.status === "research_only") {
        setQualificationByEventId((prev) => ({
          ...prev,
          [event.id]: {
            status: "research_only",
            reasonCode: data.reason_code || "missing_verified_contact",
            nextRecommendedAction: data.next_step || "route_to_sdr",
            proofAuthenticity: data.proof_authenticity || "unknown",
            sourceType: data.source_type || String(event.source || "scanner_signal"),
            contactName: null,
            phone: null,
            email: null,
            verificationStatus: null,
            qualificationSource: null,
            qualificationNotes: null,
            qualifiedAt: null,
            qualifiedBy: null
          }
        }));
      }
      showToast(data.error || "Dispatch failed");
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

  async function sendToSdr(event: ScannerEvent) {
    setDispatchingId(event.id);
    const res = await fetch(`/api/opportunities/${String(event.raw?.v2_opportunity_id || event.id)}/qualify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        qualification_status: "queued_for_sdr",
        qualification_source: "scanner_operator",
        qualification_notes: `Queued from scanner for SDR follow-up: ${event.title}`,
        scannerOpportunityId: typeof event.raw?.scanner_opportunity_id === "string" ? event.raw.scanner_opportunity_id : event.id
      })
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      qualification_status?: QualificationState["status"];
      qualification_reason_code?: string | null;
      next_recommended_action?: string;
      proof_authenticity?: string;
      source_type?: string | null;
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      verification_status?: string | null;
      qualification_source?: string | null;
      qualification_notes?: string | null;
      qualified_at?: string | null;
      qualified_by?: string | null;
    };
    setDispatchingId(null);

    if (!res.ok) {
      showToast(data.error || "Could not send opportunity to SDR");
      return;
    }

    setQualificationByEventId((prev) => ({
      ...prev,
      [event.id]: {
        status: data.qualification_status || "queued_for_sdr",
        reasonCode: data.qualification_reason_code || "missing_verified_contact",
        nextRecommendedAction: data.next_recommended_action || "await_sdr_review",
        proofAuthenticity: data.proof_authenticity || String(event.raw?.proof_authenticity || "unknown"),
        sourceType: data.source_type || String(event.raw?.source_type || event.source || "scanner_signal"),
        contactName: data.contact_name || null,
        phone: data.phone || null,
        email: data.email || null,
        verificationStatus: data.verification_status || null,
        qualificationSource: data.qualification_source || "scanner_operator",
        qualificationNotes: data.qualification_notes || `Queued from scanner for SDR follow-up: ${event.title}`,
        qualifiedAt: data.qualified_at || null,
        qualifiedBy: data.qualified_by || null
      }
    }));
    setQualificationDrafts((prev) => ({
      ...prev,
      [event.id]: buildQualificationDraft(
        normalizeQualificationState(event, {
          status: data.qualification_status || "queued_for_sdr",
          reasonCode: data.qualification_reason_code || "missing_verified_contact",
          nextRecommendedAction: data.next_recommended_action || "await_sdr_review",
          proofAuthenticity: data.proof_authenticity || String(event.raw?.proof_authenticity || "unknown"),
          sourceType: data.source_type || String(event.raw?.source_type || event.source || "scanner_signal"),
          contactName: data.contact_name || null,
          phone: data.phone || null,
          email: data.email || null,
          verificationStatus: data.verification_status || null,
          qualificationSource: data.qualification_source || "scanner_operator",
          qualificationNotes: data.qualification_notes || `Queued from scanner for SDR follow-up: ${event.title}`,
          qualifiedAt: data.qualified_at || null,
          qualifiedBy: data.qualified_by || null
        })
      )
    }));
    showToast("Opportunity queued for SDR qualification");
  }

  function openQualificationReview(event: ScannerEvent) {
    const state = normalizeQualificationState(event, qualificationByEventId[event.id]);
    setReviewingQualificationId(event.id);
    setQualificationDrafts((prev) => ({
      ...prev,
      [event.id]: prev[event.id] || buildQualificationDraft(state)
    }));
  }

  function updateQualificationDraft(eventId: string, patch: Partial<QualificationDraft>) {
    setQualificationDrafts((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || {
          contactName: "",
          phone: "",
          email: "",
          verificationStatus: "verified",
          qualificationSource: "sdr_follow_up_lane",
          qualificationNotes: ""
        }),
        ...patch
      }
    }));
  }

  async function submitQualification(event: ScannerEvent, status: "qualified_contactable" | "rejected") {
    const draft = qualificationDrafts[event.id] || buildQualificationDraft(normalizeQualificationState(event, qualificationByEventId[event.id]));
    const notes = draft.qualificationNotes.trim();
    const qualificationSource = draft.qualificationSource.trim() || "sdr_follow_up_lane";

    if (!notes) {
      showToast("Add qualification notes before saving SDR review");
      return;
    }

    if (status === "qualified_contactable") {
      if (!draft.contactName.trim()) {
        showToast("Contact name is required to mark this signal contactable");
        return;
      }
      if (!draft.phone.trim() && !draft.email.trim()) {
        showToast("Phone or email is required to mark this signal contactable");
        return;
      }
    }

    setSavingQualificationId(event.id);
    const res = await fetch(`/api/opportunities/${String(event.raw?.v2_opportunity_id || event.id)}/qualify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        qualification_status: status,
        qualification_reason_code: status === "rejected" ? "rejected_after_sdr_review" : "verified_contact_present",
        qualification_source: qualificationSource,
        qualification_notes: notes,
        contact_name: status === "qualified_contactable" ? draft.contactName.trim() : undefined,
        phone: status === "qualified_contactable" ? draft.phone.trim() || undefined : undefined,
        email: status === "qualified_contactable" ? draft.email.trim() || undefined : undefined,
        verification_status: status === "qualified_contactable" ? draft.verificationStatus || "verified" : undefined,
        scannerOpportunityId: typeof event.raw?.scanner_opportunity_id === "string" ? event.raw.scanner_opportunity_id : event.id
      })
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      qualification_status?: QualificationState["status"];
      qualification_reason_code?: string | null;
      next_recommended_action?: string;
      proof_authenticity?: string;
      source_type?: string | null;
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      verification_status?: string | null;
      qualification_source?: string | null;
      qualification_notes?: string | null;
      qualified_at?: string | null;
      qualified_by?: string | null;
    };
    setSavingQualificationId(null);

    if (!res.ok) {
      showToast(data.error || "Could not save SDR qualification");
      return;
    }

    setQualificationByEventId((prev) => ({
      ...prev,
      [event.id]: {
        status: data.qualification_status || status,
        reasonCode: data.qualification_reason_code || (status === "rejected" ? "rejected_after_sdr_review" : "verified_contact_present"),
        nextRecommendedAction: data.next_recommended_action || (status === "rejected" ? "do_not_pursue" : "create_lead"),
        proofAuthenticity: data.proof_authenticity || String(event.raw?.proof_authenticity || "unknown"),
        sourceType: data.source_type || String(event.raw?.source_type || event.source || "scanner_signal"),
        contactName: data.contact_name || null,
        phone: data.phone || null,
        email: data.email || null,
        verificationStatus: data.verification_status || null,
        qualificationSource: data.qualification_source || qualificationSource,
        qualificationNotes: data.qualification_notes || notes,
        qualifiedAt: data.qualified_at || null,
        qualifiedBy: data.qualified_by || null
      }
    }));
    setReviewingQualificationId((current) => (current === event.id ? null : current));
    showToast(status === "rejected" ? "Signal marked do-not-pursue" : "Verified contact saved. This signal is ready for dispatch.");
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
    { id: "feed", label: "Signals", icon: Radar },
    { id: "sdr", label: "SDR Queue", icon: CheckCircle2 },
    { id: "rules", label: "Routing", icon: Settings2 }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Signal Command Center"
        subtitle="Tune the market, surface the strongest opportunities, and move only the verified contact paths worth working."
      />

      <section className="overflow-hidden rounded-[2.25rem] border border-semantic-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,246,242,0.92))] shadow-[0_24px_68px_rgba(30,42,36,0.12)]">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6 px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <p className="eyebrow">Live demand command center</p>
            <div className="space-y-4">
              <h2 className="display-title max-w-3xl text-semantic-text">
                Rank the market, surface the strongest opportunity, and hand off only the calls worth making.
              </h2>
              <p className="dashboard-body max-w-2xl text-semantic-muted">
                Scanner keeps the first look calm and decision-ready. Signals are ranked, verified, and routed so your team spends
                time on bookable work, not noisy records.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" data-testid="scanner-run" onClick={() => runScan(true)} disabled={loading} className="shadow-[0_16px_30px_rgba(29,78,216,0.18)]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Scan now
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setTab("feed")}>
                Signal queue
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setTab("sdr")}>
                SDR lane
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setTab("rules")}>
                Routing rules
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">{location}</Badge>
              <Badge variant="success">{triggerSummary || "All signals"}</Badge>
              <Badge variant={runtimeMode === "live-partial" ? "warning" : "default"}>
                {runtimeMode === "live-partial" ? "Partial live" : "Live"} scanning
              </Badge>
            </div>
          </div>

          <div className="border-t border-semantic-border/60 bg-white/78 px-6 py-6 lg:border-l lg:border-t-0 lg:px-6 lg:py-7">
            <div className="rounded-[1.65rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(229,236,251,0.12),rgba(255,255,255,0.96))] p-5 shadow-[0_18px_44px_rgba(16,24,40,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-semantic-muted">Command summary</p>
                <Badge variant={showingFirstScanGuide ? "brand" : "success"}>{showingFirstScanGuide ? "First run" : "Active scan"}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <ScannerMetric label="Active market" value={location} helper="Saved service area" />
                <ScannerMetric label="Signal mix" value={`${sourceMixCount} sources`} helper="Channels represented" />
                <ScannerMetric label="Queue depth" value={`${queueDepth} results`} helper="Opportunity candidates" />
                <ScannerMetric label="SDR queue" value={`${sdrQueuedEvents.length}`} helper="Needs verified contact" />
                <ScannerMetric
                  label="24h captured"
                  value={`${throughput?.captured_real_signals ?? 0}`}
                  helper="Real scanner signals captured"
                />
                <ScannerMetric
                  label="24h verified-ready"
                  value={`${throughput?.qualified_contactable_signals ?? 0}`}
                  helper="Signals with verified contactability"
                />
                <ScannerMetric
                  label="24h leads created"
                  value={`${throughput?.scanner_verified_leads_created ?? 0}`}
                  helper="Scanner-sourced verified leads"
                />
              </div>

              <div
                className={cn(
                  "mt-4 rounded-[1.35rem] border p-4",
                  throughputActionPlan.tone === "warning"
                    ? "border-amber-300/70 bg-[linear-gradient(120deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]"
                    : throughputActionPlan.tone === "success"
                      ? "border-emerald-200/80 bg-[linear-gradient(120deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))]"
                      : "border-semantic-border/60 bg-white/88"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Next action</p>
                  <Badge
                    variant={
                      throughputActionPlan.tone === "warning"
                        ? "warning"
                        : throughputActionPlan.tone === "success"
                          ? "success"
                          : "default"
                    }
                  >
                    {throughputActionPlan.badge}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold text-semantic-text">{throughputActionPlan.title}</p>
                  <p className="text-sm text-semantic-muted">{throughputActionPlan.body}</p>
                  <div className="space-y-2 pt-1">
                    {throughputActionPlan.steps.map((step) => (
                      <div key={step} className="flex items-start gap-2">
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                        <p className="text-sm text-semantic-text">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-semantic-border/60 bg-white/88 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Priority lead</p>
                  <Badge variant={priorityEvent ? sourceBadgeVariant(priorityEvent) : "default"}>
                    {priorityEvent ? recommendedActionLabel(priorityEvent.intent_score) : "Waiting for scan"}
                  </Badge>
                </div>
                {priorityEvent ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-semibold text-semantic-text">{priorityEvent.title}</p>
                    <p className="text-sm text-semantic-muted">{formatOpportunityAddress(priorityEvent, location)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="default">{freshnessLabel(priorityEvent.created_at)}</Badge>
                      <Badge variant="brand">{priorityEvent.intent_score} score</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-semibold text-semantic-text">Run the first scan to surface a buyer-ready opportunity.</p>
                    <p className="text-sm text-semantic-muted">
                      The command center will highlight the highest-confidence result and keep the next step obvious.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="eyebrow">Scan controls</p>
            <h3 className="section-title text-semantic-text">Tune the market before you scan</h3>
            <p className="dashboard-body max-w-2xl text-semantic-muted">
              Keep the service area, signal filters, and scan radius tight so the board stays close to the work your crews can actually take.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-semantic-border/60 bg-white/80 px-4 py-3 shadow-[0_12px_30px_rgba(31,42,36,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Current focus</p>
            <p className="mt-1 text-sm font-semibold text-semantic-text">{campaignOptions.find((option) => option.value === campaignMode)?.label}</p>
            <p className="mt-1 text-xs text-semantic-muted">Radius {radius} miles · {selectedTriggers.length} signals selected</p>
          </div>
        </div>

        {showingFirstScanGuide && (
          <div className="rounded-[1.25rem] border border-brand-500/20 bg-[linear-gradient(120deg,rgba(229,236,251,0.95),rgba(255,255,255,0.98))] px-4 py-4 text-sm text-semantic-text shadow-[0_12px_30px_rgba(16,24,40,0.06)]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-success-600" />
              <div className="space-y-2">
                <p className="font-semibold text-semantic-text">Service area saved. Now run your first scan.</p>
                <p className="text-semantic-muted">
                  This is the first-value step for pilots: pull in local demand, review the strongest opportunity, and create a verified lead only if it looks credible.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeWarnings.length > 0 && (
          <div className="rounded-[1.25rem] border border-amber-300/70 bg-[linear-gradient(120deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))] px-4 py-4 text-sm text-amber-900 shadow-[0_10px_24px_rgba(120,53,15,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Scanner warnings</p>
            <div className="mt-2 space-y-1.5">
              {activeWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr_120px_auto]">
          <label className="rounded-[1.35rem] border border-semantic-border/60 bg-white/84 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-semantic-muted">Market</span>
            <Input
              data-testid="scanner-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, state, or ZIP"
            />
          </label>

          <label className="rounded-[1.35rem] border border-semantic-border/60 bg-white/84 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-semantic-muted">Job type</span>
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
          </label>

          <label className="rounded-[1.35rem] border border-semantic-border/60 bg-white/84 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-semantic-muted">Radius</span>
            <Select data-testid="scanner-radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
              {["5", "10", "25", "50", "100"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>

          <div className="self-end rounded-[1.35rem] border border-semantic-border/60 bg-white/84 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
            <Button data-testid="scanner-run" onClick={() => runScan(true)} disabled={loading} fullWidth className="h-12 shadow-[0_16px_28px_rgba(29,78,216,0.16)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Scan now
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-[1.35rem] border border-semantic-border/60 bg-white/72 px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="rounded-[1.35rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(241,245,240,0.84))] p-4">
          <p className="text-sm font-semibold text-semantic-text">
            {campaignOptions.find((option) => option.value === campaignMode)?.helper}
          </p>
          <p className="mt-1 text-sm text-semantic-muted">
            We use your saved service area first so the jobs stay close to where your crews actually work.
          </p>
        </div>

        <details className="rounded-[1.35rem] border border-semantic-border/60 bg-white/72 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
          <summary className="cursor-pointer text-sm font-semibold text-semantic-text">More scan options</summary>
          <p className="mt-2 text-sm text-semantic-muted">Use these only if you need to fine-tune the scan.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px]">
            <label className="rounded-[1rem] border border-semantic-border/55 bg-white/80 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
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
                        "min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition",
                        active ? "bg-semantic-brand text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)]" : "bg-semantic-surface2 text-semantic-muted"
                      )}
                    >
                      {trigger.label}
                    </button>
                  );
                })}
              </div>
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-[1rem] border border-semantic-border/55 bg-white/80 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Lat</p>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.7812" />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Lon</p>
                <Input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-73.2462" />
              </div>
            </div>
            <label className="rounded-[1rem] border border-semantic-border/55 bg-white/80 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Coverage</span>
              <Select value={marketScope} onChange={(e) => setMarketScope(e.target.value as MarketScope)}>
                <option value="single">Single market</option>
                <option value="nyc_li_burst">NYC + LI burst</option>
              </Select>
            </label>
            <label className="rounded-[1rem] border border-semantic-border/55 bg-white/80 p-3 shadow-[0_8px_20px_rgba(31,42,36,0.04)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Results</span>
              <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
                {["20", "50", "80", "120", "200"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </details>
      </section>

      {tabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto rounded-[1.35rem] border border-semantic-border/60 bg-white/70 px-2 py-2 shadow-[0_12px_28px_rgba(31,42,36,0.05)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                  tab === item.id
                    ? "bg-semantic-brand text-white shadow-[0_10px_24px_rgba(29,78,216,0.18)]"
                    : "bg-semantic-surface2/80 text-semantic-muted hover:bg-semantic-surface"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {tab !== "rules" && (
        <section className="space-y-4">
          {!loading && visibleEvents.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[1.1rem] border border-semantic-border/60 bg-white/78 px-4 py-4 text-sm text-semantic-text shadow-[0_10px_24px_rgba(31,42,36,0.05)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">
                  {tab === "sdr" ? "SDR follow-up lane" : "Ranked queue"}
                </p>
                <p className="mt-1 text-sm font-semibold text-semantic-text">
                  {tab === "sdr"
                    ? `${visibleEvents.length} opportunities are waiting on verified contact before they can become leads or jobs.`
                    : `${visibleEvents.length} opportunities surfaced.`}
                  {tab === "sdr"
                    ? " Capture verified contact, then promote only the credible ones into dispatch."
                    : showingFirstScanGuide
                      ? " Work the strongest result first and create a verified lead only if you would actually call it."
                      : " Work the strongest result first and keep the queue moving."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tab === "sdr" ? (
                  <>
                    <Badge variant="brand">{visibleEvents.length} queued</Badge>
                    <Badge variant="default">{qualifiedDispatchableCount} ready to dispatch</Badge>
                  </>
                ) : (
                  <>
                    <Badge variant="brand">{highIntentCount} high intent</Badge>
                    <Badge variant="default">{sourceMixCount} sources</Badge>
                  </>
                )}
              </div>
            </div>
          )}

          {loading && (
            <Card className="border-semantic-border/55 bg-white/72 shadow-[0_16px_42px_rgba(31,42,36,0.06)]">
              <CardBody className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-brand-700" />
                  <div>
                    <p className="text-sm font-semibold text-semantic-text">Scanning live signals and local incident pressure...</p>
                    <p className="mt-1 text-sm text-semantic-muted">
                      We are ranking opportunities by confidence, freshness, and service area fit.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <Skeleton className="h-28 rounded-[1.1rem]" />
                  <Skeleton className="h-28 rounded-[1.1rem]" />
                  <Skeleton className="h-28 rounded-[1.1rem]" />
                </div>
              </CardBody>
            </Card>
          )}

          {!loading && visibleEvents.length === 0 && (
            <Card className="overflow-hidden border-semantic-border/55 bg-white/78 shadow-[0_18px_44px_rgba(31,42,36,0.07)]">
              <CardBody className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <p className="eyebrow">{tab === "sdr" ? "No SDR queue yet" : "No scan results yet"}</p>
                  <h3 className="section-title max-w-2xl text-semantic-text">
                    {tab === "sdr"
                      ? "No research-only opportunities are queued for SDR follow-up yet."
                      : showingFirstScanGuide
                        ? "Start with Tier 1 sources, then run the first live scan."
                        : "No live opportunities surfaced from this scan yet."}
                  </h3>
                  <p className="dashboard-body max-w-2xl text-semantic-muted">
                    {tab === "sdr"
                      ? "Next action: configure Tier 1 sources if the signal queue is still thin, run a burst scan when the local market is quiet, and send research-only opportunities here so SDR can verify a real phone or email before dispatch."
                      : showingFirstScanGuide
                        ? "Next action: confirm Tier 1 sources are active, run the first scan to surface storm damage and emergency demand, and route any research-only opportunities to SDR instead of trying to dispatch them."
                        : "Next action: confirm Tier 1 sources are active, run a burst scan if this market stays quiet, and route research-only opportunities to SDR before dispatch."}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {tab === "sdr" ? (
                      <>
                        <Button size="lg" variant="secondary" onClick={() => setTab("feed")}>
                          Open signal queue
                        </Button>
                        <Button size="lg" variant="ghost" onClick={() => setTab("rules")}>
                          Review routing
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="lg" onClick={() => runScan(true)} disabled={loading} className="shadow-[0_16px_30px_rgba(29,78,216,0.18)]">
                          <Sparkles className="h-4 w-4" />
                          Run scan
                        </Button>
                        <Button size="lg" variant="secondary" onClick={() => setTab("rules")}>
                          Review routing
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(229,236,251,0.12),rgba(255,255,255,0.96))] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-semantic-muted">Next actions</p>
                  <div className="mt-4 space-y-3">
                    {(
                      tab === "sdr"
                        ? [
                            ["1", "Configure Tier 1 sources", "Keep weather, incident, 311, permit, and other live-safe sources active so SDR is working real opportunities."],
                            ["2", "Run burst scan", "If the local queue is thin, widen coverage to NYC + LI burst and rescan for live demand."],
                            ["3", "Verify contact, then dispatch", "Research-only opportunities stay here until SDR verifies a real phone or email."]
                          ]
                        : [
                            ["1", "Configure Tier 1 sources", "Check Data Sources first so the scanner is pulling from live-safe feeds instead of a thin local queue."],
                            [
                              "2",
                              "Run burst scan",
                              marketScope === "nyc_li_burst"
                                ? "Burst coverage is already selected. Rerun the scan and review the strongest live opportunities first."
                                : "If a single-market scan stays quiet, switch to NYC + LI burst and rerun to widen coverage."
                            ],
                            ["3", "Route research-only to SDR", "Do not dispatch non-contactable opportunities. Queue them for SDR verification first."]
                          ]
                    ).map(([number, title, text]) => (
                      <div key={title} className="flex items-start gap-3 rounded-[1rem] border border-semantic-border/60 bg-white/84 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                          {number}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-semantic-text">{title}</p>
                          <p className="mt-1 text-sm text-semantic-muted">{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {visibleEvents.map((event, index) => {
            const nextAction = String(event.raw?.next_action || event.raw?.recommended_action || "Dispatch within SLA and send first contact.");
            const reasonDetails = getOpportunityReasonDetails(event);
            const displayAddress = formatOpportunityAddress(event, location);
            const addressParts = splitDisplayAddress(displayAddress);
            const bullets = opportunityBullets(reasonDetails);
            const enrichment = getEventEnrichment(event);
            const verifiedFromEnrichment = hasVerifiedOwnerContact(event.raw?.enrichment);
            const qualificationState = normalizeQualificationState(event, qualificationByEventId[event.id]);
            const hasDispatchableContact =
              verifiedFromEnrichment ||
              (qualificationState.status === "qualified_contactable" &&
                qualificationState.verificationStatus === "verified" &&
                Boolean(qualificationState.phone || qualificationState.email));
            const researchOnly = !hasDispatchableContact;
            const sdrQueued = qualificationState.status === "queued_for_sdr";
            const rejected = qualificationState.status === "rejected";
            const areaContext = [String(event.raw?.neighborhood || "").trim(), String(event.raw?.county || "").trim()].filter(Boolean).join(" · ");
            const primaryAction = getPrimaryAction(event.intent_score, showingFirstScanGuide);
            const isFeatured = index === 0;
            const isFocused = focusOpportunityId ? matchesFocusedOpportunity(event, focusOpportunityId) : false;
            const reviewOpen = reviewingQualificationId === event.id;
            const draft = qualificationDrafts[event.id] || buildQualificationDraft(qualificationState);

            return (
              <Card
                key={event.id}
                className={cn(
                  "overflow-hidden border-semantic-border/60 bg-white/84 shadow-[0_18px_44px_rgba(31,42,36,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(31,42,36,0.12)]",
                  isFeatured && "ring-1 ring-brand-300",
                  isFocused && "ring-2 ring-brand-500 shadow-[0_24px_60px_rgba(29,78,216,0.16)]"
                )}
                data-testid="scanner-result-card"
              >
                <CardBody className="grid gap-5 p-5 xl:grid-cols-[240px_1fr_240px] xl:items-stretch">
                  <OpportunityPropertyVisual event={event} address={displayAddress} addressLine={addressParts.streetLine} enrichment={enrichment} />

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={sourceBadgeVariant(event)}>{reasonDetails.signalSource}</Badge>
                        <Badge variant={addressQualityVariant(event)}>{addressQualityLabel(event)}</Badge>
                        <Badge variant="default">{freshnessLabel(event.created_at)}</Badge>
                        {isFeatured && <Badge variant="brand">Top result</Badge>}
                        {isFocused && <Badge variant="brand">Focused opportunity</Badge>}
                      </div>

                      <div className="space-y-2">
                        <p className="text-2xl font-semibold tracking-tight text-semantic-text">{event.title}</p>
                        <p className="inline-flex items-center gap-2 text-base font-medium text-semantic-text">
                          <MapPin className="h-4 w-4 text-brand-700" />
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

                      <div className="rounded-[1.25rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,248,244,0.92))] p-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-brand-700" />
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Why this lead matters</p>
                        </div>
                        <ul className="mt-3 grid gap-2 text-sm text-semantic-text">
                          {bullets.map((bullet, bulletIndex) => (
                            <li key={`${event.id}-reason-${bulletIndex}`} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-700" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {enrichment && (
                        <details className="rounded-[1.25rem] border border-semantic-border/60 bg-white/78 p-4">
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
                  </div>

                  <div className="rounded-[1.35rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,244,0.9))] p-4 xl:flex xl:flex-col xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Decision rail</p>
                        <Badge variant="brand">
                          {rejected ? "Rejected" : researchOnly ? (sdrQueued ? "Queued for SDR" : "Send to SDR") : primaryAction.label}
                        </Badge>
                      </div>
                      <Button
                        size="lg"
                        disabled={dispatchingId === event.id || rejected || sdrQueued}
                        onClick={() => {
                          if (researchOnly) {
                            if (sdrQueued) return;
                            void sendToSdr(event);
                            return;
                          }
                          void dispatchEvent(
                            event,
                            primaryAction.mode,
                            primaryAction.mode === "job" ? suggestedAssigneeForEvent(event, rules) : undefined
                          );
                        }}
                        className="w-full shadow-[0_16px_30px_rgba(29,78,216,0.16)]"
                      >
                        {dispatchingId === event.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : rejected ? (
                          <X className="h-4 w-4" />
                        ) : researchOnly ? (
                          <Settings2 className="h-4 w-4" />
                        ) : primaryAction.mode === "job" ? (
                          <BriefcaseBusiness className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {rejected
                          ? "Rejected"
                          : researchOnly
                            ? (sdrQueued ? "Queued for SDR" : "Send to SDR")
                            : showingFirstScanGuide
                              ? "Create First Lead"
                              : primaryAction.label}
                      </Button>
                      <p className="rounded-[1rem] border border-semantic-border/60 bg-white/82 px-4 py-3 text-sm text-semantic-text">
                        <span className="font-semibold">Next step:</span> {researchOnly ? qualificationState.nextRecommendedAction.replace(/_/g, " ") : nextAction}
                      </p>
                      <div className={`rounded-[1rem] border px-4 py-3 text-sm ${researchOnly ? "border-amber-300/70 bg-amber-50/80 text-amber-950" : "border-emerald-300/70 bg-emerald-50/80 text-emerald-950"}`}>
                        <p className="font-semibold">Qualification</p>
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                          <p>Contact status: {hasDispatchableContact ? "verified contactable" : sdrQueued ? "queued for SDR" : rejected ? "rejected" : "no verified contact"}</p>
                          <p>Verification: {(qualificationState.verificationStatus || (hasDispatchableContact ? "verified" : qualificationState.status)).replace(/_/g, " ")}</p>
                          <p>Blocked reason: {(qualificationState.reasonCode || "none").replace(/_/g, " ")}</p>
                          <p>Next allowed action: {qualificationState.nextRecommendedAction.replace(/_/g, " ")}</p>
                        </div>
                        {qualificationState.contactName || qualificationState.phone || qualificationState.email ? (
                          <div className="mt-3 rounded-[0.95rem] border border-current/10 bg-white/70 px-3 py-3 text-xs">
                            <p>Contact: {qualificationState.contactName || "Unknown contact"}</p>
                            <p className="mt-1">
                              {[qualificationState.phone, qualificationState.email].filter(Boolean).join(" · ") || "No verified channel saved"}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      {sdrQueued ? (
                        <div className="rounded-[1rem] border border-semantic-border/60 bg-white/82 p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={savingQualificationId === event.id}
                              onClick={() => openQualificationReview(event)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {reviewOpen ? "Editing qualification" : "Review qualification"}
                            </Button>
                            {tab !== "sdr" ? (
                              <Button size="sm" variant="ghost" onClick={() => setTab("sdr")}>
                                <ArrowRight className="h-4 w-4" />
                                Open SDR lane
                              </Button>
                            ) : null}
                          </div>
                          {reviewOpen ? (
                            <div className="mt-3 space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-semantic-muted">Contact name</span>
                                  <Input
                                    value={draft.contactName}
                                    onChange={(e) => updateQualificationDraft(event.id, { contactName: e.target.value })}
                                    placeholder="Decision maker or verified contact"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-semantic-muted">Verification</span>
                                  <Select
                                    value={draft.verificationStatus}
                                    onChange={(e) => updateQualificationDraft(event.id, { verificationStatus: e.target.value })}
                                  >
                                    <option value="verified">Verified</option>
                                    <option value="review">Needs review</option>
                                  </Select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-semantic-muted">Phone</span>
                                  <Input
                                    value={draft.phone}
                                    onChange={(e) => updateQualificationDraft(event.id, { phone: e.target.value })}
                                    placeholder="631-555-0199"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-semantic-muted">Email</span>
                                  <Input
                                    value={draft.email}
                                    onChange={(e) => updateQualificationDraft(event.id, { email: e.target.value })}
                                    placeholder="owner@example.com"
                                  />
                                </label>
                              </div>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-semantic-muted">Qualification source</span>
                                <Input
                                  value={draft.qualificationSource}
                                  onChange={(e) => updateQualificationDraft(event.id, { qualificationSource: e.target.value })}
                                  placeholder="sdr_follow_up_lane"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-semantic-muted">Notes</span>
                                <Textarea
                                  rows={3}
                                  value={draft.qualificationNotes}
                                  onChange={(e) => updateQualificationDraft(event.id, { qualificationNotes: e.target.value })}
                                  placeholder="Who we verified, what channel is real, and why this should move forward."
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" disabled={savingQualificationId === event.id} onClick={() => void submitQualification(event, "qualified_contactable")}>
                                  {savingQualificationId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                  Save qualified contact
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={savingQualificationId === event.id}
                                  onClick={() => void submitQualification(event, "rejected")}
                                >
                                  <X className="h-4 w-4" />
                                  Reject signal
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2">
                      {!researchOnly ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={dispatchingId === event.id}
                          onClick={() => dispatchEvent(event, "job", suggestedAssigneeForEvent(event, rules))}
                        >
                          {dispatchingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                          Assign technician
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setPreview(event)}>
                        <Eye className="h-4 w-4" />
                        View evidence
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {showingFirstScanGuide && isFeatured ? (
                      <div className="mt-3 rounded-[1rem] border border-brand-500/20 bg-[linear-gradient(120deg,rgba(229,236,251,0.95),rgba(255,255,255,0.98))] px-4 py-3 text-sm text-brand-800 shadow-[0_10px_24px_rgba(16,24,40,0.05)]">
                        <span className="font-semibold">First-run move:</span> review the top result, then create a lead only if this
                        is something your team would actually work.
                      </div>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </section>
      )}

      {tab === "rules" && (
        <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <Card className="border-semantic-border/55 bg-white/72">
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

          <Card className="border-semantic-border/55 bg-white/72">
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

function buildPublicPropertyImageUrl(lat?: number | null, lon?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const lng = Number(lon);
  const latitude = Number(lat);
  const span = 0.0022;
  const url = new URL("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export");
  url.searchParams.set("bbox", `${lng - span},${latitude - span},${lng + span},${latitude + span}`);
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "4326");
  url.searchParams.set("size", "640,420");
  url.searchParams.set("format", "jpg");
  url.searchParams.set("transparent", "false");
  url.searchParams.set("f", "image");
  return url.toString();
}

function fallbackEnrichmentFromEvent(event: ScannerEvent) {
  const address = String(event.raw?.property_address || "").trim();
  const city = String(event.raw?.property_city || "").trim();
  const state = String(event.raw?.property_state || "").trim();
  const postalCode = String(event.raw?.property_postal_code || "").trim();
  const propertyAddress = [address, city, [state, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (!propertyAddress) return null;

  return {
    provider: "Public signal context",
    simulated: false,
    propertyAddress,
    city,
    state,
    postalCode,
    neighborhood: String(event.raw?.neighborhood || city || "Service area"),
    propertyImageLabel: "USGS aerial image",
    propertyImageUrl: buildPublicPropertyImageUrl(event.lat, event.lon),
    propertyImageSource: event.lat != null && event.lon != null ? "USGS The National Map imagery" : "Property context unavailable",
    propertyValueEstimate: null,
    propertyValueVerification: "public-record",
    ownerContact: null,
    notes: ["Built from free public signal context because no richer enrichment record was stored with the event."]
  } satisfies EnrichmentRecord;
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
    <div className="overflow-hidden rounded-[1.65rem] border border-semantic-border/60 bg-[linear-gradient(180deg,rgba(229,236,251,0.12),rgba(255,255,255,0.98))] p-4 shadow-[0_12px_28px_rgba(16,24,40,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">
          {String(event.raw?.incident_type || categoryLabel[event.category])}
        </span>
        <span className="rounded-full border border-semantic-border/60 bg-white/75 px-3 py-1 text-xs font-semibold text-brand-700">
          {categoryLabel[event.category]}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-semantic-border/60 bg-white/80 p-3">
        <div className="relative h-40 overflow-hidden rounded-[1rem] bg-semantic-surface2">
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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,29,26,0.02),rgba(22,29,26,0.22))]" />
          <div className="absolute left-3 top-3 rounded-full bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
            {enrichment?.propertyImageLabel || "Property image"}
          </div>
          {enrichment?.ownerContact && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold text-white/88">
              {enrichment.ownerContact.confidenceLabel}
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-semantic-text">{addressLine}</p>
      <p className="mt-1 text-sm text-semantic-muted">{address}</p>
      {enrichment && (
        <div className="mt-4 grid gap-2 text-xs text-semantic-muted">
          <p>
            <span className="font-semibold text-semantic-text">Neighborhood:</span> {enrichment.neighborhood}
          </p>
          <p>
            <span className="font-semibold text-semantic-text">Value:</span> {enrichment.propertyValueEstimate || "Unavailable"}
          </p>
          <p>
            <span className="font-semibold text-semantic-text">Owner:</span> {enrichment.ownerContact?.name || "Unavailable"}
          </p>
          <p>
            <span className="font-semibold text-semantic-text">Image source:</span> {enrichment.propertyImageSource || "Placeholder"}
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

function getPrimaryAction(intentScore: number, onboardingMode?: boolean) {
  if (onboardingMode) {
    return {
      label: "Create lead",
      mode: "lead" as const,
      note: "First-run value comes from getting one credible lead into the queue."
    };
  }

  if (intentScore >= 82) {
    return {
      label: "Schedule inspection",
      mode: "job" as const,
      note: "High-confidence result. Move it toward a booked visit."
    };
  }

  return {
    label: "Create lead",
    mode: "lead" as const,
    note: "Keep the board moving and capture the opportunity in the queue."
  };
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
  if (enrichment && typeof enrichment === "object") return enrichment as EnrichmentRecord;
  return fallbackEnrichmentFromEvent(event);
}
