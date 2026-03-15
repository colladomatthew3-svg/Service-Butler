import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

export const socialIntentConnector: ConnectorAdapter = {
  key: "social.intent.placeholder",

  async pull(input: ConnectorPullInput) {
    void input;
    return [];
  },

  async normalize(records: Record<string, unknown>[]) {
    return records.map((record, index): ConnectorNormalizedEvent => {
      const body = String(record.body || record.text || "");
      const title = String(record.title || body.slice(0, 80) || `Social signal ${index + 1}`);
      const occurredAt = String(record.published_at || record.created_at || new Date().toISOString());
      return {
        occurredAt,
        dedupeKey: `${record.platform || "social"}|${record.id || title}|${occurredAt}`,
        eventType: String(record.event_type || "social_intent"),
        title,
        description: body,
        locationText: String(record.location_text || record.city || ""),
        serviceLine: String(record.service_line || "general"),
        severity: Number(record.severity || 50),
        sourceReliability: Number(record.source_reliability || 45),
        supportingSignalsCount: Number(record.supporting_signals_count || 1),
        catastropheSignal: Number(record.catastrophe_signal || 0),
        rawPayload: record,
        normalizedPayload: {
          platform: record.platform,
          author: record.author,
          body
        }
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const text = `${event.title} ${event.description || ""}`.toLowerCase();
    if (text.includes("flood") || text.includes("water")) return { opportunityType: "water_damage_intent", serviceLine: "restoration" };
    if (text.includes("no heat") || text.includes("no cool")) return { opportunityType: "hvac_outage_intent", serviceLine: "hvac" };
    return { opportunityType: "social_intent", serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(): ConnectorCompliancePolicy {
    return {
      termsStatus: "pending_review",
      ingestionAllowed: true,
      outboundAllowed: false,
      requiresLegalReview: true,
      notes: "Social sources require source-specific terms and consent checks"
    };
  },

  async healthcheck(): Promise<ConnectorHealth> {
    return { ok: true, detail: "Placeholder connector active" };
  }
};
