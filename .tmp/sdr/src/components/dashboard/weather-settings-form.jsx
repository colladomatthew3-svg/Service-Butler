"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherSettingsForm = WeatherSettingsForm;
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const toast_1 = require("@/components/ui/toast");
const weather_ticker_1 = require("@/components/dashboard/weather-ticker");
const skeleton_1 = require("@/components/ui/skeleton");
function WeatherSettingsForm() {
    const [state, setState] = (0, react_1.useState)({
        city: "",
        stateCode: "",
        postalCode: "",
        lat: "",
        lng: ""
    });
    const [current, setCurrent] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const { showToast } = (0, toast_1.useToast)();
    (0, react_1.useEffect)(() => {
        async function load() {
            setLoading(true);
            try {
                const res = await fetch("/api/settings/weather");
                const data = (await res.json().catch(() => ({})));
                if (!res.ok)
                    throw new Error("settings unavailable");
                setCurrent(data);
                setState((prev) => ({
                    ...prev,
                    city: data.home_base_city || "",
                    stateCode: data.home_base_state || "",
                    postalCode: data.home_base_postal_code || "",
                    lat: data.weather_lat != null ? String(data.weather_lat) : "",
                    lng: data.weather_lng != null ? String(data.weather_lng) : ""
                }));
            }
            catch {
                setCurrent(null);
                showToast("Weather settings API unavailable in current mode");
            }
            finally {
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
            showToast(data.error || "Could not save location");
            return;
        }
        setCurrent(data);
        setSaving(false);
        showToast("Weather location saved");
    }
    if (loading) {
        return (<div className="space-y-3">
        <skeleton_1.Skeleton className="h-12 w-full"/>
        <skeleton_1.Skeleton className="h-12 w-full"/>
        <skeleton_1.Skeleton className="h-40 w-full"/>
      </div>);
    }
    return (<div className="space-y-5">
      <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-5">
        <p className="text-sm font-semibold text-semantic-text">Service area weather location</p>
        <p className="mt-1 text-sm text-semantic-muted">
          Save the city your crews actually serve so Scanner opportunities stay grounded in the same weather pressure,
          storm response, and service demand your team will act on.
        </p>
        {current?.weather_location_label && (<div className="mt-4 rounded-xl border border-semantic-border bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Current service area</p>
            <p data-testid="weather-current-location" className="mt-2 text-sm font-semibold text-semantic-text">
              {current.weather_location_label}
            </p>
          </div>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="City">
          <input_1.Input data-testid="weather-city" placeholder="Brentwood" value={state.city} onChange={(e) => setState((prev) => ({ ...prev, city: e.target.value }))}/>
        </Field>
        <Field label="State">
          <input_1.Input data-testid="weather-state" placeholder="NY" value={state.stateCode} onChange={(e) => setState((prev) => ({ ...prev, stateCode: e.target.value }))}/>
        </Field>
        <Field label="Postal code">
          <input_1.Input data-testid="weather-postal" placeholder="11717" value={state.postalCode} onChange={(e) => setState((prev) => ({ ...prev, postalCode: e.target.value }))}/>
        </Field>
      </div>

      <details className="rounded-xl border border-semantic-border bg-semantic-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-semantic-text">Advanced map pin (optional)</summary>
        <p className="mt-2 text-sm text-semantic-muted">
          Only use coordinates if you need precise routing around a large metro or coastal service area.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Latitude (optional)">
            <input_1.Input data-testid="weather-lat" placeholder="40.7812" value={state.lat} onChange={(e) => setState((prev) => ({ ...prev, lat: e.target.value }))}/>
          </Field>
          <Field label="Longitude (optional)">
            <input_1.Input data-testid="weather-lng" placeholder="-73.2462" value={state.lng} onChange={(e) => setState((prev) => ({ ...prev, lng: e.target.value }))}/>
          </Field>
        </div>
      </details>

      <button_1.Button data-testid="weather-save" size="lg" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save service area"}
      </button_1.Button>

      <weather_ticker_1.WeatherTicker lat={current?.weather_lat ?? null} lng={current?.weather_lng ?? null} locationLabel={current?.weather_location_label || [current?.home_base_city, current?.home_base_state].filter(Boolean).join(", ")}/>
    </div>);
}
function Field({ label, children }) {
    return (<label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-semantic-muted">{label}</span>
      {children}
    </label>);
}
