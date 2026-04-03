import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";
import { scrapeConfiguredPagesWithFirecrawl } from "@/lib/integrations/firecrawl";

const CONNECTOR_VERSION = "v2.2.0";

function envTrue(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

function citizenEnabled() {
  return envTrue("SB_ENABLE_CITIZEN_CONNECTOR");
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function classifyIncidentCategory(record: Record<string, unknown>) {
  const text = `${record.event_type || ""} ${record.incident_type || ""} ${record.title || ""} ${record.description || ""}`.toLowerCase();

  if (text.includes("fire") || text.includes("smoke")) return "fire_incident";
  if (text.includes("flood") || text.includes("water")) return "water_incident";
  if (text.includes("infrastructure") || text.includes("outage") || text.includes("utility")) return "infrastructure_failure";
  if (text.includes("emergency") || text.includes("response")) return "emergency_response";
  return "incident";
}

function serviceLineCandidates(category: string) {
  if (category === "fire_incident") return ["restoration", "general"];
  if (category === "water_incident") return ["restoration", "plumbing"];
  if (category === "infrastructure_failure") return ["electrical", "plumbing", "commercial"];
  if (category === "emergency_response") return ["restoration", "general"];
  return ["restoration"];
}

function likelyJobType(category: string) {
  if (category === "fire_incident") return "fire restoration";
  if (category === "water_incident") return "water mitigation";
  if (category === "infrastructure_failure") return "infrastructure emergency dispatch";
  if (category === "emergency_response") return "emergency mitigation";
  return "incident response";
}

function mapOpportunityType(category: string) {
  if (category === "fire_incident") return "fire_damage_incident";
  if (category === "water_incident") return "flood_incident";
  if (category === "infrastructure_failure") return "infrastructure_incident";
  if (category === "emergency_response") return "emergency_incident";
  return "incident_signal";
}

function isCitizenLike(input: ConnectorPullInput) {
  const sourceName = String(input.config.connector_name || input.config.source_name || "").toLowerCase();
  const sourceProv = String(input.config.source_provenance || "").toLowerCase();
  return sourceName.includes("citizen") || sourceProv.includes("citizen");
}

async function pullIncidentPages(input: ConnectorPullInput) {
  const pages = await scrapeConfiguredPagesWithFirecrawl({
    config: input.config,
    fallbackFields: ["feed_url", "endpoint"]
  });

  return pages.map((page, index) => {
    const body = [page.description, page.markdown].filter(Boolean).join("\n\n");
    const category = classifyIncidentCategory({
      title: page.title || "",
      description: body
    });

    return {
      id: `firecrawl-incident-${index + 1}`,
      provider: String(input.config.source_name || input.config.connector_name || "Public Incident Feed"),
      event_type: category,
      incident_type: category,
      title: page.title || `Incident signal ${index + 1}`,
      description: body,
      occurred_at: page.publishedTime || new Date().toISOString(),
      location_text: String(input.config.location_text || input.config.city || ""),
      address_text: String(input.config.address_text || input.config.location_text || ""),
      city: String(input.config.city || ""),
      state: String(input.config.state || ""),
      postal_code: String(input.config.postal_code || ""),
      source_provenance: page.url
    } satisfies Record<string, unknown>;
  });
}

export const incidentConnector: ConnectorAdapter = {
  key: "incidents.generic",

  async pull(input: ConnectorPullInput) {
    const scrapedPages = await pullIncidentPages(input);
    if (scrapedPages.length > 0) return scrapedPages;

    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }
    return [];
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const defaultSourceName = String(input.config.connector_name || input.config.source_name || "Generic Incident Feed");
    const defaultSourceProvenance = String(input.config.source_provenance || "public.incident.feed");

    return records.map((record, index): ConnectorNormalizedEvent => {
      const category = classifyIncidentCategory(record);
      const lines = serviceLineCandidates(category);
      const urgency = toNumber(record.urgency_hint, category.includes("emergency") ? 84 : 70);
      const severity = toNumber(record.severity, category.includes("fire") ? 82 : 68);
      const title = String(record.title || record.incident_type || `Incident ${index + 1}`);
      const occurredAt = String(record.occurred_at || record.created_at || new Date().toISOString());
      const sourceName = String(record.provider || record.source_name || defaultSourceName);
      const sourceProvenance = String(record.source_provenance || defaultSourceProvenance);

      return {
        occurredAt,
        dedupeKey: `${record.provider || "incident"}|${record.id || title}|${occurredAt}`,
        eventType: String(record.event_type || category),
        eventCategory: category,
        title,
        description: String(record.description || ""),
        locationText: String(record.location_text || record.address_text || ""),
        addressText: String(record.address_text || record.location_text || ""),
        city: String(record.city || ""),
        state: String(record.state || ""),
        postalCode: String(record.postal_code || record.zip || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : null,
        serviceLine: lines[0] || "restoration",
        serviceLineCandidates: lines,
        severity,
        severityHint: severity,
        urgencyHint: urgency,
        likelyJobType: likelyJobType(category),
        estimatedResponseWindow: urgency >= 80 ? "0-4h" : "4-24h",
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 66),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: toNumber(record.catastrophe_signal, category === "infrastructure_failure" ? 74 : 64),
        rawPayload: record,
        normalizedPayload: {
          incident_category: category,
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
    const category = String(event.eventCategory || "incident");
    const serviceLine = event.serviceLineCandidates?.[0] || event.serviceLine || "restoration";
    return { opportunityType: mapOpportunityType(category), serviceLine };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const terms = String(input.config.terms_status || "pending_review").toLowerCase();
    const termsStatus =
      terms === "approved" || terms === "restricted" || terms === "blocked" ? (terms as "approved" | "restricted" | "blocked") : "pending_review";

    if (isCitizenLike(input) && !citizenEnabled()) {
      return {
        termsStatus: "restricted",
        ingestionAllowed: false,
        outboundAllowed: false,
        requiresLegalReview: true,
        notes: "Citizen-like sources are compliance-gated and disabled by default"
      };
    }

    const approved = termsStatus === "approved";
    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: false,
      requiresLegalReview: !approved,
      notes: approved ? "Incident feed approved for ingestion" : "Incident feed blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const records = await this.pull(input);
    return {
      ok: true,
      detail: `Generic incident connector ready; sample_count=${records.length}`
    };
  }
};
