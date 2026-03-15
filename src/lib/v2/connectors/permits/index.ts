import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

export const permitsConnector: ConnectorAdapter = {
  key: "permits.placeholder",

  async pull(input: ConnectorPullInput) {
    void input;
    return [];
  },

  async normalize(records: Record<string, unknown>[]) {
    return records.map((record, index): ConnectorNormalizedEvent => {
      const title = String(record.title || record.permit_type || `Permit event ${index + 1}`);
      const occurredAt = String(record.occurred_at || record.created_at || new Date().toISOString());
      return {
        occurredAt,
        dedupeKey: `${record.id || title}|${occurredAt}`,
        eventType: String(record.event_type || "permit"),
        title,
        description: String(record.description || ""),
        locationText: String(record.location || ""),
        serviceLine: String(record.service_line || "general"),
        severity: Number(record.severity || 55),
        sourceReliability: Number(record.source_reliability || 72),
        supportingSignalsCount: Number(record.supporting_signals_count || 1),
        catastropheSignal: Number(record.catastrophe_signal || 10),
        rawPayload: record,
        normalizedPayload: record
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const normalized = String(event.eventType || "permit").toLowerCase();
    if (normalized.includes("asbestos")) return { opportunityType: "asbestos_permit", serviceLine: "asbestos" };
    if (normalized.includes("roof")) return { opportunityType: "roof_permit", serviceLine: "roofing" };
    return { opportunityType: "permit_signal", serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(): ConnectorCompliancePolicy {
    return {
      termsStatus: "pending_review",
      outboundAllowed: true,
      requiresLegalReview: true,
      notes: "Municipal permit terms vary by source"
    };
  },

  async healthcheck(): Promise<ConnectorHealth> {
    return { ok: true, detail: "Placeholder connector ready" };
  }
};
