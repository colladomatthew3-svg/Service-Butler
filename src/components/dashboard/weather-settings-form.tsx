"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { WeatherTicker } from "@/components/dashboard/weather-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

type WeatherSettings = {
  weather_location_label?: string | null;
  weather_lat?: number | null;
  weather_lng?: number | null;
  home_base_city?: string | null;
  home_base_state?: string | null;
  home_base_postal_code?: string | null;
};

export function WeatherSettingsForm() {
  const [state, setState] = useState({
    city: "",
    stateCode: "",
    postalCode: "",
    lat: "",
    lng: ""
  });
  const [current, setCurrent] = useState<WeatherSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasServiceArea = Boolean(current?.weather_location_label);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings/weather");
        const data = (await res.json().catch(() => ({}))) as WeatherSettings;
        if (!res.ok) throw new Error("settings unavailable");
        setCurrent(data);
        setState((prev) => ({
          ...prev,
          city: data.home_base_city || "",
          stateCode: data.home_base_state || "",
          postalCode: data.home_base_postal_code || "",
          lat: data.weather_lat != null ? String(data.weather_lat) : "",
          lng: data.weather_lng != null ? String(data.weather_lng) : ""
        }));
      } catch {
        setCurrent(null);
        showToast("Weather settings API unavailable in current mode");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/weather", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        city: state.city,
        state: state.stateCode,
        postalCode: state.postalCode,
        lat: state.lat ? Number(state.lat) : undefined,
        lng: state.lng ? Number(state.lng) : undefined
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      showToast((data as { error?: string }).error || "Could not save location");
      return;
    }
    setCurrent(data);
    setSaving(false);
    showToast("Service area saved. Run your first scan next.");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.1rem] border border-brand-500/20 bg-[linear-gradient(120deg,rgba(229,236,251,0.96),rgba(255,255,255,0.96))] p-5 shadow-[0_14px_34px_rgba(16,24,40,0.07)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center rounded-full border border-brand-500/20 bg-white/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
              First-run setup
            </p>
            <p className="mt-3 text-sm font-semibold text-semantic-text">
              {hasServiceArea ? "Service area saved. Your next move is the scanner." : "Start here: set the service area your crews actually cover."}
            </p>
            <p className="mt-1 text-sm text-semantic-muted">
              Save the city your crews actually serve so Scanner opportunities stay grounded in the same weather pressure, storm response,
              and service demand your team will act on.
            </p>
          </div>
          <div className="rounded-[1rem] border border-semantic-border/60 bg-white/72 px-4 py-3 text-sm text-semantic-text">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Next up</p>
            <p className="mt-1 font-semibold">{hasServiceArea ? "Run your first scan" : "Save the service area"}</p>
          </div>
        </div>
        {hasServiceArea && (
          <div className="mt-4 rounded-[1rem] border border-semantic-border bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Current service area</p>
            <p data-testid="weather-current-location" className="mt-2 text-sm font-semibold text-semantic-text">
              {current?.weather_location_label}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="City">
          <Input
            data-testid="weather-city"
            placeholder="Brentwood"
            value={state.city}
            onChange={(e) => setState((prev) => ({ ...prev, city: e.target.value }))}
          />
        </Field>
        <Field label="State">
          <Input
            data-testid="weather-state"
            placeholder="NY"
            value={state.stateCode}
            onChange={(e) => setState((prev) => ({ ...prev, stateCode: e.target.value }))}
          />
        </Field>
        <Field label="Postal code">
          <Input
            data-testid="weather-postal"
            placeholder="11717"
            value={state.postalCode}
            onChange={(e) => setState((prev) => ({ ...prev, postalCode: e.target.value }))}
          />
        </Field>
      </div>

      <details className="rounded-xl border border-semantic-border bg-semantic-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-semantic-text">Advanced map pin (optional)</summary>
        <p className="mt-2 text-sm text-semantic-muted">
          Only use coordinates if you need precise routing around a large metro or coastal service area.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Latitude (optional)">
            <Input
              data-testid="weather-lat"
              placeholder="40.7812"
              value={state.lat}
              onChange={(e) => setState((prev) => ({ ...prev, lat: e.target.value }))}
            />
          </Field>
          <Field label="Longitude (optional)">
            <Input
              data-testid="weather-lng"
              placeholder="-73.2462"
              value={state.lng}
              onChange={(e) => setState((prev) => ({ ...prev, lng: e.target.value }))}
            />
          </Field>
        </div>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button data-testid="weather-save" size="lg" onClick={save} disabled={saving} fullWidth>
          {saving ? "Saving..." : "Save service area"}
        </Button>
        <Link
          href="/dashboard/scanner?onboarding=first-scan"
          className="inline-flex h-14 items-center justify-center rounded-[1rem] border border-semantic-border/80 bg-white/75 px-7 text-base font-semibold tracking-[0.01em] text-semantic-text shadow-[0_8px_24px_rgba(31,43,37,0.08)] transition hover:bg-semantic-surface2 sm:min-w-[12rem]"
        >
          Run first scan
        </Link>
      </div>

      <div className="rounded-[1rem] border border-semantic-border/60 bg-white/78 p-4 shadow-[0_10px_24px_rgba(31,42,36,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">First-value path</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StepCard number="1" title="Set service area" text="Ground demand in the market your crews actually cover." complete={hasServiceArea} />
          <StepCard number="2" title="Save defaults" text="Keep weather and routing aligned to that market." complete={hasServiceArea} />
          <StepCard number="3" title="Run first scan" text="Move straight into the scanner and work the first lead." href="/dashboard/scanner?onboarding=first-scan" />
        </div>
      </div>

      <WeatherTicker
        lat={current?.weather_lat ?? null}
        lng={current?.weather_lng ?? null}
        locationLabel={current?.weather_location_label || [current?.home_base_city, current?.home_base_state].filter(Boolean).join(", ")}
      />
    </div>
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

function StepCard({
  number,
  title,
  text,
  complete,
  href
}: {
  number: string;
  title: string;
  text: string;
  complete?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            complete ? "bg-success-100 text-success-700" : "bg-semantic-surface2 text-semantic-muted"
          }`}
        >
          {number}
        </span>
        <p className="text-sm font-semibold text-semantic-text">{title}</p>
      </div>
      <p className="mt-2 text-sm text-semantic-muted">{text}</p>
    </>
  );

  const className =
    "rounded-[1rem] border border-semantic-border/60 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
