import type { V2OpportunityScoreVector, V2RevenueBand } from "@/lib/v2/types";
import {
  type FranchiseVertical,
  applyVerticalModifiers,
  getConnectorWeight,
} from "@/lib/v2/franchise-verticals";

type ScoreInput = {
  sourceType: string;
  eventRecencyMinutes: number;
  severity: number;
  geographyMatch: number;
  propertyTypeFit: number;
  serviceLineFit: number;
  priorCustomerMatch: number;
  contactAvailability: number;
  supportingSignalsCount: number;
  catastropheSignal: number;
  sourceReliability: number;
  signalAgreement?: number;
  geographyPrecision?: number;
  /** Optional: franchise vertical for vertical-aware scoring */
  vertical?: FranchiseVertical;
  /** Optional: signal category for preferred-signal boost */
  signalCategory?: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toRevenueBand(score: number): V2RevenueBand {
  if (score >= 85) return "enterprise";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function sourceUrgencyBoost(sourceType: string) {
  const normalized = sourceType.toLowerCase();
  if (normalized.includes("weather") || normalized.includes("incident")) return 14;
  if (normalized.includes("permit")) return 7;
  if (normalized.includes("social")) return 6;
  return 4;
}

export function computeOpportunityScores(input: ScoreInput): V2OpportunityScoreVector {
  // Apply connector-level weight from vertical before scoring
  const connectorWeight = input.vertical
    ? getConnectorWeight(input.vertical, input.sourceType)
    : 1.0;

  const adjustedSeverity = clamp(input.severity * connectorWeight);
  const recencyScore = clamp(100 - Math.min(100, input.eventRecencyMinutes / 1.8));
  const severityScore = clamp(adjustedSeverity + (input.vertical?.scoreModifiers.severityBoost ?? 0));
  const geographyScore = clamp(input.geographyMatch);
  const geographyPrecision = clamp(input.geographyPrecision ?? input.geographyMatch);
  const contactabilityScore = clamp(input.contactAvailability * 0.75 + input.priorCustomerMatch * 0.25);
  const signalAgreementScore = clamp(input.signalAgreement ?? Math.min(100, input.supportingSignalsCount * 16));

  const baseJobLikelihood = clamp(
    severityScore * 0.24 +
      recencyScore * 0.19 +
      geographyScore * 0.14 +
      clamp(input.serviceLineFit) * 0.17 +
      clamp(input.propertyTypeFit) * 0.1 +
      clamp(input.supportingSignalsCount * 12) * 0.1 +
      clamp(input.priorCustomerMatch) * 0.06
  );

  const baseUrgency = clamp(
    severityScore * 0.42 +
      recencyScore * 0.3 +
      clamp(input.catastropheSignal) * 0.18 +
      sourceUrgencyBoost(input.sourceType)
  );

  // Apply vertical modifiers (seasonal, preferred signal boost, multipliers)
  const verticalAdjusted = input.vertical
    ? applyVerticalModifiers(
        input.vertical,
        { urgencyScore: baseUrgency, jobLikelihoodScore: baseJobLikelihood, severityScore },
        { signalCategory: input.signalCategory }
      )
    : { urgencyScore: baseUrgency, jobLikelihoodScore: baseJobLikelihood, preferredSignal: false, seasonalMultiplier: 1.0 };

  const urgencyScore = verticalAdjusted.urgencyScore;
  const jobLikelihoodScore = verticalAdjusted.jobLikelihoodScore;

  const catastropheLinkageScore = clamp(input.catastropheSignal * 0.8 + severityScore * 0.2);
  const sourceReliabilityScore = clamp(input.sourceReliability);
  const confidenceScore = clamp(
    sourceReliabilityScore * 0.35 +
      recencyScore * 0.2 +
      signalAgreementScore * 0.2 +
      geographyPrecision * 0.15 +
      severityScore * 0.1
  );

  const blendedRevenueSignal = clamp(jobLikelihoodScore * 0.62 + urgencyScore * 0.18 + contactabilityScore * 0.2);

  return {
    urgencyScore,
    jobLikelihoodScore,
    contactabilityScore,
    sourceReliabilityScore,
    revenueBand: toRevenueBand(blendedRevenueSignal),
    catastropheLinkageScore,
    confidenceScore,
    explainability: {
      source_type: input.sourceType,
      event_recency_minutes: input.eventRecencyMinutes,
      severity: severityScore,
      geography_match: geographyScore,
      geography_precision: geographyPrecision,
      property_type_fit: clamp(input.propertyTypeFit),
      service_line_fit: clamp(input.serviceLineFit),
      prior_customer_match: clamp(input.priorCustomerMatch),
      contact_availability: clamp(input.contactAvailability),
      supporting_signals_count: input.supportingSignalsCount,
      catastrophe_signal: clamp(input.catastropheSignal),
      signal_agreement: signalAgreementScore,
      confidence_score: confidenceScore,
      // Vertical context for explainability
      vertical_key: input.vertical?.key ?? null,
      connector_weight: connectorWeight,
      preferred_signal: verticalAdjusted.preferredSignal,
      seasonal_multiplier: verticalAdjusted.seasonalMultiplier,
    }
  };
}
