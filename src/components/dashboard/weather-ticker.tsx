"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CloudRain, CloudSun, ChevronRight, Droplets, Snowflake, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

type Forecast = {
  current: {
    temp: number;
    feelsLike?: number;
    windKph?: number;
    precipitationChance?: number;
    condition: string;
  };
  next6Hours: Array<{ time: string; temp: number; precipChance: number; condition: string }>;
  next5Days: Array<{ date: string; min: number; max: number; precipChance: number; condition: string }>;
};

export function WeatherTicker({
  lat,
  lng,
  compact,
  locationLabel
}: {
  lat?: number | null;
  lng?: number | null;
  compact?: boolean;
  locationLabel?: string | null;
}) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    if (lat == null || lng == null) return null;
    return `/api/weather?lat=${lat}&lng=${lng}`;
  }, [lat, lng]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!query) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(query);
        if (!res.ok) throw new Error("weather unavailable");
        const data = (await res.json()) as Forecast;
        if (!cancelled) setForecast(data);
      } catch {
        if (!cancelled) setForecast(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!query) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-semantic-muted">
            Add your service area to unlock weather-based demand signals for Scanner runs, urgency windows, and same-day dispatch planning.
          </p>
          {locationLabel && <p className="text-sm font-medium text-semantic-text">{locationLabel}</p>}
          <Link href="/dashboard/settings">
            <Button size="sm" variant="secondary">
              Set service area
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (loading || !forecast) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardBody>
      </Card>
    );
  }

  const impact = weatherImpact(forecast);
<<<<<<< ours
  const signals = buildWeatherSignals(forecast).slice(0, compact ? 2 : 3);
=======
>>>>>>> theirs
  const tickerItems = buildTickerItems({
    locationLabel,
    currentCondition: forecast.current.condition,
    currentTemp: forecast.current.temp,
    precipitationChance: forecast.current.precipitationChance,
    windKph: forecast.current.windKph,
    impact: impact.title
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
            {locationLabel && <p className="mt-1 text-sm text-semantic-muted">{locationLabel}</p>}
          </div>
          <BadgeStat icon={<TriangleAlert className="h-3 w-3" />} label={impact.title} />
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-semantic-surface p-2 text-brand-700 shadow-sm">
              <CloudSun className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-semantic-text">
                {forecast.current.temp}° <span className="text-base font-medium text-semantic-muted">{forecast.current.condition}</span>
              </p>
              <p className="text-xs text-semantic-muted">
                {forecast.current.feelsLike != null ? `Feels ${forecast.current.feelsLike}° · ` : ""}
                {forecast.current.windKph != null ? `Wind ${forecast.current.windKph} kph` : "Wind n/a"}
              </p>
            </div>
          </div>
          {forecast.current.precipitationChance != null && (
            <BadgeStat icon={<Droplets className="h-3 w-3" />} label={`Rain ${forecast.current.precipitationChance}%`} />
          )}
        </div>

<<<<<<< ours
        <div className="rounded-xl border border-semantic-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">What this means for dispatch</p>
          <p className="mt-2 text-sm text-semantic-text">{impact.detail}</p>
        </div>

=======
>>>>>>> theirs
        {compact && tickerItems.length > 0 && (
          <div className="weather-ticker-strip" aria-label="Weather ticker updates">
            <div className="weather-ticker-track">
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <span key={`${item}-${index}`} className="weather-ticker-item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

<<<<<<< ours
        <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "md:grid-cols-3"}`}>
          {signals.map((signal) => (
            <div key={signal.title} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
              <div className="flex items-center gap-2 text-brand-700">
                <signal.icon className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">{signal.title}</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-semantic-text">{signal.window}</p>
              <p className="mt-1 text-sm text-semantic-muted">{signal.detail}</p>
            </div>
          ))}
        </div>

=======
>>>>>>> theirs
        <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Short-term outlook</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {forecast.next6Hours.slice(0, 3).map((h) => (
              <div key={h.time} className="rounded-lg border border-semantic-border bg-semantic-surface px-3 py-2">
                <p className="text-xs font-semibold text-semantic-muted">{h.time}</p>
                <p className="text-sm font-semibold text-semantic-text">{h.temp}°</p>
                <p className="text-xs text-semantic-muted">{h.precipChance}% rain</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/scanner${locationLabel ? `?location=${encodeURIComponent(locationLabel)}` : ""}`}>
              <Button size="sm">
                Scan for Weather Opportunities
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            {compact && (
              <Link href="/dashboard/settings">
                <Button size="sm" variant="secondary">
                  Edit Service Area
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function buildTickerItems({
  locationLabel,
  currentCondition,
  currentTemp,
  precipitationChance,
  windKph,
  impact
}: {
  locationLabel?: string | null;
  currentCondition: string;
  currentTemp: number;
  precipitationChance?: number;
  windKph?: number;
  impact: string;
}) {
  const items = [
    locationLabel ? `Location: ${locationLabel}` : "Location: Service area",
    `Now: ${currentTemp}° and ${currentCondition}`,
    precipitationChance != null ? `Rain chance: ${precipitationChance}%` : null,
    windKph != null ? `Wind: ${windKph} kph` : null,
    `Demand signal: ${impact}`
  ].filter(Boolean);

  return items as string[];
}

function BadgeStat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-semantic-surface px-3 py-1 text-xs font-semibold text-semantic-muted ring-1 ring-inset ring-semantic-border">
      {icon}
      {label}
    </span>
  );
}

export function weatherImpact(forecast: Forecast) {
  const precip = forecast.current.precipitationChance ?? 0;
  const wind = forecast.current.windKph ?? 0;
  const nextWet = forecast.next6Hours.some((h) => h.precipChance >= 45);

  if (precip >= 55 || wind >= 30 || nextWet) {
    return {
      title: "High storm risk",
      detail: "Expect more urgent leak, roof, and outage calls. Keep same-day slots open."
    };
  }

  if (precip >= 30 || wind >= 20) {
    return {
      title: "Moderate weather pressure",
      detail: "Plan for slight volume lift and prioritize high-intent incoming leads."
    };
  }

  return {
    title: "Stable conditions",
    detail: "Good window for scheduled maintenance and lower-priority follow-up jobs."
  };
}

function buildWeatherSignals(forecast: Forecast) {
  const precip = forecast.current.precipitationChance ?? 0;
  const wind = forecast.current.windKph ?? 0;
  const tempLow = Math.min(...forecast.next5Days.map((day) => day.min));
  const nextWet = forecast.next6Hours.some((hour) => hour.precipChance >= 55);

  return [
    {
      title: "Storm risk",
      window: nextWet || wind >= 28 ? "Next 6 hours" : "Monitoring",
      detail: nextWet || wind >= 28 ? "Expect urgent leak and roof-response demand." : "No severe storm surge detected right now.",
      icon: CloudRain
    },
    {
      title: "Heavy rain",
      window: precip >= 45 ? "Today" : "Low pressure",
      detail: precip >= 45 ? "Water intrusion and plumbing calls should trend upward." : "Rain risk is present but not yet driving a volume spike.",
      icon: Droplets
    },
    {
      title: "Freeze alert",
      window: tempLow <= 34 ? "Overnight" : "Inactive",
      detail: tempLow <= 34 ? "Frozen pipe and no-heat urgency should increase." : "No freeze-driven service pressure in the current forecast.",
      icon: Snowflake
    }
  ];
}
