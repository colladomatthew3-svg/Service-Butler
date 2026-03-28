"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherTicker = WeatherTicker;
exports.weatherImpact = weatherImpact;
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const card_1 = require("@/components/ui/card");
const skeleton_1 = require("@/components/ui/skeleton");
const button_1 = require("@/components/ui/button");
function WeatherTicker({ lat, lng, compact, locationLabel }) {
    const [forecast, setForecast] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [refreshTick, setRefreshTick] = (0, react_1.useState)(0);
    const query = (0, react_1.useMemo)(() => {
        if (lat == null || lng == null)
            return null;
        return `/api/weather?lat=${lat}&lng=${lng}`;
    }, [lat, lng]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        async function load() {
            if (!query) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(query);
                if (!res.ok)
                    throw new Error("Weather feed unavailable");
                const data = (await res.json());
                if (!cancelled)
                    setForecast(data);
            }
            catch {
                if (!cancelled) {
                    setForecast(null);
                    setError("Weather feed is temporarily unavailable.");
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [query, refreshTick]);
    if (!query) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
        </card_1.CardHeader>
        <card_1.CardBody className="space-y-3">
          <p className="text-sm text-semantic-muted">
            Add your service area to unlock weather-based demand signals for Scanner runs, urgency windows, and same-day dispatch planning.
          </p>
          {locationLabel && <p className="text-sm font-medium text-semantic-text">{locationLabel}</p>}
          <link_1.default href="/dashboard/settings">
            <button_1.Button size="sm" variant="secondary">
              Set service area
              <lucide_react_1.ChevronRight className="h-4 w-4"/>
            </button_1.Button>
          </link_1.default>
        </card_1.CardBody>
      </card_1.Card>);
    }
    if (loading) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
        </card_1.CardHeader>
        <card_1.CardBody className="space-y-3">
          <skeleton_1.Skeleton className="h-12 w-3/4"/>
          <skeleton_1.Skeleton className="h-16 w-full"/>
          <skeleton_1.Skeleton className="h-16 w-full"/>
        </card_1.CardBody>
      </card_1.Card>);
    }
    if (!forecast) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
        </card_1.CardHeader>
        <card_1.CardBody className="space-y-3">
          <p className="text-sm text-semantic-muted">{error || "Weather feed unavailable."}</p>
          <div className="flex flex-wrap gap-2">
            <button_1.Button size="sm" onClick={() => setRefreshTick((v) => v + 1)}>
              Retry weather
            </button_1.Button>
            <link_1.default href="/dashboard/settings">
              <button_1.Button size="sm" variant="secondary">
                Verify service area
              </button_1.Button>
            </link_1.default>
          </div>
        </card_1.CardBody>
      </card_1.Card>);
    }
    const impact = weatherImpact(forecast);
    const signals = buildWeatherSignals(forecast).slice(0, compact ? 2 : 3);
    const tickerItems = buildTickerItems({
        locationLabel,
        currentCondition: forecast.current.condition,
        currentTemp: forecast.current.temp,
        precipitationChance: forecast.current.precipitationChance,
        windKph: forecast.current.windKph,
        impact: impact.title
    });
    return (<card_1.Card className="overflow-hidden">
      <card_1.CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-semantic-text">Weather Watch</h3>
            {locationLabel && <p className="mt-1 text-sm text-semantic-muted">{locationLabel}</p>}
            {forecast.meta?.updatedAt && (<p className="mt-1 text-xs text-semantic-muted">
                {forecast.meta.provider === "demo" ? "Demo weather model" : "Live weather feed"}
                {" · "}
                Updated {formatUpdatedAt(forecast.meta.updatedAt)}
                {forecast.meta.timezoneAbbreviation ? ` · ${forecast.meta.timezoneAbbreviation}` : ""}
                {forecast.meta.stale ? " · using recent cached data" : ""}
              </p>)}
          </div>
          <BadgeStat icon={<lucide_react_1.TriangleAlert className="h-3 w-3"/>} label={impact.title}/>
        </div>
      </card_1.CardHeader>
      <card_1.CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-semantic-surface p-2 text-brand-700 shadow-sm">
              <lucide_react_1.CloudSun className="h-5 w-5"/>
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
          {forecast.current.precipitationChance != null && (<BadgeStat icon={<lucide_react_1.Droplets className="h-3 w-3"/>} label={`Rain ${forecast.current.precipitationChance}%`}/>)}
        </div>

        <div className="rounded-xl border border-semantic-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">What this means for dispatch</p>
          <p className="mt-2 text-sm text-semantic-text">{impact.detail}</p>
        </div>
        {compact && tickerItems.length > 0 && (<div className="weather-ticker-strip" aria-label="Weather ticker updates">
            <div className="weather-ticker-track">
              {[...tickerItems, ...tickerItems].map((item, index) => (<span key={`${item}-${index}`} className="weather-ticker-item">
                  {item}
                </span>))}
            </div>
          </div>)}

        <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "md:grid-cols-3"}`}>
          {signals.map((signal) => (<div key={signal.title} className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
              <div className="flex items-center gap-2 text-brand-700">
                <signal.icon className="h-4 w-4"/>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">{signal.title}</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-semantic-text">{signal.window}</p>
              <p className="mt-1 text-sm text-semantic-muted">{signal.detail}</p>
            </div>))}
        </div>
        <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Short-term outlook</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {forecast.next6Hours.slice(0, 3).map((h) => (<div key={h.time} className="rounded-lg border border-semantic-border bg-semantic-surface px-3 py-2">
                <p className="text-xs font-semibold text-semantic-muted">{h.time}</p>
                <p className="text-sm font-semibold text-semantic-text">{h.temp}°</p>
                <p className="text-xs text-semantic-muted">{h.precipChance}% rain</p>
              </div>))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
          <div className="flex flex-wrap gap-2">
            <link_1.default href={`/dashboard/scanner${locationLabel ? `?location=${encodeURIComponent(locationLabel)}` : ""}`}>
              <button_1.Button size="sm">
                Scan for Weather Opportunities
                <lucide_react_1.ChevronRight className="h-4 w-4"/>
              </button_1.Button>
            </link_1.default>
            {compact && (<link_1.default href="/dashboard/settings">
                <button_1.Button size="sm" variant="secondary">
                  Edit Service Area
                </button_1.Button>
              </link_1.default>)}
          </div>
        </div>
      </card_1.CardBody>
    </card_1.Card>);
}
function buildTickerItems({ locationLabel, currentCondition, currentTemp, precipitationChance, windKph, impact }) {
    const items = [
        locationLabel ? `Location: ${locationLabel}` : "Location: Service area",
        `Now: ${currentTemp}° and ${currentCondition}`,
        precipitationChance != null ? `Rain chance: ${precipitationChance}%` : null,
        windKph != null ? `Wind: ${windKph} kph` : null,
        `Demand signal: ${impact}`
    ].filter(Boolean);
    return items;
}
function formatUpdatedAt(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return "just now";
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function BadgeStat({ icon, label }) {
    return (<span className="inline-flex items-center gap-1 rounded-full bg-semantic-surface px-3 py-1 text-xs font-semibold text-semantic-muted ring-1 ring-inset ring-semantic-border">
      {icon}
      {label}
    </span>);
}
function weatherImpact(forecast) {
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
function buildWeatherSignals(forecast) {
    const precip = forecast.current.precipitationChance ?? 0;
    const wind = forecast.current.windKph ?? 0;
    const tempLow = Math.min(...forecast.next5Days.map((day) => day.min));
    const nextWet = forecast.next6Hours.some((hour) => hour.precipChance >= 55);
    return [
        {
            title: "Storm risk",
            window: nextWet || wind >= 28 ? "Next 6 hours" : "Monitoring",
            detail: nextWet || wind >= 28 ? "Expect urgent leak and roof-response demand." : "No severe storm surge detected right now.",
            icon: lucide_react_1.CloudRain
        },
        {
            title: "Heavy rain",
            window: precip >= 45 ? "Today" : "Low pressure",
            detail: precip >= 45 ? "Water intrusion and plumbing calls should trend upward." : "Rain risk is present but not yet driving a volume spike.",
            icon: lucide_react_1.Droplets
        },
        {
            title: "Freeze alert",
            window: tempLow <= 34 ? "Overnight" : "Inactive",
            detail: tempLow <= 34 ? "Frozen pipe and no-heat urgency should increase." : "No freeze-driven service pressure in the current forecast.",
            icon: lucide_react_1.Snowflake
        }
    ];
}
