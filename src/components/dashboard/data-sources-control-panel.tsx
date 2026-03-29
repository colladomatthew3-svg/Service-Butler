"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Play, PlusCircle, Radar, RefreshCw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { buildDataSourceReadinessState } from "@/lib/control-plane/readiness";
import type { DataSourceSummary, DataSourceTermsStatus, DataSourceStatus, IntegrationReadinessSummary, ReadinessState } from "@/lib/control-plane/types";

type DataSourceApiResponse = {
  sources: DataSourceSummary[];
  mode?: string;
};

type ActionResponse = {
  source?: DataSourceSummary;
  reason?: string;
  error?: string;
  readiness?: ReadinessState;
};

type DraftState = {
  name: string;
  status: Exclude<DataSourceStatus, "not_configured">;
  termsStatus: Exclude<DataSourceTermsStatus, "unknown">;
  reliability: string;
  provenance: string;
  configText: string;
};

export function DataSourcesControlPanel() {
  const [sources, setSources] = useState<DataSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [inlineReadiness, setInlineReadiness] = useState<Record<string, ReadinessState>>({});
  const { showToast } = useToast();

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedKey || source.catalogKey === selectedKey) || null,
    [selectedKey, sources]
  );

  const counts = useMemo(
    () => ({
      configured: sources.filter((source) => source.configured).length,
      fullyLive: sources.filter((source) => source.runtimeMode === "fully-live").length,
      partial: sources.filter((source) => source.runtimeMode === "live-partial").length,
      simulated: sources.filter((source) => source.runtimeMode === "simulated").length
    }),
    [sources]
  );

  const loadSources = useCallback(async (nextSelectedKey?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/data-sources", { cache: "no-store" });
      const data = (await res.json().catch(() => ({ sources: [] }))) as DataSourceApiResponse;
      if (!res.ok) throw new Error("Could not load data sources");
      setSources(data.sources || []);
      setInlineReadiness(
        Object.fromEntries(
          (data.sources || [])
            .map((source) => [source.id || source.catalogKey, buildDataSourceReadinessState(source)] as const)
            .filter(([, readiness]) => readiness.blockingIssues.length > 0)
        )
      );
      const selected = nextSelectedKey || selectedKey;
      if (selected) {
        const match = (data.sources || []).find((source) => source.id === selected || source.catalogKey === selected);
        if (match) setSelectedKey(match.id || match.catalogKey);
      } else if ((data.sources || []).length > 0) {
        const first = data.sources[0]!;
        setSelectedKey(first.id || first.catalogKey);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load data sources");
    } finally {
      setLoading(false);
    }
  }, [selectedKey, showToast]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (!selectedSource) {
      if (sources.length > 0 && !selectedKey) {
        setSelectedKey(sources[0]!.id || sources[0]!.catalogKey);
      }
      return;
    }

    setDraft({
      name: selectedSource.name,
      status: selectedSource.status === "not_configured" ? "active" : selectedSource.status,
      termsStatus: selectedSource.termsStatus === "unknown" ? "pending_review" : selectedSource.termsStatus,
      reliability: String(selectedSource.reliability),
      provenance: selectedSource.provenance || "",
      configText: JSON.stringify(selectedSource.config, null, 2)
    });
  }, [selectedKey, selectedSource, sources]);

  async function createSource(source: DataSourceSummary) {
    setBusyKey(source.catalogKey);
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          catalogKey: source.catalogKey
        })
      });
      const data = (await res.json().catch(() => ({}))) as ActionResponse;
      if (!res.ok) throw new Error(data.error || "Could not create data source");
      if (res.status === 202) {
        if (data.readiness) {
          setInlineReadiness((prev) => ({ ...prev, [source.catalogKey]: data.readiness! }));
        }
        showToast(data.reason || "Data source creation is unavailable in compat mode");
        return;
      }
      setInlineReadiness((prev) => {
        const next = { ...prev };
        delete next[source.catalogKey];
        delete next[data.source?.id || ""];
        return next;
      });
      showToast(`${source.name} added to the control plane`);
      await loadSources(data.source?.id || source.catalogKey);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create data source");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSource() {
    if (!selectedSource || !selectedSource.id || !draft) return;

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(draft.configText || "{}") as Record<string, unknown>;
    } catch {
      showToast("Configuration JSON is invalid");
      return;
    }

    setBusyKey(selectedSource.id);
    try {
      const res = await fetch(`/api/data-sources/${selectedSource.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          status: draft.status,
          termsStatus: draft.termsStatus,
          reliabilityScore: Number(draft.reliability || 0),
          provenance: draft.provenance,
          config
        })
      });
      const data = (await res.json().catch(() => ({}))) as ActionResponse;
      if (!res.ok) throw new Error(data.error || "Could not save data source");
      if (res.status === 202) {
        if (data.readiness) {
          setInlineReadiness((prev) => ({ ...prev, [selectedSource.id!]: data.readiness! }));
        }
        showToast(data.reason || "Data source updates are unavailable in compat mode");
        return;
      }
      setInlineReadiness((prev) => {
        const next = { ...prev };
        delete next[selectedSource.id!];
        return next;
      });
      showToast(`${draft.name} saved`);
      await loadSources(data.source?.id || selectedSource.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save data source");
    } finally {
      setBusyKey(null);
    }
  }

  async function runHealth(source: DataSourceSummary) {
    if (!source.id) return;
    setBusyKey(source.id);
    try {
      const res = await fetch(`/api/data-sources/${source.id}/health`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        health?: { detail?: string };
        detail?: string;
        reason?: string;
        error?: string;
        readiness?: ReadinessState;
      };
      if (!res.ok) {
        if (data.readiness) {
          setInlineReadiness((prev) => ({ ...prev, [source.id!]: data.readiness! }));
          showToast(data.reason || data.error || "Health probe blocked");
          return;
        }
        throw new Error(data.error || "Health probe failed");
      }
      if (res.status === 202) {
        if (data.readiness) {
          setInlineReadiness((prev) => ({ ...prev, [source.id!]: data.readiness! }));
        }
        showToast(data.reason || "Health probes are unavailable in compat mode");
        return;
      }
      if (data.readiness) {
        setInlineReadiness((prev) => ({ ...prev, [source.id!]: data.readiness! }));
      } else {
        setInlineReadiness((prev) => {
          const next = { ...prev };
          delete next[source.id!];
          return next;
        });
      }
      showToast(data.health?.detail || data.detail || "Health probe completed");
      await loadSources(source.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Health probe failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function runSource(source: DataSourceSummary) {
    if (!source.id) return;
    setBusyKey(source.id);
    try {
      const res = await fetch(`/api/data-sources/${source.id}/run`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        result?: { status?: string };
        run?: { status?: string };
        reason?: string;
        error?: string;
        readiness?: ReadinessState;
      };
      if (!res.ok) {
        if (data.readiness) {
          setInlineReadiness((prev) => ({ ...prev, [source.id!]: data.readiness! }));
          showToast(data.reason || data.error || "Connector run blocked");
          return;
        }
        throw new Error(data.error || "Connector run failed");
      }
      if (res.status === 202) {
        if (data.readiness) {
          setInlineReadiness((prev) => ({ ...prev, [source.id!]: data.readiness! }));
        }
        showToast(data.reason || "Connector runs are unavailable in compat mode");
        return;
      }
      if (data.readiness) {
        setInlineReadiness((prev) => ({ ...prev, [source.id!]: data.readiness! }));
      } else {
        setInlineReadiness((prev) => {
          const next = { ...prev };
          delete next[source.id!];
          return next;
        });
      }
      showToast(`Connector run ${(data.result?.status || data.run?.status || "completed").toString()}`);
      await loadSources(source.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Connector run failed");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Configured" value={String(counts.configured)} helper="Sources in this tenant control plane." />
        <SummaryTile label="Fully live" value={String(counts.fullyLive)} helper="Real public/live inputs ready to ingest." />
        <SummaryTile label="Live partial" value={String(counts.partial)} helper="Gated by terms, approval, or missing live config." />
        <SummaryTile label="Simulated" value={String(counts.simulated)} helper="Surfaced honestly, but not yet on a live feed." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Data Sources</p>
                <h2 className="mt-1 text-base font-semibold text-semantic-text">Restoration intelligence control plane</h2>
                <p className="mt-1 text-sm text-semantic-muted">
                  Every connector family is surfaced here, including simulated and partial sources, so operators and buyers see the true system state.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void loadSources(selectedSource?.id || selectedSource?.catalogKey)}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-36 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sources.map((source) => {
                  const selected = selectedSource?.id === source.id || selectedSource?.catalogKey === source.catalogKey;
                  const isBusy = busyKey === source.id || busyKey === source.catalogKey;
                  const sourceReadiness = inlineReadiness[source.id || source.catalogKey];
                  return (
                    <div
                      key={source.id || source.catalogKey}
                      className={`rounded-xl border p-4 transition ${
                        selected ? "border-brand-400 bg-brand-100/55" : "border-semantic-border bg-semantic-surface hover:border-brand-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-semantic-text">{source.name}</p>
                          <p className="mt-1 text-xs leading-5 text-semantic-muted">
                            {source.family} · {source.description}
                          </p>
                        </div>
                        <Badge variant={runtimeVariant(source.runtimeMode)}>{runtimeLabel(source.runtimeMode)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={source.configured ? "brand" : "default"}>{source.configured ? source.status : "Not configured"}</Badge>
                        <Badge variant={source.termsStatus === "approved" ? "success" : source.termsStatus === "blocked" ? "danger" : "warning"}>
                          {source.termsStatus.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-semantic-muted">
                        <div>
                          <p className="font-semibold text-semantic-text">{source.recordsCreated}</p>
                          <p>records created</p>
                        </div>
                        <div>
                          <p className="font-semibold text-semantic-text">{source.freshnessLabel}</p>
                          <p>latest event</p>
                        </div>
                      </div>
                      <ReadinessBanner readiness={sourceReadiness} compact />
                      <p className="mt-3 text-xs text-semantic-muted">{source.buyerReadinessNote}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={selected ? "secondary" : "ghost"}
                          onClick={() => setSelectedKey(source.id || source.catalogKey)}
                        >
                          {selected ? "Selected" : "Inspect"}
                        </Button>
                        {!source.configured ? (
                          <Button size="sm" onClick={() => void createSource(source)} disabled={isBusy}>
                            <PlusCircle className="h-4 w-4" />
                            Add source
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => void runHealth(source)} disabled={isBusy}>
                              <Activity className="h-4 w-4" />
                              Health
                            </Button>
                            <Button size="sm" onClick={() => void runSource(source)} disabled={isBusy}>
                              <Play className="h-4 w-4" />
                              Run now
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Selected Source</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">
              {selectedSource ? selectedSource.name : "Choose a source"}
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {!selectedSource || !draft ? (
              <p className="text-sm text-semantic-muted">Pick a source to inspect runtime mode, update config, or run a health probe.</p>
            ) : (
              <>
                <ReadinessBanner readiness={inlineReadiness[selectedSource.id || selectedSource.catalogKey]} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={draft.name} onChange={(event) => setDraft((prev) => prev ? { ...prev, name: event.target.value } : prev)} />
                  </Field>
                  <Field label="Runtime mode">
                    <div className="flex h-12 items-center rounded-[1.1rem] border border-semantic-border bg-semantic-surface px-4 text-sm text-semantic-text">
                      {runtimeLabel(selectedSource.runtimeMode)}
                    </div>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <Select
                      value={draft.status}
                      onChange={(event) => setDraft((prev) => prev ? { ...prev, status: event.target.value as DraftState["status"] } : prev)}
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="disabled">Disabled</option>
                    </Select>
                  </Field>
                  <Field label="Terms status">
                    <Select
                      value={draft.termsStatus}
                      onChange={(event) => setDraft((prev) => prev ? { ...prev, termsStatus: event.target.value as DraftState["termsStatus"] } : prev)}
                    >
                      <option value="approved">Approved</option>
                      <option value="restricted">Restricted</option>
                      <option value="pending_review">Pending review</option>
                      <option value="blocked">Blocked</option>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Reliability score">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.reliability}
                      onChange={(event) => setDraft((prev) => prev ? { ...prev, reliability: event.target.value } : prev)}
                    />
                  </Field>
                  <Field label="Provenance">
                    <Input value={draft.provenance} onChange={(event) => setDraft((prev) => prev ? { ...prev, provenance: event.target.value } : prev)} />
                  </Field>
                </div>
                <Field label="Configuration JSON">
                  <Textarea
                    rows={14}
                    value={draft.configText}
                    onChange={(event) => setDraft((prev) => prev ? { ...prev, configText: event.target.value } : prev)}
                    className="font-mono text-xs"
                  />
                </Field>
                <div className="rounded-xl border border-semantic-border bg-semantic-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Live requirements</p>
                  <div className="mt-3 space-y-2 text-sm text-semantic-text">
                    {selectedSource.liveRequirements.length > 0 ? (
                      selectedSource.liveRequirements.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <Radar className="mt-0.5 h-4 w-4 text-brand-700" />
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-semantic-muted">This source is ready without extra live prerequisites.</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSource.configured ? (
                    <>
                      <Button onClick={() => void saveSource()} disabled={busyKey === selectedSource.id}>
                        <Save className="h-4 w-4" />
                        Save source
                      </Button>
                      <Button variant="secondary" onClick={() => void runHealth(selectedSource)} disabled={busyKey === selectedSource.id}>
                        <Activity className="h-4 w-4" />
                        Health probe
                      </Button>
                      <Button onClick={() => void runSource(selectedSource)} disabled={busyKey === selectedSource.id}>
                        <Play className="h-4 w-4" />
                        Run source
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => void createSource(selectedSource)} disabled={busyKey === selectedSource.catalogKey}>
                      <PlusCircle className="h-4 w-4" />
                      Add this source
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ReadinessBanner({
  readiness,
  compact = false
}: {
  readiness?: ReadinessState;
  compact?: boolean;
}) {
  if (!readiness || readiness.blockingIssues.length === 0) return null;

  const issue = readiness.blockingIssues[0];
  const tone =
    issue.code === "not_live_in_environment" || issue.code === "blocked_by_terms"
      ? "border-rose-300/80 bg-rose-50/85 text-rose-950"
      : "border-amber-300/80 bg-amber-50/85 text-amber-950";

  return (
    <div className={`mt-3 rounded-[1rem] border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">{issue.code.replace(/_/g, " ")}</p>
      <p className={compact ? "mt-1 text-xs" : "mt-1"}>{issue.message}</p>
      {issue.detail ? <p className={compact ? "mt-1 text-xs opacity-90" : "mt-1 text-sm opacity-90"}>{issue.detail}</p> : null}
      {readiness.recommendedActions.length > 0 ? (
        <p className={compact ? "mt-2 text-xs opacity-90" : "mt-2 text-sm opacity-90"}>
          Next: {readiness.recommendedActions[0]}
        </p>
      ) : null}
    </div>
  );
}

function SummaryTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardBody className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
        <p className="mt-1.5 font-heading text-[1.55rem] font-semibold tracking-tight text-semantic-text">{value}</p>
        <p className="mt-1 text-xs text-semantic-muted">{helper}</p>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">{label}</span>
      {children}
    </label>
  );
}

function runtimeVariant(mode: DataSourceSummary["runtimeMode"]) {
  if (mode === "fully-live") return "success";
  if (mode === "live-partial") return "warning";
  return "default";
}

function runtimeLabel(mode: DataSourceSummary["runtimeMode"]) {
  if (mode === "fully-live") return "Fully live";
  if (mode === "live-partial") return "Live partial";
  return "Simulated";
}

export function IntegrationReadinessPanel() {
  const [summary, setSummary] = useState<IntegrationReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/health/production", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as IntegrationReadinessSummary | null;
        if (!res.ok && !data) throw new Error("Could not load readiness checks");
        setSummary(data);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Could not load readiness checks");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [showToast]);

  const checks = useMemo(() => {
    const supported = new Set([
      "v2_flags",
      "supabase",
      "supabase_env",
      "supabase_auth",
      "webhook_secret",
      "twilio",
      "hubspot",
      "smartlead",
      "inngest",
      "enrichment",
      "stripe",
      "territories",
      "data_sources",
      "service_area"
    ]);
    return (summary?.checks || []).filter((check) => supported.has(checkName(check)));
  }, [summary]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-semantic-muted">Integration Readiness</p>
            <h2 className="mt-1 text-base font-semibold text-semantic-text">Live-safe operating dependencies</h2>
            <p className="mt-1 text-sm text-semantic-muted">
              The buyer should see exactly which integrations are ready, safe, or still gated before real pilot traffic.
            </p>
          </div>
          <Badge variant={summary?.status === "pass" ? "success" : summary?.status === "warn" ? "warning" : "danger"}>
            {(summary?.status || "loading").toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20 w-full rounded-xl" />)
        ) : (
          checks.map((check) => (
            <div key={checkName(check)} className="rounded-xl border border-semantic-border bg-semantic-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-semantic-text">{labelForCheck(checkName(check))}</p>
                <Badge variant={check.status === "pass" ? "success" : check.status === "warn" ? "warning" : "danger"}>
                  {check.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-semantic-muted">{check.message}</p>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function labelForCheck(name: string) {
  const labels: Record<string, string> = {
    v2_flags: "V2 live path",
    supabase: "Supabase",
    supabase_env: "Supabase env",
    supabase_auth: "Supabase auth",
    webhook_secret: "Webhook secret",
    twilio: "Twilio",
    hubspot: "HubSpot",
    smartlead: "Smartlead",
    inngest: "Inngest",
    enrichment: "Enrichment provider",
    stripe: "Stripe",
    territories: "Territories",
    data_sources: "Active data sources",
    service_area: "Service area"
  };

  return labels[name] || name;
}

function checkName(check: { name?: string; key?: string }) {
  return String(check.name || check.key || "");
}
