import type {
  ConnectorAdapter,
  ConnectorCompliancePolicy,
  ConnectorHealth,
  ConnectorNormalizedEvent,
  ConnectorPullInput
} from "@/lib/v2/connectors/types";
import { resolvePermitsProvider } from "@/lib/v2/connectors/permits/providers";

const CONNECTOR_VERSION = "v2.2.0";

type PermitCategory = "roof" | "plumbing" | "hvac" | "electrical" | "remediation_repair" | "renovation";

function toIso(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeFreshnessScore(occurredAtIso: string) {
  const occurred = new Date(occurredAtIso).getTime();
  const ageHours = Math.max(0, (Date.now() - occurred) / 3_600_000);
  return Math.max(0, Math.min(100, Math.round(100 - ageHours * 4)));
}

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase();
}

function classifyPermitCategory(record: Record<string, unknown>): PermitCategory {
  const text = `${record.permit_type || ""} ${record.work_class || ""} ${record.description || ""} ${record.scope || ""}`.toLowerCase();

  if (text.includes("roof") || text.includes("shingle")) return "roof";
  if (text.includes("plumb") || text.includes("sewer") || text.includes("pipe") || text.includes("drain")) return "plumbing";
  if (text.includes("hvac") || text.includes("furnace") || text.includes("boiler") || text.includes("ac ") || text.includes("air condition")) return "hvac";
  if (text.includes("electrical") || text.includes("panel") || text.includes("wiring")) return "electrical";
  if (text.includes("remediation") || text.includes("repair") || text.includes("restoration") || text.includes("mitigation")) {
    return "remediation_repair";
  }
  return "renovation";
}

function categoryToServiceLines(category: PermitCategory): string[] {
  if (category === "roof") return ["roofing", "restoration"];
  if (category === "plumbing") return ["plumbing", "restoration"];
  if (category === "hvac") return ["hvac"];
  if (category === "electrical") return ["electrical"];
  if (category === "remediation_repair") return ["restoration", "general"];
  return ["general"];
}

function inferDemandTiming(record: Record<string, unknown>, category: PermitCategory) {
  const text = `${record.description || ""} ${record.scope || ""} ${record.job_description || ""} ${record.work_permit || ""}`.toLowerCase();
  const immediateKeywords = ["emergency", "damage", "leak", "burst", "fire", "flood", "mitigation", "unsafe"];
  const immediate = immediateKeywords.some((keyword) => text.includes(keyword));

  if (immediate) {
    return {
      demandTiming: "immediate_service_demand",
      severityHint: 76,
      urgencyHint: 80,
      likelyJobType:
        category === "roof"
          ? "roof damage inspection"
          : category === "plumbing"
            ? "emergency plumbing"
            : category === "remediation_repair"
              ? "water mitigation"
              : category === "hvac"
                ? "HVAC outage"
                : "repair dispatch"
    };
  }

  return {
    demandTiming: "downstream_upsell",
    severityHint: category === "renovation" ? 38 : 52,
    urgencyHint: category === "renovation" ? 35 : 48,
    likelyJobType:
      category === "roof"
        ? "roof damage inspection"
        : category === "plumbing"
          ? "plumbing service"
          : category === "hvac"
            ? "HVAC replacement consult"
            : category === "electrical"
              ? "electrical safety inspection"
              : "renovation follow-up"
  };
}

function classifyOpportunityType(category: PermitCategory) {
  if (category === "roof") return "roof_permit_signal";
  if (category === "plumbing") return "plumbing_permit_signal";
  if (category === "hvac") return "hvac_permit_signal";
  if (category === "electrical") return "electrical_permit_signal";
  if (category === "remediation_repair") return "restoration_permit_signal";
  return "permit_signal";
}

