import { normalizeDestinationForChannel } from "@/lib/v2/contact-destinations";
import { dispatchOutreach } from "@/lib/v2/outreach-orchestrator";
import { getVertical } from "@/lib/v2/franchise-verticals";
import type { DispatchableLeadCandidate } from "@/lib/v2/dispatchable-leads";
import type { V2OwnerUserResolutionSource } from "@/lib/v2/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const OUTREACH_COOLING_WINDOW_MINUTES = 240;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function firstName(value: string | null) {
  return asText(value).split(/\s+/).filter(Boolean)[0] || "";
}

function deriveSmsDestination(candidate: DispatchableLeadCandidate) {
  return normalizeDestinationForChannel("sms", candidate.phone);
}

function latestOutreachTimestamp(event: Record<string, unknown> | null) {
  return (
    asText(event?.sent_at) ||
    asText(event?.response_at) ||
    asText(event?.created_at) ||
    null
  );
}

function ageMinutes(value: string | null, nowMs: number) {
  if (!value) return Number.POSITIVE_INFINITY;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((nowMs - ts) / 60_000));
}

export type DispatchableLeadFollowUpState = "dispatchable" | "contacted" | "replied" | "booked" | "follow_up_needed";

export type DispatchableLeadOutreachSummary = {
  outreach_eligible: boolean;
  outreach_blocked_reason: string | null;
  outreach_channel: "sms" | null;
  outreach_status: string | null;
  outreach_send_mode: "review_safe" | "live" | null;
  outreach_last_sent_at: string | null;
  follow_up_state: DispatchableLeadFollowUpState;
};

export function mergeDispatchableOutreachSummary(
  explainability: unknown,
  patch: Partial<{
    outreach_channel: "sms" | null;
    outreach_last_status: string | null;
    outreach_last_outcome: string | null;
    outreach_last_sent_at: string | null;
    outreach_last_send_mode: "review_safe" | "live" | null;
    outreach_last_provider_message_id: string | null;
    outreach_template_key: string | null;
    outreach_eligibility_reason: string | null;
    follow_up_state: DispatchableLeadFollowUpState;
    outreach_last_message_body: string | null;
    outreach_actor_user_id: string | null;
    outreach_actor_resolution_source: V2OwnerUserResolutionSource | null;
    outreach_lead_id: string | null;
  }>
) {
  const current = asRecord(explainability);
  return {
    ...current,
    ...(patch.outreach_channel !== undefined ? { outreach_channel: patch.outreach_channel } : {}),
    ...(patch.outreach_last_status !== undefined ? { outreach_last_status: patch.outreach_last_status } : {}),
    ...(patch.outreach_last_outcome !== undefined ? { outreach_last_outcome: patch.outreach_last_outcome } : {}),
    ...(patch.outreach_last_sent_at !== undefined ? { outreach_last_sent_at: patch.outreach_last_sent_at } : {}),
    ...(patch.outreach_last_send_mode !== undefined ? { outreach_last_send_mode: patch.outreach_last_send_mode } : {}),
    ...(patch.outreach_last_provider_message_id !== undefined
      ? { outreach_last_provider_message_id: patch.outreach_last_provider_message_id }
      : {}),
    ...(patch.outreach_template_key !== undefined ? { outreach_template_key: patch.outreach_template_key } : {}),
    ...(patch.outreach_eligibility_reason !== undefined ? { outreach_eligibility_reason: patch.outreach_eligibility_reason } : {}),
    ...(patch.follow_up_state !== undefined ? { follow_up_state: patch.follow_up_state } : {}),
    ...(patch.outreach_last_message_body !== undefined ? { outreach_last_message_body: patch.outreach_last_message_body } : {}),
    ...(patch.outreach_actor_user_id !== undefined ? { outreach_actor_user_id: patch.outreach_actor_user_id } : {}),
    ...(patch.outreach_actor_resolution_source !== undefined
      ? { outreach_actor_resolution_source: patch.outreach_actor_resolution_source }
      : {}),
    ...(patch.outreach_lead_id !== undefined ? { outreach_lead_id: patch.outreach_lead_id } : {})
  };
}

