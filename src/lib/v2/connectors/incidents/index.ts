import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";

function citizenEnabled() {
  const value = String(process.env.SB_ENABLE_CITIZEN_CONNECTOR || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

export const incidentConnector: ConnectorAdapter = {
  key: "incidents.generic",

  async pull(input: ConnectorPullInput) {
    void input;
    return [];
  },

  async normalize(records: Record<string, unknown>[]) {
    return records.map((record, index): ConnectorNormalizedEvent => {
      const title = String(record.title || record.incident_type || `Incident ${index + 1}`);
      const occurredAt = String(record.occurred_at || record.created_at || new Date().toISOString());
      return {
        occurredAt,
        dedupeKey: `${record.provider || "incident"}|${record.id || title}|${occurredAt}`,
        eventType: String(record.event_type || "incident_signal"),
        title,
        description: String(record.description || ""),
        locationText: String(record.location_text || ""),
        serviceLine: String(record.service_line || "restoration"),
        severity: Number(record.severity || 60),
        sourceReliability: Number(record.source_reliability || 50),
        supportingSignalsCount: Number(record.supporting_signals_count || 1),
        catastropheSignal: Number(record.catastrophe_signal || 55),
        rawPayload: record,
        normalizedPayload: record
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const eventType = String(event.eventType || "incident_signal").toLowerCase();
    if (eventType.includes("fire")) return { opportunityType: "fire_damage_incident", serviceLine: "restoration" };
    if (eventType.includes("flood")) return { opportunityType: "flood_incident", serviceLine: "restoration" };
    if (eventType.includes("infrastructure")) return { opportunityType: "infrastructure_incident", serviceLine: "commercial" };
    return { opportunityType: "incident_signal", serviceLine: event.serviceLine || "restoration" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    void input;
    const enabled = citizenEnabled();
    return {
      termsStatus: enabled ? "pending_review" : "restricted",
      ingestionAllowed: enabled,
      outboundAllowed: false,
      requiresLegalReview: true,
      notes: enabled
        ? "Incident connector enabled with compliance review gate"
        : "Citizen-style adapter disabled by default"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    void input;
    if (!citizenEnabled()) {
      return { ok: true, detail: "Generic incident connector available; Citizen integration disabled by default" };
    }
    return { ok: true, detail: "Generic incident connector enabled" };
  }
};
