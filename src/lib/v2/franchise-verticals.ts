/**
 * Franchise Vertical Profiles
 *
 * Defines signal weighting, connector preferences, and scoring modifiers
 * for each franchise category. This lets the platform serve Servpro-style
 * restoration operators, Mosquito Joe-style pest control operators, and
 * ReBath-style home services operators from a single engine.
 */

export type FranchiseVerticalKey = "restoration" | "pest_control" | "home_services" | "multi_line";

export type ConnectorWeights = {
  weather?: number;
  permit?: number;
  incident?: number;
  usgs_water?: number;
  fema?: number;
  social?: number;
  open311?: number;
  census?: number;
  overpass?: number;
};

export type SeasonalProfile = {
  /** 0-indexed months that are peak season (0=Jan ... 11=Dec) */
  peakMonths: number[];
  /** Score multiplier during peak season (1.0 = neutral) */
  peakMultiplier: number;
  /** Score multiplier during off-season */
  offPeakMultiplier: number;
};

export type VerticalScoreModifiers = {
  /** Flat points added to severity score (can be negative) */
  severityBoost: number;
  /** Flat points added to urgency score */
  urgencyBoost: number;
  /** Multiplier on job-likelihood score */
  jobLikelihoodMultiplier: number;
  /** Minimum urgency score to flag as high-intent */
  highIntentThreshold: number;
  /** Minimum job-likelihood score to auto-qualify without SDR review */
  autoQualifyThreshold: number;
};