export function deriveDispatchableLeadOutreachSummary(input: {
  candidate: DispatchableLeadCandidate;
  opportunity?: Record<string, unknown> | null;
  lead?: Record<string, unknown> | null;
  latestOutreachEvent?: Record<string, unknown> | null;
  nowMs?: number;
}): DispatchableLeadOutreachSummary {
  const opportunity = input.opportunity || {};
  const explainability = asRecord(opportunity.explainability_json);
  const latestEvent = input.latestOutreachEvent || null;
  const nowMs = input.nowMs ?? Date.now();
  const followUpState: DispatchableLeadFollowUpState =
    asText(explainability.follow_up_state) === "replied"
      ? "replied"
      : asText(explainability.follow_up_state) === "follow_up_needed"
        ? "follow_up_needed"
        : asText(opportunity.lifecycle_status).toLowerCase() === "booked_job"
          ? "booked"
          : asText(explainability.outreach_last_status) || latestEvent
            ? "contacted"
            : "dispatchable";

  if (!input.candidate.dispatch_eligible) {
    return {
      outreach_eligible: false,
      outreach_blocked_reason: "not_dispatchable",
      outreach_channel: null,
      outreach_status: asText(explainability.outreach_last_status || latestEvent?.event_type) || null,
      outreach_send_mode: asText(explainability.outreach_last_send_mode) === "live" ? "live" : asText(explainability.outreach_last_send_mode) ? "review_safe" : null,
      outreach_last_sent_at: asText(explainability.outreach_last_sent_at || latestOutreachTimestamp(latestEvent)) || null,
      follow_up_state: followUpState
    };
  }

  const smsPhone = deriveSmsDestination(input.candidate);
  if (!smsPhone) {
    return {
      outreach_eligible: false,
      outreach_blocked_reason: "missing_verified_sms_phone",
      outreach_channel: "sms",
      outreach_status: asText(explainability.outreach_last_status || latestEvent?.event_type) || null,
      outreach_send_mode: asText(explainability.outreach_last_send_mode) === "live" ? "live" : asText(explainability.outreach_last_send_mode) ? "review_safe" : null,
      outreach_last_sent_at: asText(explainability.outreach_last_sent_at || latestOutreachTimestamp(latestEvent)) || null,
      follow_up_state: followUpState
    };
  }

  if (input.lead?.do_not_contact === true) {
    return {
      outreach_eligible: false,
      outreach_blocked_reason: "suppressed",
      outreach_channel: "sms",
      outreach_status: asText(explainability.outreach_last_status || latestEvent?.event_type) || null,
      outreach_send_mode: asText(explainability.outreach_last_send_mode) === "live" ? "live" : asText(explainability.outreach_last_send_mode) ? "review_safe" : null,
      outreach_last_sent_at: asText(explainability.outreach_last_sent_at || latestOutreachTimestamp(latestEvent)) || null,
      follow_up_state: followUpState
    };
  }

  if (followUpState !== "dispatchable") {
    return {
      outreach_eligible: false,
      outreach_blocked_reason: followUpState === "contacted" ? "already_contacted_recently" : `state_${followUpState}`,
      outreach_channel: "sms",
      outreach_status: asText(explainability.outreach_last_status || latestEvent?.event_type) || null,
      outreach_send_mode: asText(explainability.outreach_last_send_mode) === "live" ? "live" : asText(explainability.outreach_last_send_mode) ? "review_safe" : null,
      outreach_last_sent_at: asText(explainability.outreach_last_sent_at || latestOutreachTimestamp(latestEvent)) || null,
      follow_up_state: followUpState
    };
  }

  const latestSentAt = asText(explainability.outreach_last_sent_at || latestOutreachTimestamp(latestEvent)) || null;
  if (ageMinutes(latestSentAt, nowMs) <= OUTREACH_COOLING_WINDOW_MINUTES) {
    return {
      outreach_eligible: false,
      outreach_blocked_reason: "cooling_window",
      outreach_channel: "sms",
      outreach_status: asText(explainability.outreach_last_status || latestEvent?.event_type) || null,
      outreach_send_mode: asText(explainability.outreach_last_send_mode) === "live" ? "live" : asText(explainability.outreach_last_send_mode) ? "review_safe" : null,
      outreach_last_sent_at: latestSentAt,
      follow_up_state: followUpState
    };
  }

  return {
    outreach_eligible: true,
    outreach_blocked_reason: null,
    outreach_channel: "sms",
    outreach_status: asText(explainability.outreach_last_status || latestEvent?.event_type) || null,
    outreach_send_mode: asText(explainability.outreach_last_send_mode) === "live" ? "live" : asText(explainability.outreach_last_send_mode) ? "review_safe" : null,
    outreach_last_sent_at: latestSentAt,
      follow_up_state: followUpState
    };
  }

