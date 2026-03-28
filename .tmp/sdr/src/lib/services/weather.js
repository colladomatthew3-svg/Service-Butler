"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getForecastByLatLng = getForecastByLatLng;
exports.geocodeLocation = geocodeLocation;
const review_mode_1 = require("@/lib/services/review-mode");
const cache = new Map();
const TEN_MINUTES = 10 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 8_000;
function envTrue(value) {
    if (!value)
        return false;
    return ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());
}
function shouldUseDemoWeatherMode() {
    return (0, review_mode_1.isDemoMode)() && !envTrue(process.env.SB_FORCE_LIVE_WEATHER_IN_DEMO);
}
const DEMO_LOCATION_MAP = {
    "11717": { label: "Brentwood, NY 11717", lat: 40.7812, lng: -73.2462 },
    "11705": { label: "Bayport, NY 11705", lat: 40.7384, lng: -73.0518 },
    "11788": { label: "Hauppauge, NY 11788", lat: 40.8257, lng: -73.2026 },
    "10019": { label: "Midtown West, NY 10019", lat: 40.7654, lng: -73.9858 },
    "33602": { label: "Tampa, FL 33602", lat: 27.9506, lng: -82.4572 },
    "brentwood,ny": { label: "Brentwood, NY 11717", lat: 40.7812, lng: -73.2462 },
    "bay shore,ny": { label: "Bay Shore, NY 11706", lat: 40.7251, lng: -73.2454 },
    "hauppauge,ny": { label: "Hauppauge, NY 11788", lat: 40.8257, lng: -73.2026 },
    "tampa,fl": { label: "Tampa, FL 33602", lat: 27.9506, lng: -82.4572 },
    "tampa,fl,33602": { label: "Tampa, FL 33602", lat: 27.9506, lng: -82.4572 }
};
function cacheKey(lat, lng) {
    return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}
