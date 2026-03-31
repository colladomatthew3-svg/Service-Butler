"use client";

/**
 * OpportunityScoreExplainer
 *
 * Renders a human-readable breakdown of WHY an opportunity scored the way it
 * did. Reads the explainability_json from the V2 scoring engine and shows:
 *   - Top contributing factors
 *   - Vertical-specific context (connector weight, preferred signal, seasonal)
 *   - Score sub-components with visual bars
 */

import { FRANCHISE_VERTICALS, type FranchiseVerticalKey } from "@/lib/v2/franchise-verticals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScoreExplainability = {
  source_type?: string | null;
  event_recency_minutes?: number | null;
  severity?: number | null;
  geography_match?: number | null;
  geography_precision?: number | null;
  property_type_fit?: number | null;
  service_line_fit?: number | null;
  prior_customer_match?: number | null;
  contact_availability?: number | null;
  supporting_signals_count?: number | null;
  catastrophe_signal?: number | null;
  signal_agreement?: number | null;
  confidence_score?: number | null;
  // Vertical context
  vertical_key?: string | null;
  connector_weight?: number | null;
  preferred_signal?: boolean | null;
  seasonal_multiplier?: number | null;
};

type ScoreVector = {
  urgencyScore?: number | null;
  jobLikelihoodScore?: number | null;
  contactabilityScore?: number | null;
  sourceReliabilityScore?: number | null;
  catastropheLinkageScore?: number | null;
  confidenceScore?: number | null;
  revenueBand?: string | null;
};

