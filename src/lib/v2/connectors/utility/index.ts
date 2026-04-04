import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";
import { searchWithFirecrawl } from "@/lib/integrations/firecrawl";

const CONNECTOR_VERSION = "v1.0.0";

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanString(entry)).filter((entry): entry is string => Boolean(entry));
  }

  const text = cleanString(value);
  if (!text) return [];
  return text
    .split(/[\n,]+/g)
    .map((entry) => cleanString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function classifyOutageCategory(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("power") || lower.includes("electric") || lower.includes("transformer")) return "power_outage";
  if (lower.includes("water main") || lower.includes("water outage")) return "water_outage";
  if (lower.includes("gas leak") || lower.includes("gas outage")) return "gas_outage";
  if (lower.includes("telecom") || lower.includes("internet")) return "telecom_outage";
  return "utility_outage";
}

function serviceLineCandidates(category: string) {
  if (category === "power_outage") return ["electrical", "restoration"];
  if (category === "water_outage") return ["plumbing", "restoration"];
  if (category === "gas_outage") return ["hvac", "restoration"];
  if (category === "telecom_outage") return ["commercial", "restoration"];
  return ["restoration", "plumbing"];
}

function likelyJobType(category: string) {
  if (category === "power_outage") return "electrical emergency response";
  if (category === "water_outage") return "water mitigation";
  if (category === "gas_outage") return "HVAC and gas safety response";
  if (category === "telecom_outage") return "commercial outage response";
  return "utility outage response";
}

function mapOpportunityType(category: string) {
  if (category === "power_outage") return "power_outage_signal";
  if (category === "water_outage") return "water_outage_signal";
  if (category === "gas_outage") return "gas_outage_signal";
  if (category === "telecom_outage") return "infrastructure_outage_signal";
  return "utility_outage_signal";
}

function termsStatus(input: ConnectorPullInput) {
  const status = String(input.config.terms_status || "pending_review").toLowerCase();
  if (status === "approved") return "approved" as const;
  if (status === "restricted") return "restricted" as const;
  if (status === "blocked") return "blocked" as const;
  return "pending_review" as const;
}

function hasConfiguredSearch(input: ConnectorPullInput) {
  const searchTerms = parseStringList(input.config.search_terms);
  const searchQuery = cleanString(input.config.search_query || input.config.query);
  return Boolean(searchQuery) || searchTerms.length > 0;
}

function hasFirecrawlCredential(input: ConnectorPullInput) {
  return Boolean(input.config.firecrawl_api_key || process.env.FIRECRAWL_API_KEY);
}

function buildSearchQuery(input: ConnectorPullInput) {
  const configuredQuery = cleanString(input.config.search_query || input.config.query);
  if (configuredQuery) return configuredQuery;

  const searchTerms = parseStringList(input.config.search_terms);
  const region = cleanString(input.config.region || input.config.location_text || input.config.city || input.config.state);
  const suffix = region ? ` ${region}` : "";
  const termClause = searchTerms.length > 0 ? searchTerms.map((term) => `"${term}"`).join(" OR ") : `"utility outage" OR "power outage"`;
  return `${termClause}${suffix}`;
}

export const utilityOutageConnector: ConnectorAdapter = {
  key: "utility.outages",

  async pull(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    const useFirecrawl = String(input.config.use_firecrawl || "").toLowerCase() === "true";
    const searchQuery = buildSearchQuery(input);

    if (useFirecrawl && hasConfiguredSearch(input)) {
      const records = await searchWithFirecrawl({
        config: input.config,
        query: searchQuery,
        limit: toNumber(input.config.limit, 8)
      });

      if (records.length > 0) {
        return records.map((record, index) => ({
          id: `utility-search-${index + 1}`,
          title: record.title || `Utility outage signal ${index + 1}`,
          description: [record.description, record.markdown].filter(Boolean).join("\n\n"),
          occurred_at: new Date().toISOString(),
          source_name: cleanString(input.config.source_name) || "Utility Outage Search",
          source_provenance: record.url,
          url: record.url,
          city: cleanString(input.config.city) || "",
          state: cleanString(input.config.state) || "",
          postal_code: cleanString(input.config.postal_code) || "",
          location_text: cleanString(input.config.location_text) || cleanString(input.config.region) || "",
          raw_search_result: record
        }));
      }
    }

    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    return [];
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const defaultSourceName = String(input.config.connector_name || input.config.source_name || "Utility Outage Feed");
    const defaultSourceProvenance = String(input.config.source_provenance || "firecrawl.search");

    return records.map((record, index): ConnectorNormalizedEvent => {
      const title = String(record.title || `Utility outage ${index + 1}`);
      const description = String(record.description || "");
      const category = classifyOutageCategory(`${title} ${description}`);
      const lines = serviceLineCandidates(category);

      const severity = toNumber(record.severity, category === "power_outage" ? 78 : 70);
      const urgency = toNumber(record.urgency_hint, category === "power_outage" ? 84 : 74);
      const occurredAt = String(record.occurred_at || record.created_at || new Date().toISOString());
      const sourceName = String(record.source_name || defaultSourceName);
      const sourceProvenance = String(record.source_provenance || record.url || defaultSourceProvenance);

      return {
        occurredAt,
        dedupeKey: `${sourceName}|${record.id || title}|${sourceProvenance}`,
        eventType: String(record.event_type || category),
        eventCategory: category,
        title,
        description,
        locationText: String(record.location_text || record.address_text || ""),
        addressText: String(record.address_text || record.location_text || ""),
        city: String(record.city || ""),
        state: String(record.state || ""),
        postalCode: String(record.postal_code || record.zip || ""),
        serviceLine: lines[0] || "restoration",
        serviceLineCandidates: lines,
        severity,
        severityHint: severity,
        urgencyHint: urgency,
        likelyJobType: likelyJobType(category),
        estimatedResponseWindow: urgency >= 80 ? "0-4h" : "4-24h",
        sourceName,
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 64),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: toNumber(record.catastrophe_signal, 58),
        rawPayload: record,
        normalizedPayload: {
          outage_category: category,
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
    const category = String(event.eventCategory || "utility_outage");
    const serviceLine = event.serviceLineCandidates?.[0] || event.serviceLine || "restoration";
    return {
      opportunityType: mapOpportunityType(category),
      serviceLine
    };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const status = termsStatus(input);
    const approved = status === "approved";

    return {
      termsStatus: status,
      ingestionAllowed: approved,
      outboundAllowed: false,
      requiresLegalReview: !approved,
      notes: approved ? "Utility source approved for ingestion." : "Utility source blocked until terms_status=approved."
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    if (Array.isArray(input.config.sample_records) && !hasConfiguredSearch(input)) {
      return {
        ok: false,
        detail: "sample_records configured; utility source is simulated until search terms are configured"
      };
    }

    if (hasConfiguredSearch(input)) {
      if (!hasFirecrawlCredential(input)) {
        return {
          ok: false,
          detail: "Utility search is configured, but FIRECRAWL_API_KEY is missing"
        };
      }

      return {
        ok: true,
        detail: "Utility search source configured for Firecrawl query ingestion"
      };
    }

    const records = await this.pull(input);
    return {
      ok: true,
      detail: `Utility connector ready; sample_count=${records.length}`
    };
  }
};