export function buildPermitFirstTouchSms(input: {
  businessName: string;
  location: string | null;
  serviceSignal: string | null;
  verticalKey?: string | null;
}) {
  const vertical = getVertical(input.verticalKey || "home_services");
  const name = firstName(input.businessName);
  const location = asText(input.location);
  const service = asText(input.serviceSignal).replace(/_/g, " ");
  const intro = name ? `Hi ${name},` : "Hi,";

  if (vertical.key === "restoration") {
    return `${intro} we noticed recent permit activity${location ? ` at ${location}` : ""} that may point to repair or restoration work. Our local team can help quickly with ${service || "the project"}. Reply here if you'd like a call or estimate. Reply STOP to opt out.`;
  }

  return `${intro} we noticed recent permit activity${location ? ` at ${location}` : ""} and wanted to offer help with ${service || "the project"}. Our local licensed team can provide a quick call or estimate. Reply here if you'd like us to reach out. Reply STOP to opt out.`;
}

async function ensureLeadForDispatchableOpportunity(input: {
  supabase: SupabaseClient;
  tenantId: string;
  actorUserId: string;
  opportunityId: string;
  candidate: DispatchableLeadCandidate;
  opportunity: Record<string, unknown>;
}) {
  const { data: existingLead, error: existingLeadError } = await input.supabase
    .from("v2_leads")
    .select("id,opportunity_id,do_not_contact,contact_channels_json")
    .eq("tenant_id", input.tenantId)
    .eq("opportunity_id", input.opportunityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLeadError) throw new Error(existingLeadError.message);
  if (existingLead?.id) return existingLead as Record<string, unknown>;

  const explainability = asRecord(input.opportunity.explainability_json);
  const contactChannels = {
    phone: deriveSmsDestination(input.candidate),
    email: asText(input.candidate.email) || null,
    verification_status: input.candidate.verification_status || "verified",
    verification_score: 90,
    contact_provenance: input.candidate.contact_provenance,
    contact_evidence: [
      input.candidate.phone ? "dispatchable:sms" : "",
      input.candidate.email ? "dispatchable:email" : "",
      input.candidate.contact_provenance || ""
    ].filter(Boolean)
  };

  const { data: insertedLead, error: leadError } = await input.supabase
    .from("v2_leads")
    .insert({
      tenant_id: input.tenantId,
      opportunity_id: input.opportunityId,
      contact_name: input.candidate.business_name,
      business_name: input.candidate.business_name,
      contact_channels_json: contactChannels,
      property_address: asText(explainability.address || input.opportunity.location_text) || null,
      city: asText(explainability.property_city) || null,
      state: asText(explainability.property_state) || null,
      postal_code: asText(input.opportunity.postal_code || explainability.property_postal_code) || null,
      lead_status: "new",
      owner_user_id: input.actorUserId,
      crm_sync_status: "not_synced",
      do_not_contact: false
    })
    .select("id,opportunity_id,do_not_contact,contact_channels_json")
    .single();

  if (leadError || !insertedLead?.id) throw new Error(leadError?.message || "Failed to create v2 lead for outreach");
  return insertedLead as Record<string, unknown>;
}

