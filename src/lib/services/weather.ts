type CachedEntry<T> = {
  expiresAt: number;
  value: T;
};

type ForecastResponse = {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current?: {
    time: string;
    interval: number;
    temperature_2m: number;
    apparent_temperature?: number;
    precipitation_probability?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

export type ForecastSummary = {
  location: { lat: number; lng: number };
  current: {
    temp: number;
    feelsLike?: number;
    windKph?: number;
    precipitationChance?: number;
    condition: string;
  };
  next6Hours: Array<{
    time: string;
    temp: number;
    precipChance: number;
    condition: string;
  }>;
  next5Days: Array<{
    date: string;
    min: number;
    max: number;
    precipChance: number;
    condition: string;
  }>;
};

const cache = new Map<string, CachedEntry<ForecastSummary>>();
const TEN_MINUTES = 10 * 60 * 1000;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function conditionLabel(weatherCode?: number) {
  if (weatherCode == null) return "Unknown";
  if (weatherCode === 0) return "Clear";
  if ([1, 2].includes(weatherCode)) return "Partly cloudy";
  if (weatherCode === 3) return "Overcast";
  if ([45, 48].includes(weatherCode)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return "Rain";
  if ([71, 73, 75, 77].includes(weatherCode)) return "Snow";
  if ([80, 81, 82].includes(weatherCode)) return "Rain showers";
  if ([95, 96, 99].includes(weatherCode)) return "Thunderstorm";
  return "Cloudy";
}

function hourLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export async function getForecastByLatLng(lat: number, lng: number): Promise<ForecastSummary> {
  const key = cacheKey(lat, lng);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("forecast_days", "6");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch weather forecast");
  const json = (await response.json()) as ForecastResponse;

  const current = json.current ?? {
    time: json.hourly.time[0],
    interval: 1,
    temperature_2m: json.hourly.temperature_2m[0]
  };

  const next6Hours = json.hourly.time.slice(0, 6).map((time, index) => ({
    time: hourLabel(time),
    temp: Math.round(json.hourly.temperature_2m[index]),
    precipChance: Math.round(json.hourly.precipitation_probability[index] ?? 0),
    condition: conditionLabel(json.hourly.weather_code[index])
  }));

  const next5Days = json.daily.time.slice(0, 5).map((date, index) => ({
    date: dayLabel(date),
    min: Math.round(json.daily.temperature_2m_min[index]),
    max: Math.round(json.daily.temperature_2m_max[index]),
    precipChance: Math.round(json.daily.precipitation_probability_max[index] ?? 0),
    condition: conditionLabel(json.daily.weather_code[index])
  }));

  const summary: ForecastSummary = {
    location: { lat, lng },
    current: {
      temp: Math.round(current.temperature_2m),
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

export async function geocodeLocation(query: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to geocode location");
  const json = (await response.json()) as {
    results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }>;
  };

  const hit = json.results?.[0];
  if (!hit) return null;
  return {
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    lat: hit.latitude,
    lng: hit.longitude
  };
}
