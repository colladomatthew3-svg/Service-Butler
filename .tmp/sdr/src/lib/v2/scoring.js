"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeOpportunityScores = computeOpportunityScores;
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(value)));
}
function toRevenueBand(score) {
    if (score >= 85)
        return "enterprise";
    if (score >= 70)
        return "high";
    if (score >= 45)
        return "medium";
    return "low";
}
function sourceUrgencyBoost(sourceType) {
    const normalized = sourceType.toLowerCase();
    if (normalized.includes("weather") || normalized.includes("incident"))
        return 14;
    if (normalized.includes("permit"))
        return 7;
    if (normalized.includes("social"))
        return 6;
    return 4;
}
function computeOpportunityScores(input) {
    const recencyScore = clamp(100 - Math.min(100, input.eventRecencyMinutes / 1.8));
    const severityScore = clamp(input.severity);
    const geographyScore = clamp(input.geographyMatch);
    const geographyPrecision = clamp(input.geographyPrecision ?? input.geographyMatch);
    const contactabilityScore = clamp(input.contactAvailability * 0.75 + input.priorCustomerMatch * 0.25);
    const signalAgreementScore = clamp(input.signalAgreement ?? Math.min(100, input.supportingSignalsCount * 16));
    const jobLikelihoodScore = clamp(severityScore * 0.24 +
        recencyScore * 0.19 +
        geographyScore * 0.14 +
        clamp(input.serviceLineFit) * 0.17 +
        clamp(input.propertyTypeFit) * 0.1 +
        clamp(input.supportingSignalsCount * 12) * 0.1 +
        clamp(input.priorCustomerMatch) * 0.06);
    const urgencyScore = clamp(severityScore * 0.42 +
        recencyScore * 0.3 +
        clamp(input.catastropheSignal) * 0.18 +
        sourceUrgencyBoost(input.sourceType));
    const catastropheLinkageScore = clamp(input.catastropheSignal * 0.8 + severityScore * 0.2);
    const sourceReliabilityScore = clamp(input.sourceReliability);
    const confidenceScore = clamp(sourceReliabilityScore * 0.35 +
        recencyScore * 0.2 +
        signalAgreementScore * 0.2 +
        geographyPrecision * 0.15 +
        severityScore * 0.1);
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
            confidence_score: confidenceScore
        }
    };
}