export const permitsConnector: ConnectorAdapter = {
  key: "permits.production",

  async pull(input: ConnectorPullInput) {
    const provider = resolvePermitsProvider(input);
    return provider.fetchRecords(input);
  },

  async normalize(records: Record<string, unknown>[], input: ConnectorPullInput) {
    const provider = resolvePermitsProvider(input);
    const termsStatus = provider.termsStatus(input);
    const sourceProvenance = provider.sourceProvenance(input);

    return records.map((record, index): ConnectorNormalizedEvent => {
      const title = String(record.title || record.permit_type || `Permit event ${index + 1}`);
      const occurredAt = toIso(record.occurred_at || record.issued_at || record.issued_date || record.created_at);
      const freshnessScore = computeFreshnessScore(occurredAt);
      const category = classifyPermitCategory(record);
      const serviceLineCandidates = categoryToServiceLines(category);
      const demand = inferDemandTiming(record, category);
      const primaryServiceLine = serviceLineCandidates[0] || "general";
      const applicantName = [record.applicant_first_name, record.applicant_last_name].map((value) => String(value || "").trim()).filter(Boolean).join(" ");
      const address = String(
        record.address ||
          record.location ||
          [record.house_no, record.house__, record.street_name].map((value) => String(value || "").trim()).filter(Boolean).join(" ") ||
          ""
      ).trim();
      const contactName = String(
        record.owner_name ||
          record.owner_s_first_name ||
          applicantName ||
          record.applicant_name ||
          record.contractor_name ||
          record.contact_name ||
          record.business_name ||
          record.owner_business_name ||
          record.owner_s_business_name ||
          record.applicant_business_name ||
          ""
      ).trim();
      const contactPhone = String(
        record.owner_phone || record.applicant_phone || record.contractor_phone || record.contact_phone || record.phone || ""
      ).trim();
      const contactEmail = String(
        record.owner_email || record.applicant_email || record.contractor_email || record.contact_email || record.email || ""
      ).trim();

      return {
        occurredAt,
        dedupeKey: `${record.id || record.permit_number || record.job_filing_number || record.work_permit || title}|${occurredAt}`,
        eventType: String(record.event_type || "permit_signal"),
        eventCategory: "permit",
        title: String(record.work_permit || record.permit_type || record.job_type || title),
        description: String(record.description || record.job_description || record.scope || ""),
        locationText: address || String(record.city || record.owner_city || ""),
        addressText: address,
        city: String(record.city || record.owner_city || ""),
        state: String(record.state || record.owner_state || ""),
        postalCode: String(record.postal_code || record.zip_code || record.zip || record.owner_zip_code || ""),
        latitude: record.latitude != null ? toNumber(record.latitude, NaN) : record.gis_latitude != null ? toNumber(record.gis_latitude, NaN) : null,
        longitude: record.longitude != null ? toNumber(record.longitude, NaN) : record.gis_longitude != null ? toNumber(record.gis_longitude, NaN) : null,
        serviceLine: primaryServiceLine,
        serviceLineCandidates,
        severity: toNumber(record.severity, demand.severityHint),
        severityHint: demand.severityHint,
        urgencyHint: demand.urgencyHint,
        likelyJobType: demand.likelyJobType,
        estimatedResponseWindow: demand.demandTiming === "immediate_service_demand" ? "0-4h" : "24-72h",
        sourceName: String(input.config.connector_name || input.config.source_name || "Permits Provider"),
        sourceProvenance,
        sourceReliability: toNumber(record.source_reliability, 74),
        supportingSignalsCount: toNumber(record.supporting_signals_count, 1),
        catastropheSignal: toNumber(record.catastrophe_signal, category === "remediation_repair" ? 40 : 12),
        rawPayload: record,
        normalizedPayload: {
          permit_id: record.id || record.permit_number || record.job_filing_number || null,
          permit_type: record.permit_type || record.work_permit || record.job_type || null,
          work_class: record.work_class || record.work_type || record.scope || record.permittee_s_license_type || null,
          applicant_license: record.applicant_license || null,
          applicant_license_type: record.permittee_s_license_type || null,
          applicant_business_address: record.applicant_business_address || null,
          contact_name: contactName || null,
          contact_phone: contactPhone || null,
          contact_email: contactEmail || null,
          owner_business_name: record.owner_business_name || record.owner_s_business_name || null,
          owner_name: record.owner_name || [record.owner_s_first_name, record.owner_s_last_name].map((value) => String(value || "").trim()).filter(Boolean).join(" ") || null,
          owner_phone: record.owner_phone || record.owner_s_phone__ || null,
          applicant_name: applicantName || null,
          applicant_business_name: record.applicant_business_name || null,
          applicant_phone: record.applicant_phone || null,
          permit_status: record.permit_status || null,
          native_contact_identity_present: Boolean(
            contactName || record.owner_business_name || record.owner_s_business_name || record.applicant_business_name
          ),
          native_contact_channel_present: Boolean(contactPhone || contactEmail),
          permit_category: category,
          demand_timing: demand.demandTiming,
          service_line_candidates: serviceLineCandidates,
          likely_job_type: demand.likelyJobType,
          source_provenance: sourceProvenance,
          terms_status: termsStatus,
          data_freshness_score: freshnessScore,
          connector_version: CONNECTOR_VERSION,
          provider_key: provider.key
        }
      };
    });
  },

  dedupeKey(event) {
    return event.dedupeKey;
  },

  classify(event) {
    const category = normalizeText(event.normalizedPayload.permit_category);
    if (category === "roof") return { opportunityType: "roof_permit_signal", serviceLine: "roofing" };
    if (category === "plumbing") return { opportunityType: "plumbing_permit_signal", serviceLine: "plumbing" };
    if (category === "hvac") return { opportunityType: "hvac_permit_signal", serviceLine: "hvac" };
    if (category === "electrical") return { opportunityType: "electrical_permit_signal", serviceLine: "electrical" };
    if (category === "remediation_repair") return { opportunityType: "restoration_permit_signal", serviceLine: "restoration" };
    return { opportunityType: classifyOpportunityType("renovation"), serviceLine: event.serviceLine || "general" };
  },

  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy {
    const provider = resolvePermitsProvider(input);
    const termsStatus = provider.termsStatus(input);
    const approved = termsStatus === "approved";

    return {
      termsStatus,
      ingestionAllowed: approved,
      outboundAllowed: approved,
      requiresLegalReview: !approved,
      notes: approved
        ? "Permits provider approved for ingestion"
        : "Permits ingestion blocked until terms_status=approved"
    };
  },

  async healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth> {
    const provider = resolvePermitsProvider(input);
    if (provider.key === "permits.static" || provider.key === "permits.missing") {
      return {
        ok: false,
        detail:
          provider.key === "permits.static"
            ? "Permits source is using static/sample fallback; configure a live permits provider before treating it as production-ready"
            : "Permits source has no live provider configured; set provider_url before treating it as production-ready"
      };
    }
    const start = Date.now();
    const records = await provider.fetchRecords(input).catch(() => []);
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      latencyMs,
      detail: `Provider ${provider.key} reachable; sample_count=${records.length}`
    };
  }
};