export type FranchiseVertical = {
  key: FranchiseVerticalKey;
  displayName: string;
  brandExamples: string[];
  description: string;
  /**
   * Service lines this vertical covers. Used to filter/prioritize connector
   * signals that match these lines.
   */
  primaryServiceLines: string[];
  /**
   * Which signal/event categories from connectors are high-value for this
   * vertical. Signals not in this list are still accepted but scored lower.
   */
  preferredSignalCategories: string[];
  /**
   * Connector weight overrides. Values >1.0 amplify that connector's
   * contribution to the score; <1.0 suppresses it.
   * Default weight for unlisted connectors is 1.0.
   */
  connectorWeights: ConnectorWeights;
  /** Seasonal scoring adjustments */
  seasonalProfile: SeasonalProfile;
  /** Score modifiers applied after base scoring */
  scoreModifiers: VerticalScoreModifiers;
  /**
   * Deduplication window in hours per source type.
   * Within this window, a second signal for the same address+service_line
   * will be merged into the existing opportunity rather than creating a new one.
   */
  dedupWindowHours: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Restoration (Servpro, ServiceMaster, Rainbow Restoration, Paul Davis)
// ---------------------------------------------------------------------------
const RESTORATION: FranchiseVertical = {
  key: "restoration",
  displayName: "Restoration & Remediation",
  brandExamples: ["Servpro", "ServiceMaster Restore", "Rainbow Restoration", "Paul Davis Restoration"],
  description:
    "Water damage, fire & smoke damage, mold remediation, and storm restoration. High urgency — customers need response within hours, not days.",
  primaryServiceLines: ["restoration", "general", "plumbing"],
  preferredSignalCategories: [
    // Weather events
    "hail",
    "flood",
    "storm",
    "freeze",
    "wind",
    "weather",
    // Incident categories
    "fire_incident",
    "water_incident",
    "emergency_incident",
    "emergency_response",
    // USGS / FEMA
    "usgs_stream_gauge",
    "fema_disaster",
    "flood_incident",
    // Permits
    "remediation_repair",
    "roof",
    "plumbing",
  ],
  connectorWeights: {
    weather: 1.6,    // storms are primary lead trigger
    incident: 1.5,   // fire/water incidents are immediate
    usgs_water: 1.4, // rising water levels = imminent flood damage
    fema: 1.3,       // disaster declarations unlock insurance-funded jobs
    open311: 1.1,
    permit: 0.9,     // permits are lagging signal (job already started)
    social: 0.8,
    census: 0.5,
    overpass: 0.6,
  },
  seasonalProfile: {
    // Spring thaw (Feb-Apr) + hurricane/storm season (Aug-Oct) are peaks
    peakMonths: [1, 2, 3, 7, 8, 9],
    peakMultiplier: 1.25,
    offPeakMultiplier: 0.9,
  },
  scoreModifiers: {
    severityBoost: 8,         // restoration events are inherently urgent
    urgencyBoost: 10,
    jobLikelihoodMultiplier: 1.15,
    highIntentThreshold: 60,  // flag as high-intent at lower threshold (time-sensitive)
    autoQualifyThreshold: 82, // very high bar — restoration jobs are high-value
  },
  dedupWindowHours: {
    weather: 6,      // storm events move fast; 6h window to merge dupes
    incident: 12,
    usgs_water: 8,
    fema: 48,
    permit: 168,
    social: 4,
    default: 12,
  },
};

// ---------------------------------------------------------------------------
// Pest Control (Mosquito Joe, Orkin, Terminix, Mosquito Shield)
// ---------------------------------------------------------------------------
const PEST_CONTROL: FranchiseVertical = {
  key: "pest_control",
  displayName: "Pest & Mosquito Control",
  brandExamples: ["Mosquito Joe", "Mosquito Shield", "Orkin", "Terminix"],
  description:
    "Mosquito, tick, and pest treatment services. Seasonal demand driven by temperature, humidity, and standing water after rain events.",
  primaryServiceLines: ["pest_control", "general"],
  preferredSignalCategories: [
    // Weather triggers for pest activity
    "weather",
    "storm",      // standing water = mosquito breeding
    "flood",      // same
    // Seasonal / demographic
    "residential_area",
    "suburban_density",
    // Social signals (homeowners complaining about pests)
    "social_complaint",
    "review_mention",
  ],
  connectorWeights: {
    weather: 1.4,    // temperature + humidity are primary triggers
    social: 1.5,     // pest complaints show up on social/nextdoor first
    census: 1.3,     // residential density matters — more homes = more accounts
    overpass: 1.2,   // neighborhood parks and standing water areas
    open311: 1.1,    // public complaints about pests/standing water
    incident: 0.6,   // fires/floods aren't relevant
    usgs_water: 0.8, // flooding matters for standing water signals
    fema: 0.3,       // disaster signals not relevant
    permit: 0.4,     // building permits not relevant
  },
  seasonalProfile: {
    // Peak season: April–October (mosquito active season when temps > 50°F)
    peakMonths: [3, 4, 5, 6, 7, 8, 9],
    peakMultiplier: 1.5,    // demand surges dramatically in summer
    offPeakMultiplier: 0.4, // very low demand in winter
  },
  scoreModifiers: {
    severityBoost: 0,         // pest events aren't inherently "severe"
    urgencyBoost: 0,
    jobLikelihoodMultiplier: 1.0,
    highIntentThreshold: 55,  // lower bar — volume plays matter here
    autoQualifyThreshold: 75,
  },
  dedupWindowHours: {
    weather: 48,    // seasonal/area-level signals — longer dedup window
    social: 24,
    census: 720,    // demographic data doesn't change; 30-day window
    overpass: 720,
    open311: 72,
    incident: 24,
    default: 48,
  },
};

// ---------------------------------------------------------------------------
// Home Services / Remodel (ReBath, Bath Planet, 1-800-Hansons, Window Nation)
// ---------------------------------------------------------------------------
const HOME_SERVICES: FranchiseVertical = {
  key: "home_services",
  displayName: "Home Services & Remodeling",
  brandExamples: ["ReBath", "Bath Planet", "1-800-Hansons", "Window Nation", "Power Home Remodeling"],
  description:
    "Planned home improvement: bathroom remodel, windows, roofing, HVAC. Lead by life event triggers — new homeowners, aging homes, renovation permits.",
  primaryServiceLines: ["general", "hvac", "electrical", "roofing"],
  preferredSignalCategories: [
    // Permit categories
    "renovation",
    "roof",
    "hvac",
    "electrical",
    "plumbing",
    // Demographic / property
    "home_sale",
    "aging_home",
    "residential_area",
    // Social
    "social_complaint",
    "review_mention",
  ],
  connectorWeights: {
    permit: 1.8,     // permits are the strongest signal — homeowner has intent
    census: 1.5,     // demographics: homeownership rate, median home age
    overpass: 1.2,   // residential neighborhood density
    social: 1.1,     // homeowner groups complaining about old bathrooms/windows
    open311: 0.9,
    weather: 0.5,    // weather events less relevant (exception: roofing)
    incident: 0.4,   // fire/water incidents less relevant
    usgs_water: 0.3,
    fema: 0.2,
  },
  seasonalProfile: {
    // Spring selling season + fall before winter; summer is strong too
    peakMonths: [2, 3, 4, 5, 8, 9],
    peakMultiplier: 1.2,
    offPeakMultiplier: 0.85,
  },
  scoreModifiers: {
    severityBoost: -5,        // home services are planned, not emergency
    urgencyBoost: -5,
    jobLikelihoodMultiplier: 1.1,
    highIntentThreshold: 65,  // higher bar — planned purchases need more intent
    autoQualifyThreshold: 80,
  },
  dedupWindowHours: {
    permit: 336,    // permits are stable signals; 2-week dedup window
    census: 720,
    overpass: 720,
    social: 48,
    weather: 72,
    incident: 72,
    default: 168,   // 7-day default for this vertical
  },
};

// ---------------------------------------------------------------------------
// Multi-Line (general franchise / mixed portfolio)
// ---------------------------------------------------------------------------
const MULTI_LINE: FranchiseVertical = {
  key: "multi_line",
  displayName: "Multi-Line Home Services",
  brandExamples: ["Neighborly", "HomeTeam Pest Defense", "Mr. Handyman", "Five Star Painting"],
  description:
    "Multi-service franchise covering multiple home service categories. Balanced signal weighting across all connectors.",
  primaryServiceLines: ["restoration", "general", "hvac", "electrical", "plumbing", "roofing", "pest_control"],
  preferredSignalCategories: [
    "hail", "flood", "storm", "freeze", "wind", "weather",
    "fire_incident", "water_incident", "emergency_incident",
    "renovation", "roof", "hvac", "electrical", "plumbing",
    "remediation_repair",
    "social_complaint", "review_mention",
    "residential_area",
  ],
  connectorWeights: {
    weather: 1.1,
    incident: 1.1,
    permit: 1.1,
    usgs_water: 1.0,
    fema: 1.0,
    social: 1.0,
    open311: 1.0,
    census: 1.0,
    overpass: 1.0,
  },
  seasonalProfile: {
    peakMonths: [2, 3, 4, 5, 7, 8, 9],
    peakMultiplier: 1.15,
    offPeakMultiplier: 0.9,
  },
  scoreModifiers: {
    severityBoost: 0,
    urgencyBoost: 0,
    jobLikelihoodMultiplier: 1.0,
    highIntentThreshold: 62,
    autoQualifyThreshold: 80,
  },
  dedupWindowHours: {
    weather: 24,
    incident: 24,
    permit: 168,
    usgs_water: 24,
    fema: 48,
    social: 24,
    open311: 48,
    default: 48,
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const FRANCHISE_VERTICALS: Record<FranchiseVerticalKey, FranchiseVertical> = {
  restoration: RESTORATION,
  pest_control: PEST_CONTROL,
  home_services: HOME_SERVICES,
  multi_line: MULTI_LINE,
};

export function getVertical(key: string | null | undefined): FranchiseVertical {
  if (key && key in FRANCHISE_VERTICALS) {
    return FRANCHISE_VERTICALS[key as FranchiseVerticalKey];
  }
  return FRANCHISE_VERTICALS.multi_line;
}

/**
 * Returns a connector weight for a given connector key and vertical.
 * Defaults to 1.0 if not explicitly configured.
 */
export function getConnectorWeight(vertical: FranchiseVertical, connectorKey: string): number {
  const normalized = connectorKey.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  // Try exact match first
  if (normalized in vertical.connectorWeights) {
    return vertical.connectorWeights[normalized as keyof ConnectorWeights] ?? 1.0;
  }
  // Fuzzy match: "weather.nws" → "weather"
  for (const [k, w] of Object.entries(vertical.connectorWeights)) {
    if (normalized.startsWith(k) || k.startsWith(normalized)) {
      return w ?? 1.0;
    }
  }
  return 1.0;
}

/**
 * Returns whether a signal category is preferred for this vertical.
 * Preferred signals get a moderate score boost.
 */
export function isPreferredSignal(vertical: FranchiseVertical, category: string): boolean {
  const normalized = category.toLowerCase();
  return vertical.preferredSignalCategories.some(
    (c) => c.toLowerCase() === normalized || normalized.includes(c.toLowerCase())
  );
}

/**
 * Returns the seasonal multiplier for a vertical based on the current month.
 * Month is 0-indexed (0 = January).
 */
export function getSeasonalMultiplier(vertical: FranchiseVertical, month?: number): number {
  const currentMonth = month ?? new Date().getMonth();
  return vertical.seasonalProfile.peakMonths.includes(currentMonth)
    ? vertical.seasonalProfile.peakMultiplier
    : vertical.seasonalProfile.offPeakMultiplier;
}

/**
 * Applies vertical score modifiers to a base score vector.
 * Returns adjusted integer scores, clamped to [0, 100].
 */
export function applyVerticalModifiers(
  vertical: FranchiseVertical,
  base: { urgencyScore: number; jobLikelihoodScore: number; severityScore?: number },
  opts?: { signalCategory?: string; month?: number }
): { urgencyScore: number; jobLikelihoodScore: number; preferredSignal: boolean; seasonalMultiplier: number } {
  const { scoreModifiers } = vertical;
  const seasonal = getSeasonalMultiplier(vertical, opts?.month);
  const preferred = opts?.signalCategory ? isPreferredSignal(vertical, opts.signalCategory) : false;
  const preferredBoost = preferred ? 6 : 0;

  const urgency = Math.max(
    0,
    Math.min(100, Math.round((base.urgencyScore + scoreModifiers.urgencyBoost + preferredBoost) * seasonal))
  );
  const jobLikelihood = Math.max(
    0,
    Math.min(
      100,
      Math.round(base.jobLikelihoodScore * scoreModifiers.jobLikelihoodMultiplier * seasonal + preferredBoost)
    )
  );

  return { urgencyScore: urgency, jobLikelihoodScore: jobLikelihood, preferredSignal: preferred, seasonalMultiplier: seasonal };
}

/**
 * Returns the deduplication window (in hours) for a given source type and vertical.
 */
export function getDedupWindowHours(vertical: FranchiseVertical, sourceType: string): number {
  const normalized = sourceType.toLowerCase().split(".")[0]; // "weather.nws" → "weather"
  return vertical.dedupWindowHours[normalized] ?? vertical.dedupWindowHours.default ?? 48;
}

/**
 * Returns true if this signal's score vector meets the high-intent threshold for this vertical.
 */
export function isHighIntentForVertical(vertical: FranchiseVertical, urgencyScore: number): boolean {
  return urgencyScore >= vertical.scoreModifiers.highIntentThreshold;
}

/**
 * Returns true if this opportunity should be auto-qualified without SDR review.
 */
export function meetsAutoQualifyThreshold(vertical: FranchiseVertical, jobLikelihoodScore: number): boolean {
  return jobLikelihoodScore >= vertical.scoreModifiers.autoQualifyThreshold;
}