type Props = {
  explainability: ScoreExplainability | Record<string, unknown> | null | undefined;
  scores?: ScoreVector;
  compact?: boolean;
  className?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatRecency(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function formatSourceType(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  return raw
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type ScoreTier = "high" | "medium" | "low";

function scoreTier(score: number): ScoreTier {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const TIER_COLORS: Record<ScoreTier, string> = {
  high:   "bg-emerald-500",
  medium: "bg-amber-400",
  low:    "bg-zinc-400",
};

const TIER_TEXT: Record<ScoreTier, string> = {
  high:   "text-emerald-700 dark:text-emerald-400",
  medium: "text-amber-700 dark:text-amber-400",
  low:    "text-zinc-500",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const tier = scoreTier(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-zinc-500 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${TIER_COLORS[tier]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-7 text-right font-mono font-semibold ${TIER_TEXT[tier]}`}>{value}</span>
    </div>
  );
}

function Pill({ children, variant = "neutral" }: { children: React.ReactNode; variant?: "good" | "warn" | "neutral" }) {
  const cls = {
    good:    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    warn:    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    neutral: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
  }[variant];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border font-medium ${cls}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OpportunityScoreExplainer({ explainability, scores, compact = false, className = "" }: Props) {
  const ex = (explainability ?? {}) as ScoreExplainability;

  const severity    = toNum(ex.severity);
  const recency     = toNum(ex.event_recency_minutes);
  const geoMatch    = toNum(ex.geography_match);
  const svcFit      = toNum(ex.service_line_fit);
  const propFit     = toNum(ex.property_type_fit);
  const signals     = toNum(ex.supporting_signals_count);
  const catSignal   = toNum(ex.catastrophe_signal);
  const contactAvail = toNum(ex.contact_availability);
  const confidence  = toNum(ex.confidence_score ?? scores?.confidenceScore);

  const verticalKey = ex.vertical_key as FranchiseVerticalKey | null;
  const vertical = verticalKey && verticalKey in FRANCHISE_VERTICALS ? FRANCHISE_VERTICALS[verticalKey] : null;
  const connectorWeight = Number(ex.connector_weight ?? 1.0);
  const preferredSignal = Boolean(ex.preferred_signal);
  const seasonalMultiplier = Number(ex.seasonal_multiplier ?? 1.0);

  // Build a ranked list of top contributing factors
  const factors: { label: string; value: number; impact: "positive" | "negative" | "neutral" }[] = [];

  if (severity > 0)    factors.push({ label: "Event severity", value: severity, impact: severity >= 60 ? "positive" : "neutral" });
  if (recency > 0) {
    const recencyScore = Math.max(0, Math.min(100, Math.round(100 - recency / 1.8)));
    factors.push({ label: "Signal freshness", value: recencyScore, impact: recencyScore >= 60 ? "positive" : recencyScore < 30 ? "negative" : "neutral" });
  }
  if (geoMatch > 0)    factors.push({ label: "Territory match", value: geoMatch, impact: geoMatch >= 70 ? "positive" : "neutral" });
  if (svcFit > 0)      factors.push({ label: "Service line fit", value: svcFit, impact: svcFit >= 70 ? "positive" : "neutral" });
  if (catSignal > 0)   factors.push({ label: "Catastrophe signal", value: catSignal, impact: "positive" });
  if (contactAvail > 0) factors.push({ label: "Contact availability", value: contactAvail, impact: contactAvail >= 60 ? "positive" : "negative" });
  if (signals > 0) {
    const signalScore = Math.min(100, signals * 16);
    factors.push({ label: `${signals} corroborating signal${signals !== 1 ? "s" : ""}`, value: signalScore, impact: signals >= 3 ? "positive" : "neutral" });
  }

  // Sort by value descending, keep top 4
  factors.sort((a, b) => b.value - a.value);
  const topFactors = factors.slice(0, 4);

  if (compact) {
    return (
      <div className={`text-xs text-zinc-500 space-y-1 ${className}`}>
        {vertical && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Pill variant="neutral">{vertical.displayName}</Pill>
            {preferredSignal && <Pill variant="good">Preferred signal</Pill>}
            {seasonalMultiplier > 1.05 && <Pill variant="good">Peak season ×{seasonalMultiplier.toFixed(2)}</Pill>}
            {connectorWeight > 1.1 && (
              <Pill variant="good">Weight ×{connectorWeight.toFixed(1)}</Pill>
            )}
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap">
          {topFactors.slice(0, 3).map((f) => (
            <Pill key={f.label} variant={f.impact === "positive" ? "good" : f.impact === "negative" ? "warn" : "neutral"}>
              {f.label}
            </Pill>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Score bars */}
      {scores && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Score Breakdown</p>
          {scores.urgencyScore != null && (
            <ScoreBar label="Urgency" value={toNum(scores.urgencyScore)} />
          )}
          {scores.jobLikelihoodScore != null && (
            <ScoreBar label="Job likelihood" value={toNum(scores.jobLikelihoodScore)} />
          )}
          {scores.contactabilityScore != null && (
            <ScoreBar label="Contactability" value={toNum(scores.contactabilityScore)} />
          )}
          {scores.sourceReliabilityScore != null && (
            <ScoreBar label="Source reliability" value={toNum(scores.sourceReliabilityScore)} />
          )}
          {confidence > 0 && (
            <ScoreBar label="Confidence" value={confidence} />
          )}
        </div>
      )}

      {/* Top factors */}
      {topFactors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Why this score</p>
          <div className="space-y-1">
            {topFactors.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-xs">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    f.impact === "positive" ? "bg-emerald-500" :
                    f.impact === "negative" ? "bg-amber-400" :
                    "bg-zinc-300"
                  }`}
                />
                <span className="text-zinc-600 dark:text-zinc-400">{f.label}</span>
                <span className={`ml-auto font-mono font-semibold ${TIER_TEXT[scoreTier(f.value)]}`}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal metadata */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Signal Context</p>
        <div className="space-y-1.5 text-xs">
          {ex.source_type && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Source</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {formatSourceType(ex.source_type)}
              </span>
            </div>
          )}
          {recency > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Signal age</span>
              <span className={`font-medium ${recency < 120 ? "text-emerald-600 dark:text-emerald-400" : recency > 1440 ? "text-amber-500" : "text-zinc-700 dark:text-zinc-300"}`}>
                {formatRecency(recency)}
              </span>
            </div>
          )}
          {propFit > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Property type fit</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{propFit}/100</span>
            </div>
          )}
        </div>
      </div>

      {/* Vertical context */}
      {vertical && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Franchise Vertical</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill variant="neutral">{vertical.displayName}</Pill>
            {preferredSignal && (
              <Pill variant="good">Preferred signal +6</Pill>
            )}
            {seasonalMultiplier > 1.05 && (
              <Pill variant="good">Peak season ×{seasonalMultiplier.toFixed(2)}</Pill>
            )}
            {seasonalMultiplier < 0.95 && (
              <Pill variant="warn">Off-peak ×{seasonalMultiplier.toFixed(2)}</Pill>
            )}
            {connectorWeight > 1.1 && (
              <Pill variant="good">Connector ×{connectorWeight.toFixed(1)}</Pill>
            )}
            {connectorWeight < 0.9 && (
              <Pill variant="warn">Connector ×{connectorWeight.toFixed(1)}</Pill>
            )}
          </div>
        </div>
      )}

      {/* Revenue band */}
      {scores?.revenueBand && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-500">Revenue band</span>
          <Pill
            variant={
              scores.revenueBand === "enterprise" || scores.revenueBand === "high" ? "good" :
              scores.revenueBand === "medium" ? "warn" : "neutral"
            }
          >
            {String(scores.revenueBand).toUpperCase()}
          </Pill>
        </div>
      )}
    </div>
  );
}