export async function triggerDispatchableLeadOutreach(input: {
  supabase: SupabaseClient;
  tenantId: string;
  actorUserId: string;
  actorResolutionSource?: V2OwnerUserResolutionSource;
  franchiseVertical?: string | null;
  opportunity: Record<string, unknown>;
  candidate: DispatchableLeadCandidate;
  existingLead?: Record<string, unknown> | null;
  latestOutreachEvent?: Record<string, unknown> | null;
}) {
  const summary = deriveDispatchableLeadOutreachSummary({
    candidate: input.candidate,
    opportunity: input.opportunity,
    lead: input.existingLead || null,
    latestOutreachEvent: input.latestOutreachEvent || null
  });

  if (!summary.outreach_eligible) {
    const explainability = mergeDispatchableOutreachSummary(input.opportunity.explainability_json, {
      outreach_eligibility_reason: summary.outreach_blocked_reason,
      follow_up_state: summary.follow_up_state
    });

    await input.supabase
      .from("v2_opportunities")
      .update({ explainability_json: explainability })
      .eq("tenant_id", input.tenantId)
      .eq("id", asText(input.opportunity.id));

    return {
      sent: false,
      blocked: true,
      reason: summary.outreach_blocked_reason
    };
  }

  const lead = input.existingLead || (await ensureLeadForDispatchableOpportunity({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    opportunityId: asText(input.opportunity.id),
    candidate: input.candidate,
    opportunity: input.opportunity
  }));

  const body = buildPermitFirstTouchSms({
    businessName: input.candidate.business_name,
    location: input.candidate.location,
    serviceSignal: input.candidate.service_signal,
    verticalKey: input.franchiseVertical
  });
  const templateKey = "dispatchable_permit_first_touch_sms_v1";
  const sent = await dispatchOutreach({
    supabase: input.supabase,
    tenantId: input.tenantId,
    leadId: asText(lead.id),
    actorUserId: input.actorUserId,
    channel: "sms",
    to: deriveSmsDestination(input.candidate) || "",
    body,
    coolingWindowMinutes: OUTREACH_COOLING_WINDOW_MINUTES,
    safeMode: true,
    metadata: {
      opportunity_id: asText(input.opportunity.id),
      template_key: templateKey,
      message_body: body,
      send_mode: "review_safe",
      contact_provenance: input.candidate.contact_provenance,
      source_provenance: asText(asRecord(input.opportunity.explainability_json).source_provenance) || null,
      actor_user_id: input.actorUserId,
      actor_resolution_source: input.actorResolutionSource || "authenticated_user"
    }
  });

  const sentAt = new Date().toISOString();
  const explainability = mergeDispatchableOutreachSummary(input.opportunity.explainability_json, {
    outreach_channel: "sms",
    outreach_last_status: sent.sent ? "sent" : sent.skipped ? "skipped" : "failed",
    outreach_last_outcome: sent.outcome || sent.reason || null,
    outreach_last_sent_at: sentAt,
    outreach_last_send_mode: "review_safe",
    outreach_last_provider_message_id: sent.providerMessageId || null,
    outreach_template_key: templateKey,
    outreach_eligibility_reason: null,
    follow_up_state: sent.sent ? "contacted" : "dispatchable",
    outreach_last_message_body: body,
    outreach_actor_user_id: input.actorUserId,
    outreach_actor_resolution_source: input.actorResolutionSource || "authenticated_user",
    outreach_lead_id: asText(lead.id)
  });

  await input.supabase
    .from("v2_opportunities")
    .update({
      lifecycle_status: sent.sent ? "contacted" : input.opportunity.lifecycle_status,
      explainability_json: explainability
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", asText(input.opportunity.id));

  return {
    ...sent,
    leadId: asText(lead.id),
    templateKey,
    messageBody: body,
    sendMode: "review_safe" as const
  };
}
