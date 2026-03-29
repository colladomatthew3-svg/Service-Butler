import {
  createOutboundListWithMembers,
  fetchOutboundListRecords
} from "@/lib/services/outbound-engine";
import { getIncidentTriggeredSegments, type OpportunityListSeed } from "@/lib/services/outbound";
import { normalizeEmail, normalizePhone } from "@/lib/v2/lead-verification";
import { dispatchOutreach } from "@/lib/v2/outreach-orchestrator";
import { logV2AuditEvent } from "@/lib/v2/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

type NetworkRecordKind = "prospect" | "referral_partner";

type NetworkCandidate = {
  recordType: NetworkRecordKind;
  recordId: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  territory: string | null;
  segment: string;
  source: string | null;
  strategicValue: number;
  nearActiveIncident: boolean;
  matchReason: string;
  matchScore: number;
};

export type NetworkOpportunity = {
  id: string;
  opportunityType: string;
  serviceLine: string;
  title: string;
  description: string;
  locationText: string;
  postalCode: string;
  contactStatus: string;
  lifecycleStatus: string;
  explainability: Record<string, unknown>;
};

export type NetworkActivationResult = {
  opportunityId: string;
  listId: string;
  listName: string;
  listType: string;
  territory: string | null;
  segments: string[];
  matchedCount: number;
  leadsCreated: number;
  outreachSent: number;
  contactableSmsCount: number;
  contactableEmailCount: number;
  contactableRecords: Array<{
    recordType: NetworkRecordKind;
    recordId: string;
    companyName: string;
    contactName: string | null;
    segment: string;
    matchReason: string;
    matchScore: number;
  }>;
};

function toText(value: unknown) {
  return String(value || "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeToken(value: unknown) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCityStatePostal(text: string) {
  const raw = toText(text);
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const postalCode = raw.match(/\b\d{5}\b/)?.[0] || "";
  const stateToken = parts.length >= 1 ? parts[parts.length - 1] || "" : "";
  const state = stateToken.replace(/\d{5}/g, "").trim().split(/\s+/)[0] || "";
  const city = parts.length >= 2 ? parts[parts.length - 2] || "" : "";
  return { city, state, postalCode };
}

export function buildNetworkActivationOpportunitySeed(opportunity: NetworkOpportunity): OpportunityListSeed {
  const parsed = parseCityStatePostal(opportunity.locationText);
  return {
    id: opportunity.id,
    title: opportunity.title,
    category: opportunity.serviceLine || opportunity.opportunityType || "general",
    location_text: opportunity.locationText,
    city: parsed.city || null,
    state: parsed.state || null,
    zip: opportunity.postalCode || parsed.postalCode || null,
    territory: parsed.city && parsed.state ? `${parsed.city}, ${parsed.state}` : null,
    raw: {
      source_types: Array.isArray(opportunity.explainability.source_types) ? opportunity.explainability.source_types : [],
      tags: Array.isArray(opportunity.explainability.tags) ? opportunity.explainability.tags : [],
      signal_count: opportunity.explainability.signal_count || null
    }
  };
}

export function scoreNetworkActivationMatch(input: {
  territory: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  candidate: {
    territory: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    nearActiveIncident: boolean;
  };
}) {
  const targetTerritory = normalizeToken(input.territory);
  const targetCity = normalizeToken(input.city);
  const targetState = normalizeToken(input.state);
  const targetPostal = toText(input.postalCode);
  const candidateTerritory = normalizeToken(input.candidate.territory);
  const candidateCity = normalizeToken(input.candidate.city);
  const candidateState = normalizeToken(input.candidate.state);
  const candidatePostal = toText(input.candidate.postalCode);

  if (targetTerritory && candidateTerritory && targetTerritory === candidateTerritory) {
    return { reason: "exact_territory", score: 100 };
  }
  if (targetPostal && candidatePostal && targetPostal === candidatePostal) {
    return { reason: "exact_postal", score: 96 };
  }
  if (targetCity && targetState && candidateCity === targetCity && candidateState === targetState) {
    return { reason: "exact_city_state", score: 88 };
  }
  if (targetCity && candidateTerritory && candidateTerritory.includes(targetCity) && candidateState === targetState) {
    return { reason: "territory_contains_city", score: 78 };
  }
  if (targetState && candidateState === targetState && input.candidate.nearActiveIncident) {
    return { reason: "same_state_incident_ready", score: 70 };
  }
  if (targetState && candidateState === targetState) {
    return { reason: "same_state", score: 58 };
  }
  if (input.candidate.nearActiveIncident) {
    return { reason: "incident_ready_fallback", score: 42 };
  }
  return { reason: "unmatched", score: 0 };
}

function extractExistingDestinations(leads: Array<Record<string, unknown>>) {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const lead of leads) {
    const channels = asRecord(lead.contact_channels_json);
    const email = normalizeEmail(channels.email);
    const phone = normalizePhone(channels.phone || channels.mobile);
    if (email) emails.add(email);
    if (phone) phones.add(phone);
  }
  return { emails, phones };
}

