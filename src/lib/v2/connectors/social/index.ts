import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

const CONNECTOR_VERSION = "v2.2.0";

const DISTRESS_KEYWORDS: Array<{
  keyword: string;
  serviceLines: string[];
  likelyJobType: string;
  urgency: number;
  severity: number;
}> = [
  { keyword: "flooded basement", serviceLines: ["restoration", "plumbing"], likelyJobType: "water mitigation", urgency: 88, severity: 84 },
  { keyword: "pipe burst", serviceLines: ["plumbing", "restoration"], likelyJobType: "emergency plumbing", urgency: 92, severity: 86 },
  { keyword: "sewer backup", serviceLines: ["plumbing", "restoration"], likelyJobType: "sewer backup", urgency: 90, severity: 85 },
  { keyword: "smoke damage", serviceLines: ["restoration"], likelyJobType: "fire restoration", urgency: 82, severity: 80 },
  { keyword: "no heat", serviceLines: ["hvac", "plumbing"], likelyJobType: "HVAC outage", urgency: 84, severity: 74 },
  { keyword: "no ac", serviceLines: ["hvac"], likelyJobType: "HVAC outage", urgency: 78, severity: 68 },
  { keyword: "leak", serviceLines: ["plumbing", "restoration"], likelyJobType: "emergency plumbing", urgency: 72, severity: 62 },
  { keyword: "mold", serviceLines: ["restoration"], likelyJobType: "mold remediation", urgency: 70, severity: 66 }
];

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function classifyDistress(text: string) {
  const lower = text.toLowerCase();
  const matched = DISTRESS_KEYWORDS.filter((rule) => lower.includes(rule.keyword));

  if (matched.length === 0) {
    return {
      category: "consumer_distress",
      serviceLineCandidates: ["general"],
      likelyJobType: "service inquiry",
      urgencyHint: 45,
      severityHint: 42,
      summary: "No high-priority distress terms matched"
    };
  }

  const serviceLineCandidates = Array.from(new Set(matched.flatMap((rule) => rule.serviceLines))).filter(Boolean);
  const urgencyHint = Math.max(...matched.map((rule) => rule.urgency));
  const severityHint = Math.max(...matched.map((rule) => rule.severity));
  const likelyJobType = matched[0]!.likelyJobType;
  const summary = `Detected distress signals: ${matched.map((rule) => rule.keyword).join(", ")}`;

  return {
    category: "consumer_distress",
    serviceLineCandidates: serviceLineCandidates.length ? serviceLineCandidates : ["general"],
    likelyJobType,
    urgencyHint,
    severityHint,
    summary
  };
}

function mapPlatform(raw: unknown) {
  const platform = String(raw || "").toLowerCase();
  if (platform.includes("reddit")) return "reddit";
  if (platform.includes("google")) return "google_review";
  return platform || "social";
}

function termsStatus(input: ConnectorPullInput) {
  const status = String(input.config.terms_status || "pending_review").toLowerCase();
  if (status === "approved") return "approved" as const;
  if (status === "restricted") return "restricted" as const;
  if (status === "blocked") return "blocked" as const;
  return "pending_review" as const;
}

export const socialIntentConnector: ConnectorAdapter = {
  key: "social.intent.placeholder",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }
    return [];
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    return records.map((record, index): ConnectorNormalizedEvent => {
      const body = String(record.body || record.text || record.review_text || "");
      const title = String(record.title || body.slice(0, 80) || `Social signal ${index + 1}`);
      const occurredAt = String(record.published_at || record.created_at || new Date().toISOString());
      const platform = mapPlatform(record.platform || record.source_type || input.sourceType);
      const distress = classifyDistress(`${title} ${body}`);
      const sourceName =
        String(record.source_name || input.config.source_name || input.config.connector_name || (platform === "google_review" ? "Google Reviews" : "Reddit"));
      const sourceProvenance = String(record.source_provenance || input.config.source_provenance || platform);

      return {
        occurredAt,
        dedupeKey: `${platform}|${record.id || title}|${occurredAt}`,
        eventType: platform === "google_review" ? "google_review_distress" : "reddit_distress_post",
        eventCategory: distress.category,
        title,
        description: body,
        locationText: String(record.location_text || record.city || ""),
        addressText: String(record.address_text || ""),
        city: String(record.city || ""),
        state: String(record.state || ""),
        postalCode: String(record.postal_code || record.zip || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine: distress.serviceLineCandidates[0] || "general",
        serviceLineCandidates: distress.serviceLineCandidates,
        severity: toNumber(record.severity, distress.severityHint),
        severityHint: distress.severityHint,
        urgencyHint: toNumber(record.urgency_hint, distress.urgencyHint),
        likelyJobType: distress.likelyJobType,
        estimatedResponseWindow: distress.urgencyHint >= 80 ? "0-4h" : distress.urgencyHint >= 60 ? "4-24h" : "24-72h",
        distressContextSummary: distress.summary,
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, platform === "google_review" ? 70 : 58),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: toNumber(record.catastrophe_signal, distress.urgencyHint > 80 ? 55 : 25),
        rawPayload: record,
        normalizedPayload: {
          platform,
          author: record.author,
          contact_name: record.author || record.contact_name || null,
          contact_phone: record.contact_phone || null,
          contact_email: record.contact_email || null,
          body,
          distress_summary: distress.summary,
          source_provenance: sourceProvenance,
          connector_version: CONNECTOR_VERSION
        }
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const text = `${event.title} ${event.description || ""}`.toLowerCase();
    if (text.includes("flood") || text.includes("water") || text.includes("basement")) {
      return { opportunityType: "water_damage_distress", serviceLine: "restoration" };
    }
    if (text.includes("no heat") || text.includes("no ac") || text.includes("no a/c")) {
      return { opportunityType: "hvac_outage_distress", serviceLine: "hvac" };
    }
    if (text.includes("pipe") || text.includes("leak") || text.includes("sewer")) {
      return { opportunityType: "plumbing_distress", serviceLine: "plumbing" };
    }
    if (text.includes("smoke") || text.includes("fire")) {
      return { opportunityType: "fire_damage_distress", serviceLine: "restoration" };
    }
    return { opportunityType: "consumer_distress_signal", serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const status = termsStatus(input);
    const approved = status === "approved";

    return {
      termsStatus: status,
      ingestionAllowed: approved,
      outboundAllowed: false,
      requiresLegalReview: !approved,
      notes: approved
        ? "Distress signal source approved for ingestion"
        : "Distress sources require explicit terms approval before ingestion"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const records = await this.pull(input);
    return { ok: true, detail: `Distress connector ready; sample_count=${records.length}` };
  }
};