function conditionLabel(weatherCode) {
    if (weatherCode == null)
        return "Unknown";
    if (weatherCode === 0)
        return "Clear";
    if ([1, 2].includes(weatherCode))
        return "Partly cloudy";
    if (weatherCode === 3)
        return "Overcast";
    if ([45, 48].includes(weatherCode))
        return "Fog";
    if ([51, 53, 55, 56, 57].includes(weatherCode))
        return "Drizzle";
    if ([61, 63, 65, 66, 67].includes(weatherCode))
        return "Rain";
    if ([71, 73, 75, 77].includes(weatherCode))
        return "Snow";
    if ([80, 81, 82].includes(weatherCode))
        return "Rain showers";
    if ([95, 96, 99].includes(weatherCode))
        return "Thunderstorm";
    return "Cloudy";
}
function hourLabel(iso, timezone) {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        timeZone: timezone || undefined
    });
}
function dayLabel(iso, timezone) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: timezone || undefined
    });
}
async function fetchWithTimeout(url, timeoutMs = WEATHER_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { cache: "no-store", signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
function boundedNumber(value, fallback = 0) {
    return Number.isFinite(value) ? Number(value) : fallback;
}
function staleCachedForecast(lat, lng) {
    const cached = cache.get(cacheKey(lat, lng));
    if (!cached)
        return null;
    return {
        ...cached.value,
        meta: {
            ...cached.value.meta,
            stale: true
        }
    };
}
function forecastStartIndex(hourlyTimes, currentTime) {
    if (!currentTime)
        return 0;
    const exactIndex = hourlyTimes.findIndex((time) => time === currentTime);
    if (exactIndex >= 0)
        return exactIndex;
    const currentMs = new Date(currentTime).getTime();
    if (!Number.isFinite(currentMs))
        return 0;
    const nextIndex = hourlyTimes.findIndex((time) => new Date(time).getTime() >= currentMs);
    return nextIndex >= 0 ? nextIndex : 0;
}
function deterministicUnit(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
function buildDemoForecast(lat, lng) {
    const seed = Math.round((lat + 90) * 1000 + (lng + 180) * 1000);
    const currentTemp = Math.round(48 + deterministicUnit(seed) * 28);
    const currentPrecip = Math.round(18 + deterministicUnit(seed + 2) * 68);
    const currentWind = Math.round(8 + deterministicUnit(seed + 3) * 30);
    const condition = currentPrecip >= 60 ? "Rain showers" : currentWind >= 24 ? "Windy" : "Partly cloudy";
    return {
        meta: {
            provider: "demo",
            timezone: "America/New_York",
            timezoneAbbreviation: "ET",
            updatedAt: new Date().toISOString(),
            stale: false
        },
        location: { lat, lng },
        current: {
            temp: currentTemp,
            feelsLike: currentTemp - (currentWind >= 24 ? 3 : 1),
            windKph: currentWind,
            precipitationChance: currentPrecip,
            condition
        },
        next6Hours: Array.from({ length: 6 }, (_, index) => ({
            time: hourLabel(new Date(Date.now() + index * 60 * 60 * 1000).toISOString()),
            temp: currentTemp + Math.round(deterministicUnit(seed + index + 10) * 6) - 3,
            precipChance: Math.max(5, Math.min(95, currentPrecip + Math.round(deterministicUnit(seed + index + 20) * 26) - 13)),
            condition: index <= 2 && currentPrecip >= 50 ? "Rain" : index >= 4 ? "Clearing" : condition
        })),
        next5Days: Array.from({ length: 5 }, (_, index) => ({
            date: dayLabel(new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString()),
            min: currentTemp - 8 + index,
            max: currentTemp + 2 + index,
            precipChance: Math.max(10, Math.min(90, currentPrecip - 10 + index * 6)),
            condition: index === 0 && currentPrecip >= 55 ? "Rain showers" : index === 1 ? "Cloudy" : "Partly cloudy"
        }))
    };
}
function normalizeDemoQuery(query) {
    return query.toLowerCase().replace(/\s+/g, "").replace(/,+/g, ",");
}
function hashQuery(query) {
    let hash = 0;
    for (let i = 0; i < query.length; i += 1) {
        hash = (hash << 5) - hash + query.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
async function getForecastByLatLng(lat, lng, options) {
    if (!options?.forceLive && shouldUseDemoWeatherMode()) {
        return buildDemoForecast(lat, lng);
    }
    const key = cacheKey(lat, lng);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now)
        return cached.value;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m");
    url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,wind_speed_10m");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("forecast_days", "6");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("temperature_unit", "fahrenheit");
    let response;
    try {
        response = await fetchWithTimeout(url.toString());
    }
    catch {
        const stale = staleCachedForecast(lat, lng);
        if (stale)
            return stale;
        throw new Error("Failed to fetch weather forecast");
    }
    if (!response.ok) {
        const stale = staleCachedForecast(lat, lng);
        if (stale)
            return stale;
        throw new Error("Failed to fetch weather forecast");
    }
    const json = (await response.json());
    const timezone = String(json.timezone || "").trim() || undefined;
    const timezoneAbbreviation = String(json.timezone_abbreviation || "").trim() || undefined;
    const current = json.current ?? {
        time: json.hourly.time[0],
        interval: 1,
        temperature_2m: json.hourly.temperature_2m[0]
    };
    const hourlyStart = forecastStartIndex(json.hourly.time, current.time);
    const next6Hours = json.hourly.time.slice(hourlyStart, hourlyStart + 6).map((time, offset) => {
        const index = hourlyStart + offset;
        return {
            time: hourLabel(time, timezone),
            temp: Math.round(boundedNumber(json.hourly.temperature_2m[index])),
            precipChance: Math.round(boundedNumber(json.hourly.precipitation_probability[index])),
            condition: conditionLabel(json.hourly.weather_code[index])
        };
    });
    const next5Days = json.daily.time.slice(0, 5).map((date, index) => ({
        date: dayLabel(date, timezone),
        min: Math.round(boundedNumber(json.daily.temperature_2m_min[index])),
        max: Math.round(boundedNumber(json.daily.temperature_2m_max[index])),
        precipChance: Math.round(boundedNumber(json.daily.precipitation_probability_max[index])),
        condition: conditionLabel(json.daily.weather_code[index])
    }));
    const summary = {
        meta: {
            provider: "open-meteo",
            timezone,
            timezoneAbbreviation,
            updatedAt: new Date().toISOString(),
            stale: false
        },
        location: { lat, lng },
        current: {
            temp: Math.round(boundedNumber(current.temperature_2m)),
            feelsLike: current.apparent_temperature != null ? Math.round(current.apparent_temperature) : undefined,
            windKph: current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) : undefined,
            precipitationChance: current.precipitation_probability != null ? Math.round(current.precipitation_probability) : undefined,
            condition: conditionLabel(current.weather_code)
        },
        next6Hours,
        next5Days
    };
    cache.set(key, { value: summary, expiresAt: now + TEN_MINUTES });
    return summary;
}
async function geocodeLocation(query) {
    if (shouldUseDemoWeatherMode()) {
        const normalized = normalizeDemoQuery(query);
        const mapped = DEMO_LOCATION_MAP[normalized];
        if (mapped)
            return mapped;
        const digits = query.match(/\b\d{5}\b/)?.[0];
        if (digits && DEMO_LOCATION_MAP[digits])
            return DEMO_LOCATION_MAP[digits];
        const seed = hashQuery(normalized || query);
        const lat = 28 + (seed % 1500) / 100;
        const lng = -(81 + (seed % 900) / 100);
        return {
            label: query.trim() || "Demo Service Area",
            lat: Number(lat.toFixed(4)),
            lng: Number(lng.toFixed(4))
        };
    }
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok)
        throw new Error("Failed to geocode location");
    const json = (await response.json());
    const hit = json.results?.[0];
    if (!hit)
        return null;
    return {
        label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
        lat: hit.latitude,
        lng: hit.longitude
    };
}