async function fetchOpportunity({
  supabase,
  tenantId,
  opportunityId
}: {
  supabase: SupabaseClient;
  tenantId: string;
  opportunityId: string;
}) {
  const { data, error } = await supabase
    .from("v2_opportunities")
    .select(
      "id,opportunity_type,service_line,title,description,location_text,postal_code,contact_status,lifecycle_status,explainability_json"
    )
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || "V2 opportunity not found");
  }

  return {
    id: String(data.id),
    opportunityType: toText(data.opportunity_type || "signal"),
    serviceLine: toText(data.service_line || data.opportunity_type || "general"),
    title: toText(data.title || "Opportunity"),
    description: toText(data.description),
    locationText: toText(data.location_text),
    postalCode: toText(data.postal_code),
    contactStatus: toText(data.contact_status || "unknown"),
    lifecycleStatus: toText(data.lifecycle_status || "new"),
    explainability: asRecord(data.explainability_json)
  } satisfies NetworkOpportunity;
}

async function fetchNetworkCandidates({
  supabase,
  accountId,
  seed,
  segments
}: {
  supabase: SupabaseClient;
  accountId: string;
  seed: OpportunityListSeed;
  segments: string[];
}): Promise<NetworkCandidate[]> {
  const [{ data: prospects, error: prospectError }, { data: partners, error: partnerError }] = await Promise.all([
    supabase
      .from("prospects")
      .select("id,company_name,contact_name,email,phone,city,state,zip,territory,prospect_type,source,strategic_value,near_active_incident")
      .eq("account_id", accountId)
      .in("prospect_type", segments)
      .limit(300),
    supabase
      .from("referral_partners")
      .select("id,company_name,contact_name,email,phone,city,state,zip,territory,partner_type,source,strategic_value,near_active_incident")
      .eq("account_id", accountId)
      .in("partner_type", segments)
      .limit(300)
  ]);

  if (prospectError) throw new Error(prospectError.message);
  if (partnerError) throw new Error(partnerError.message);

  const baseLocation = {
    territory: toText(seed.territory) || (seed.city && seed.state ? `${seed.city}, ${seed.state}` : null),
    city: toText(seed.city) || null,
    state: toText(seed.state) || null,
    postalCode: toText(seed.zip) || null
  };

  const project = (row: Record<string, unknown>, recordType: NetworkRecordKind, segmentKey: string): NetworkCandidate | null => {
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    if (!email && !phone) return null;

    const match = scoreNetworkActivationMatch({
      ...baseLocation,
      candidate: {
        territory: toText(row.territory) || null,
        city: toText(row.city) || null,
        state: toText(row.state) || null,
        postalCode: toText(row.zip) || null,
        nearActiveIncident: Boolean(row.near_active_incident)
      }
    });

    if (match.score < 42) return null;

    return {
      recordType,
      recordId: toText(row.id),
      companyName: toText(row.company_name || "Network contact"),
      contactName: toText(row.contact_name) || null,
      email,
      phone,
      city: toText(row.city) || null,
      state: toText(row.state) || null,
      postalCode: toText(row.zip) || null,
      territory: toText(row.territory) || null,
      segment: toText(segmentKey || "network"),
      source: toText(row.source) || null,
      strategicValue: toNumber(row.strategic_value, 50),
      nearActiveIncident: Boolean(row.near_active_incident),
      matchReason: match.reason,
      matchScore: match.score
    };
  };

  const mapped = [
    ...((prospects || []) as Array<Record<string, unknown>>)
      .map((row) => project(row, "prospect", toText(row.prospect_type))),
    ...((partners || []) as Array<Record<string, unknown>>)
      .map((row) => project(row, "referral_partner", toText(row.partner_type)))
  ].filter((row): row is NetworkCandidate => Boolean(row));

  return mapped
    .sort((a, b) => b.matchScore - a.matchScore || b.strategicValue - a.strategicValue || Number(b.nearActiveIncident) - Number(a.nearActiveIncident))
    .slice(0, 24);
}

