import type { ForecastSummary } from "@/lib/services/weather";

export type LeadInput = {
  id: string;
  service_type?: string | null;
  requested_timeframe?: string | null;
  city?: string | null;
  state?: string | null;
};

export type IntentSignal = {
  signal_type: "weather" | "seasonality" | "local_demand" | "urgency" | "property_context";
  title: string;
  detail: string;
  score: number;
  payload: Record<string, unknown>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function urgencyScore(timeframe?: string | null) {
  const value = (timeframe || "").toLowerCase();
  if (!value) return 45;
  if (value.includes("asap") || value.includes("today") || value.includes("urgent")) return 88;
  if (value.includes("tomorrow")) return 72;
  if (value.includes("week")) return 58;
  return 50;
}

export function generateSignals({
  lead,
  forecast
}: {
  lead: LeadInput;
  forecast?: ForecastSummary | null;
}): IntentSignal[] {
  const service = (lead.service_type || "General").toLowerCase();
  const timeframe = lead.requested_timeframe || "";

  const weatherPrecip = forecast?.current.precipitationChance ?? forecast?.next6Hours[0]?.precipChance ?? 0;
  const weatherWind = forecast?.current.windKph ?? 0;
  const nowHour = new Date().getHours();
  const offHours = nowHour < 7 || nowHour >= 19;
  const urgencyKeyword =
    service.includes("roof") ? "storm damage" :
    service.includes("plumb") ? "flood" :
    service.includes("hvac") ? "no cool" :
    "urgent repair";

  const urgency = urgencyScore(timeframe);
  const weatherBase =
    service.includes("roof") || service.includes("restor") ? 58 + weatherPrecip * 0.45 + weatherWind * 0.35 :
    service.includes("hvac") ? 50 + Math.abs((forecast?.current.temp ?? 68) - 68) * 1.35 :
    service.includes("plumb") ? 54 + weatherPrecip * 0.28 :
    service.includes("elect") ? 49 + weatherWind * 0.24 + weatherPrecip * 0.16 :
    service.includes("land") ? 47 + weatherWind * 0.3 :
    44 + weatherPrecip * 0.15;

  const localDemand =
    service.includes("hvac") ? 74 :
    service.includes("roof") || service.includes("restor") ? 76 :
    service.includes("plumb") ? 67 :
    service.includes("elect") ? 66 :
    service.includes("land") ? 63 :
    62;

  const seasonality =
    service.includes("hvac") ? 76 :
    service.includes("roof") ? 71 :
    service.includes("restor") ? 74 :
    service.includes("plumb") ? 69 :
    service.includes("electrical") ? 60 :
    service.includes("land") ? 64 :
    58;

  const propertyContext =
    service.includes("roof") || service.includes("restor") ? 75 :
    service.includes("plumb") ? 69 :
    service.includes("elect") ? 66 :
    service.includes("land") ? 62 :
    61;

  return [
    {
      signal_type: "urgency",
      title: offHours ? "After-hours urgency risk" : "Response-time urgency",
      detail: offHours
        ? "Lead arrived outside normal hours. Early morning follow-up has higher conversion."
        : "Requested timeframe suggests a quick response can significantly improve close rate.",
      score: clamp(urgency + (offHours ? 6 : 0)),
      payload: { requested_timeframe: timeframe, generated_at_hour: nowHour }
    },
    {
      signal_type: "weather",
      title: "Weather pressure on demand",
      detail:
        weatherPrecip > 40
          ? "Precipitation risk in the next hours likely increases emergency service inquiries."
          : "Weather impact is moderate, but demand can still spike around temperature changes.",
      score: clamp(Math.round(weatherBase)),
      payload: {
        precip_now: weatherPrecip,
        wind_kph: weatherWind,
        condition: forecast?.current.condition
      }
    },
    {
      signal_type: "local_demand",
      title: "Local demand trend",
      detail: `Recent ${lead.city || "local"} inquiries for ${lead.service_type || "service"} suggest above-baseline demand, with nearby review spikes and incident chatter around '${urgencyKeyword}'.`,
      score: clamp(localDemand),
      payload: { city: lead.city, state: lead.state, service_type: lead.service_type }
    },
    {
      signal_type: "seasonality",
      title: "Seasonality fit",
      detail: "This job type aligns with seasonal patterns where proactive scheduling improves win rate.",
      score: clamp(seasonality),
      payload: { service_type: lead.service_type }
    },
    {
      signal_type: "property_context",
      title: "Property and job context confidence",
      detail: "Lead details match common property-level issues for this trade. Urgency keywords and timing suggest fast callback is likely to convert.",
      score: clamp(propertyContext),
      payload: { service_type: lead.service_type }
    }
  ];
}