export async function launchNetworkActivationForOpportunity(input: {
  supabase: SupabaseClient;
  accountId: string;
  tenantId: string;
  actorUserId: string;
  opportunityId: string;
  autoOutreach?: boolean;
}) : Promise<NetworkActivationResult> {
  const autoOutreach = input.autoOutreach !== false;
  const opportunity = await fetchOpportunity({
    supabase: input.supabase,
    tenantId: input.tenantId,
    opportunityId: input.opportunityId
  });

  const seed = buildNetworkActivationOpportunitySeed(opportunity);
  const segments = getIncidentTriggeredSegments(seed);
  const candidates = await fetchNetworkCandidates({
    supabase: input.supabase,
    accountId: input.accountId,
    seed,
    segments
  });

  if (candidates.length === 0) {
    throw new Error("No contactable partner or prospect records matched this opportunity.");
  }

  const outboundList = (await createOutboundListWithMembers({
    accountId: input.accountId,
    supabase: input.supabase as never,
    name: `${seed.title || "Opportunity"} - Buyer Flow`,
    listType: "incident_triggered",
    territory: seed.territory || null,
    sourceTrigger: seed.title || opportunity.title,
    segmentDefinition: {
      segments,
      opportunity_id: opportunity.id,
      service_line: opportunity.serviceLine,
      launch_mode: "buyer_flow",
      match_strategy: "territory_city_state_fallback"
    },
    members: candidates.map((candidate) => ({
      record_type: candidate.recordType,
      record_id: candidate.recordId
    }))
  })) as Record<string, unknown> & {
    id: string;
    name?: string | null;
    list_type?: string | null;
    member_count?: number;
  };

  const existingLeadsResponse = await input.supabase
    .from("v2_leads")
    .select("id,contact_channels_json")
    .eq("tenant_id", input.tenantId)
    .eq("opportunity_id", opportunity.id)
    .limit(200);
  if (existingLeadsResponse.error) throw new Error(existingLeadsResponse.error.message);
  const existingLeads = (existingLeadsResponse.data || []) as Array<Record<string, unknown>>;
  const existingDestinations = extractExistingDestinations(existingLeads);

  let leadsCreated = 0;
  let outreachSent = 0;

  for (const candidate of candidates) {
    const email = candidate.email ? normalizeEmail(candidate.email) : null;
    const phone = candidate.phone ? normalizePhone(candidate.phone) : null;
    if ((email && existingDestinations.emails.has(email)) || (phone && existingDestinations.phones.has(phone))) {
      continue;
    }

    const verificationScore = email && phone ? 92 : 84;
    const verificationReasons = [
      `curated ${candidate.recordType.replace("_", " ")} contact`,
      `match ${candidate.matchReason}`,
      `segment ${candidate.segment}`
    ];

    const { data: leadRow, error: leadError } = await input.supabase
      .from("v2_leads")
      .insert({
        tenant_id: input.tenantId,
        opportunity_id: opportunity.id,
        contact_name: candidate.contactName || candidate.companyName,
        business_name: candidate.companyName,
        contact_channels_json: {
          phone,
          email,
          source_type: `${candidate.recordType}_network`,
          verification_status: "verified",
          verification_score: verificationScore,
          verification_reasons: verificationReasons,
          contact_provenance: `network:${candidate.recordType}:${candidate.source || "manual"}`,
          contact_evidence: [
            phone ? "network:phone" : "",
            email ? "network:email" : "",
            `match:${candidate.matchReason}`,
            `segment:${candidate.segment}`
          ].filter(Boolean),
          record_id: candidate.recordId,
          record_kind: candidate.recordType,
          segment: candidate.segment,
          match_reason: candidate.matchReason,
          match_score: candidate.matchScore
        },
        property_address: opportunity.locationText || null,
        city: seed.city || candidate.city,
        state: seed.state || candidate.state,
        postal_code: seed.zip || candidate.postalCode,
        lead_status: "new",
        crm_sync_status: "not_synced",
        do_not_contact: false
      })
      .select("id")
      .single();

    if (leadError || !leadRow?.id) {
      throw new Error(leadError?.message || "Failed to create network lead");
    }

    leadsCreated += 1;
    if (email) existingDestinations.emails.add(email);
    if (phone) existingDestinations.phones.add(phone);

    if (autoOutreach) {
      const outreach = await dispatchOutreach({
        supabase: input.supabase,
        tenantId: input.tenantId,
        leadId: String(leadRow.id),
        actorUserId: input.actorUserId,
        channel: "crm_task",
        to: candidate.companyName,
        subject: `New ${opportunity.serviceLine} buyer-flow lead`,
        body: `Follow up with ${candidate.contactName || candidate.companyName} for ${opportunity.title} in ${opportunity.locationText || "the target market"}. Match reason: ${candidate.matchReason}.`
      }).catch(() => ({ sent: false }));

      if (outreach?.sent) {
        outreachSent += 1;
      }
    }
  }

  await input.supabase
    .from("v2_opportunities")
    .update({
      lifecycle_status: leadsCreated > 0 ? "qualified" : opportunity.lifecycleStatus,
      contact_status: leadsCreated > 0 ? "identified" : opportunity.contactStatus,
      explainability_json: {
        ...opportunity.explainability,
        network_activation: {
          launched_at: new Date().toISOString(),
          outbound_list_id: outboundList.id,
          matched_count: candidates.length,
          leads_created: leadsCreated,
          outreach_sent: outreachSent,
          segments
        }
      }
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", opportunity.id);

  await logV2AuditEvent({
    tenantId: input.tenantId,
    actorType: "user",
    actorId: input.actorUserId,
    entityType: "opportunity",
    entityId: opportunity.id,
    action: "network_buyer_flow_launched",
    before: null,
    after: {
      outbound_list_id: outboundList.id,
      matched_count: candidates.length,
      leads_created: leadsCreated,
      outreach_sent: outreachSent,
      segments
    }
  });

  const contactableSmsCount = candidates.filter((candidate) => Boolean(candidate.phone)).length;
  const contactableEmailCount = candidates.filter((candidate) => Boolean(candidate.email)).length;

  return {
    opportunityId: opportunity.id,
    listId: String(outboundList.id),
    listName: String(outboundList.name || `${opportunity.title} - Buyer Flow`),
    listType: String(outboundList.list_type || "incident_triggered"),
    territory: seed.territory || null,
    segments,
    matchedCount: candidates.length,
    leadsCreated,
    outreachSent,
    contactableSmsCount,
    contactableEmailCount,
    contactableRecords: candidates.map((candidate) => ({
      recordType: candidate.recordType,
      recordId: candidate.recordId,
      companyName: candidate.companyName,
      contactName: candidate.contactName,
      segment: candidate.segment,
      matchReason: candidate.matchReason,
      matchScore: candidate.matchScore
    }))
  };
}

export async function syncNetworkActivationList(input: {
  supabase: SupabaseClient;
  accountId: string;
  listId: string;
  campaignId: string;
  addLeads: (campaignId: string, leads: Array<Record<string, unknown>>) => Promise<unknown>;
  mapLead: (record: Record<string, unknown> & { kind?: string }) => Record<string, unknown>;
}) {
  const { list, prospects, partners } = await fetchOutboundListRecords({
    supabase: input.supabase as never,
    accountId: input.accountId,
    listId: input.listId
  });

  const payload = [
    ...prospects.map((row) => input.mapLead({ ...row, kind: "prospect" })),
    ...partners.map((row) => input.mapLead({ ...row, kind: "referral_partner" }))
  ];

  const response = await input.addLeads(input.campaignId, payload);
  await input.supabase
    .from("outbound_lists")
    .update({
      export_status: "synced",
      smartlead_campaign_id: input.campaignId
    })
    .eq("account_id", input.accountId)
    .eq("id", input.listId);

  return {
    list,
    leadCount: payload.length,
    response
  };
}
